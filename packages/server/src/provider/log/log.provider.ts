import { Injectable } from '@nestjs/common';
import pino from 'pino';
import fs from 'fs';
import { EventType } from './types';
import { Request } from 'express';
import { getNetIp, getPlatform } from './utils';
import { config } from 'src/config';
import path from 'path';
import { checkOrCreate } from 'src/utils/checkFolder';
import { Pipeline } from 'src/scheme/pipeline.schema';
import { CodeResult } from '../pipeline/pipeline.provider';
import readline from 'node:readline';
import { createHash } from 'node:crypto';

const SENSITIVE_LOG_KEYS = /^(token|authorization|cookie|password|secret|api[-_]?key)$/i;
const SYSTEM_LOG_READ_CHUNK_SIZE = 64 * 1024;
const SYSTEM_LOG_MAX_INCREMENT_BYTES = 4 * 1024 * 1024;

type SystemLogCursor = {
  dev: number;
  ino: number;
  offset: number;
  anchor: string;
  dropping?: boolean;
};

export function redactLogValue(value: any, depth = 0): any {
  if (depth > 5) return '[TRUNCATED]';
  if (typeof value === 'string') {
    return value.length > 4096 ? `${value.slice(0, 4096)}…[TRUNCATED]` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => redactLogValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_LOG_KEYS.test(key) ? '[REDACTED]' : redactLogValue(item, depth + 1),
      ]),
    );
  }
  return value;
}

@Injectable()
export class LogProvider {
  logger = null;
  logPath = path.join(config.log, 'vanblog-event.log');
  systemLogPath = path.join(config.log, 'vanblog-stdio.log');
  constructor() {
    checkOrCreate(config.log);
    // 事件文件(vanblog-event.log)始终按 info 记全，作为后台「系统日志」审计源；
    // 镜像到 stdout 的这一份按 config.logLevel 控制，避免生产 docker logs 被审计事件刷屏。
    const stdoutLevel =
      (config.logLevel || 'balanced').toLowerCase() === 'silent'
        ? 'silent'
        : (config.logLevel || 'balanced').toLowerCase() === 'verbose'
          ? 'debug'
          : 'info';
    const streams = [
      {
        level: 'info' as const,
        stream: fs.createWriteStream(this.logPath, {
          flags: 'a+',
        }),
      },
      { level: stdoutLevel as pino.Level, stream: process.stdout },
    ];
    // 基础 level 取最宽松，实际过滤交给每个 stream 的 level。
    this.logger = pino({ level: 'debug' }, pino.multistream(streams));
    this.logger.info({ event: 'start' });
  }
  async runPipeline(
    pipeline: Pipeline,
    input: any,
    result?: CodeResult,
    error?: Error,
  ) {
    this.logger.info({
      event: EventType.RUN_PIPELINE,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      eventName: pipeline.eventName,
      success: result?.status == 'success' ? true : false,
      logs: redactLogValue(result?.logs || []),
      output: redactLogValue(result?.output || []),
      serverError: error?.message || '',
      input: redactLogValue(input),
    });
  }
  async login(req: Request, success: boolean) {
    const logger = this.logger;
    const { address, ip } = await getNetIp(req);
    const platform = getPlatform(req.headers['user-agent']);
    logger.info({
      address,
      ip,
      platform,
      event: EventType.LOGIN,
      success,
    });
  }
  private getReadableLogPath(eventType: EventType) {
    const candidates =
      eventType === EventType.SYSTEM
        ? [
            this.systemLogPath,
            path.join(config.log, 'server.log'),
            path.join('/var/log', 'vanblog-stdio.log'),
          ]
        : [this.logPath];

    return (
      candidates.find((candidate) => {
        try {
          return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
        } catch (error) {
          return false;
        }
      }) || null
    );
  }

