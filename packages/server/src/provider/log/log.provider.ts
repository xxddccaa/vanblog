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

@Injectable()
export class LogProvider {
  logger = null;
  logPath = path.join(config.log, 'vanblog-event.log');
  systemLogPath = path.join(config.log, 'vanblog-stdio.log');
  constructor() {
    checkOrCreate(config.log);
    const streams = [
      {
        stream: fs.createWriteStream(this.logPath, {
          flags: 'a+',
        }),
      },
      { stream: process.stdout },
    ];
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
      logs: result?.logs || [],
      output: result?.output || [],
      serverError: error?.message || '',
      input,
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