  private async readLogFile(filePath: string, eventType: EventType, all: number) {
    if (!filePath) {
      return { data: [], total: 0 };
    }

    return await new Promise<{ data: any[]; total: number }>((resolve) => {
      const data: any[] = [];
      let total = 0;
      let resolved = false;
      const finish = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve({ data, total });
      };

      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      stream.on('error', finish);

      const reader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      reader.on('line', (line: string) => {
        const current = line.trim();
        if (!current) {
          return;
        }

        let item: any = current;
        if (eventType !== EventType.SYSTEM) {
          try {
            item = JSON.parse(current);
          } catch (error) {
            return;
          }
        }

        if (eventType !== EventType.SYSTEM && item?.event !== eventType) {
          return;
        }

        total += 1;
        if (data.length >= all) {
          data.shift();
        }
        data.push(item);
      });

      reader.on('close', finish);
      reader.on('error', finish);
    });
  }

  private encodeSystemLogCursor(cursor: SystemLogCursor) {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private decodeSystemLogCursor(value?: string): SystemLogCursor | null {
    if (!value) {
      return null;
    }
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (
        !Number.isFinite(parsed?.dev) ||
        !Number.isFinite(parsed?.ino) ||
        !Number.isSafeInteger(parsed?.offset) ||
        parsed.offset < 0 ||
        typeof parsed.anchor !== 'string'
      ) {
        return null;
      }
      return {
        dev: Number(parsed.dev),
        ino: Number(parsed.ino),
        offset: Number(parsed.offset),
        anchor: parsed.anchor,
        dropping: parsed.dropping === true,
      };
    } catch {
      return null;
    }
  }

  private toSystemLogLines(buffer: Buffer, discardLeadingPartialLine: boolean) {
    let text = buffer.toString('utf8');
    if (discardLeadingPartialLine) {
      const firstLineEnd = text.indexOf('\n');
      text = firstLineEnd === -1 ? '' : text.slice(firstLineEnd + 1);
    }
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private getAnchor(buffer: Buffer) {
    if (!buffer.length) {
      return '';
    }
    return createHash('sha256')
      .update(buffer.subarray(Math.max(0, buffer.length - 64)))
      .digest('hex');
  }

  private async readFileRange(
    handle: fs.promises.FileHandle,
    start: number,
    end: number,
  ) {
    const chunks: Buffer[] = [];
    let position = start;
    while (position < end) {
      const length = Math.min(SYSTEM_LOG_READ_CHUNK_SIZE, end - position);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, position);
      if (bytesRead <= 0) {
        break;
      }
      chunks.push(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return Buffer.concat(chunks);
  }

  private async buildSystemLogCursor(
    handle: fs.promises.FileHandle,
    stat: fs.Stats,
    offset: number,
    dropping = false,
  ) {
    const anchorBuffer = await this.readFileRange(
      handle,
      Math.max(0, offset - 64),
      offset,
    );
    return this.encodeSystemLogCursor({
      dev: Number(stat.dev),
      ino: Number(stat.ino),
      offset,
      anchor: this.getAnchor(anchorBuffer),
      dropping,
    });
  }

  private async readSystemLogTail(filePath: string, limit: number) {
    const handle = await fs.promises.open(filePath, 'r');
    const chunks: Buffer[] = [];
    const stat = await handle.stat();
    let position = stat.size;
    let newlineCount = 0;
    const minimumPosition = Math.max(
      0,
      stat.size - SYSTEM_LOG_MAX_INCREMENT_BYTES,
    );

    try {
      while (position > minimumPosition && newlineCount <= limit) {
        const readSize = Math.min(
          SYSTEM_LOG_READ_CHUNK_SIZE,
          position - minimumPosition,
        );
        position -= readSize;
        const chunk = await this.readFileRange(handle, position, position + readSize);
        if (!chunk.length) {
          break;
        }
        chunks.unshift(chunk);
        for (const byte of chunk) {
          if (byte === 10) {
            newlineCount += 1;
          }
        }
      }
      const buffer = Buffer.concat(chunks);
      let startIndex = 0;
      if (position > 0) {
        const firstNewline = buffer.indexOf(10);
        if (firstNewline === -1) {
          return {
            data: [],
            total: 0,
            nextCursor: await this.buildSystemLogCursor(
              handle,
              stat,
              stat.size,
              true,
            ),
            reset: true,
          };
        }
        startIndex = firstNewline + 1;
      }

      const lastNewline = buffer.lastIndexOf(10);
      const completeOffset =
        lastNewline >= startIndex ? position + lastNewline + 1 : position + startIndex;
      const complete =
        lastNewline >= startIndex
          ? buffer.subarray(startIndex, lastNewline + 1)
          : Buffer.alloc(0);
      const data = this.toSystemLogLines(complete, false).slice(-limit);
      return {
        data,
        total: data.length,
        nextCursor: await this.buildSystemLogCursor(
          handle,
          stat,
          completeOffset,
        ),
        reset: true,
      };
    } finally {
      await handle.close();
    }
  }

  async tailSystemLog(cursorValue?: string, limit = 1000) {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit || 1000), 1000));
    const filePath = this.getReadableLogPath(EventType.SYSTEM);
    if (!filePath) {
      return {
        data: [],
        total: 0,
        nextCursor: null,
        reset: true,
      };
    }

    const cursor = this.decodeSystemLogCursor(cursorValue);
    if (!cursor) {
      return await this.readSystemLogTail(filePath, safeLimit);
    }
    const handle = await fs.promises.open(filePath, 'r');
    let stat: fs.Stats;
    let buffer = Buffer.alloc(0);
    let mustReset = false;
    try {
      stat = await handle.stat();
      const fileIdentityChanged =
        cursor.dev !== Number(stat.dev) || cursor.ino !== Number(stat.ino);
      const invalidOffset =
        cursor.offset > stat.size ||
        stat.size - cursor.offset > SYSTEM_LOG_MAX_INCREMENT_BYTES;
      if (fileIdentityChanged || invalidOffset) {
        mustReset = true;
      } else {
        const anchorBuffer = await this.readFileRange(
          handle,
          Math.max(0, cursor.offset - 64),
          cursor.offset,
        );
        if (cursor.anchor !== this.getAnchor(anchorBuffer)) {
          mustReset = true;
        } else {
          buffer = await this.readFileRange(handle, cursor.offset, stat.size);
          const finalStat = await handle.stat();
          mustReset =
            finalStat.dev !== stat.dev ||
            finalStat.ino !== stat.ino ||
            finalStat.size < stat.size ||
            buffer.length !== stat.size - cursor.offset;
        }
      }

      if (mustReset) {
        return await this.readSystemLogTail(filePath, safeLimit);
      }

      let startIndex = 0;
      if (cursor.dropping) {
        const firstNewline = buffer.indexOf(10);
        if (firstNewline === -1) {
          return {
            data: [],
            total: 0,
            nextCursor: await this.buildSystemLogCursor(
              handle,
              stat,
              stat.size,
              true,
            ),
            reset: false,
          };
        }
        startIndex = firstNewline + 1;
      }

      const remaining = buffer.subarray(startIndex);
      const lastNewline = remaining.lastIndexOf(10);
      const nextOffset =
        lastNewline >= 0
          ? cursor.offset + startIndex + lastNewline + 1
          : cursor.offset + startIndex;
      const complete =
        lastNewline >= 0
          ? remaining.subarray(0, lastNewline + 1)
          : Buffer.alloc(0);
      const data = this.toSystemLogLines(complete, false).slice(-safeLimit);
      return {
        data,
        total: data.length,
        nextCursor: await this.buildSystemLogCursor(
          handle,
          stat,
          nextOffset,
        ),
        reset: false,
      };
    } finally {
      await handle.close();
    }
  }

  async searchLog(page: number, pageSize: number, eventType: EventType) {
    const skip = page * pageSize - pageSize;
    const all = page * pageSize;
    const filePath = this.getReadableLogPath(eventType);
    let { data, total } = await this.readLogFile(filePath, eventType, all);
    total = total;
    data = data.reverse();
    // 看一下 res 的数量够不够
    if (data.length <= skip) {
      return { data: [], total };
    } else {
      // 够
      return {
        data: data.slice(skip),
        total,
      };
    }
  }
}
