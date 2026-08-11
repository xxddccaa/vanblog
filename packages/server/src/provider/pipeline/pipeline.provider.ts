import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { PipelineDocument } from 'src/scheme/pipeline.schema';
import { VanblogSystemEvent, VanblogSystemEventNames } from 'src/types/event';
import { CreatePipelineDto, UpdatePipelineDto } from 'src/types/pipeline.dto';
import { spawnSync } from 'child_process';
import { config } from 'src/config/index';
import { writeFileSync, rmSync } from 'fs';
import { fork } from 'child_process';
import { LogProvider } from '../log/log.provider';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { PIPELINE_SANDBOX_PRELOAD } from './pipelineSandbox';

export interface CodeResult {
  logs: string[];
  output: any;
  status: 'success' | 'error';
}

@Injectable()
export class PipelineProvider {
  logger = new Logger(PipelineProvider.name);
  runnerPath = config.codeRunnerPath;
  private readonly pipelineRunTimeoutMs = 30000;
  private readonly pipelineMaxMessageBytes = 1024 * 1024;
  private readonly sandboxPreloadPath = `${this.runnerPath}/sandbox-preload.cjs`;
  constructor(
    @InjectModel('Pipeline')
    private pipelineModel: Model<PipelineDocument>,
    private readonly logProvider: LogProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {
    this.init();
  }

  checkEvent(eventName: string) {
    if (VanblogSystemEventNames.includes(eventName)) {
      return true;
    }
    return false;
  }

  async checkAllDeps() {
    this.logger.log('初始化流水线代码库，这可能需要一段时间');
    const pipelines = await this.getAll();
    const deps = [];
    for (const pipeline of pipelines) {
      for (const dep of pipeline.deps) {
        if (!deps.includes(dep)) {
          deps.push(dep);
        }
      }
    }
    await this.addDeps(deps);
  }

  async saveAllScripts() {
    const pipelines = await this.getAll();
    for (const pipeline of pipelines) {
      await this.saveOrUpdateScriptToRunnerPath(pipeline.id, pipeline.script);
    }
  }

  async init() {
    if (!this.isPipelineExecutionEnabled()) {
      this.logger.warn(
        '生产环境流水线执行默认关闭；如确需运行受限脚本，请显式设置 VAN_BLOG_PIPELINE_EXECUTION_ENABLED=true',
      );
      return;
    }
    await this.saveSandboxPreload();
    // 检查一遍，安装依赖
    await this.checkAllDeps();
    await this.saveAllScripts();
  }

  private isPipelineExecutionEnabled() {
    const configured = String(
      process.env.VAN_BLOG_PIPELINE_EXECUTION_ENABLED || '',
    ).toLowerCase();
    if (configured) {
      return ['true', '1', 'yes', 'on'].includes(configured);
    }
    return process.env.NODE_ENV !== 'production';
  }

  private assertPipelineExecutionEnabled() {
    if (!this.isPipelineExecutionEnabled()) {
      throw new ServiceUnavailableException(
        '生产环境流水线执行默认关闭；请在确认风险后设置 VAN_BLOG_PIPELINE_EXECUTION_ENABLED=true',
      );
    }
  }

  async getNewId() {
    return await this.structuredDataService.nextPipelineId();
  }

  async createPipeline(pipeline: CreatePipelineDto) {
    if (!this.checkEvent(pipeline.eventName)) {
      throw new NotFoundException('Event not found in VanblogEventNames');
    }
    const id = await this.getNewId();
    let script = pipeline.script;
    if (!script || !script.trim()) {
      script = `
// 异步任务，请在脚本顶层使用 await，不然会直接被忽略
// 请使用 input 变量获取数据（如果有）
// 直接修改 input 里的内容即可
// 脚本结束后 input 将被返回

`;
    }
    const newPipeline = await this.pipelineModel.create({
      id,
      ...pipeline,
      script,
    });
    await this.structuredDataService.upsertPipeline(
      newPipeline.toObject ? newPipeline.toObject() : newPipeline,
    );
    await this.saveOrUpdateScriptToRunnerPath(id, newPipeline.script);
    await this.addDeps(newPipeline.deps);
    return newPipeline;
  }

  async updatePipelineById(id: number, updateDto: UpdatePipelineDto) {
    await this.pipelineModel.updateOne({ id: id }, updateDto);
    const latest = await this.pipelineModel.findOne({ id }).lean().exec();
    if (latest) {
      await this.structuredDataService.upsertPipeline(latest);
    }
    if (updateDto.script) {
      await this.saveOrUpdateScriptToRunnerPath(id, updateDto.script);
    }
    if (updateDto.deps) {
      await this.addDeps(updateDto.deps);
    }
    return latest;
  }

  async deletePipelineById(id: number) {
    await this.pipelineModel.updateOne(
      { id: id },
      {
        deleted: true,
      },
    );
    const latest = await this.pipelineModel.findOne({ id }).lean().exec();
    if (latest) {
      await this.structuredDataService.upsertPipeline(latest);
    }
    await this.deleteScriptById(id);
    return latest;
  }
  async getAll() {
    if (this.structuredDataService.isInitialized()) {
      const pipelines = await this.structuredDataService.listPipelines();
      return pipelines as any;
    }
    return await this.pipelineModel.find({
      deleted: false,
    });
  }

  async getPipelineById(id: number) {
    if (this.structuredDataService.isInitialized()) {
      const pipeline = await this.structuredDataService.getPipelineById(id);
      return pipeline as any;
    }
    return await this.pipelineModel.findOne({ id: id });
  }

  async getPipelinesByEvent(eventName: string) {
    if (this.structuredDataService.isInitialized()) {
      const pipelines = await this.structuredDataService.getPipelinesByEvent(eventName);
      return pipelines as any;
    }
    return await this.pipelineModel.find({
      eventName,
      deleted: false,
    });
  }

  async triggerById(id: number, data: any) {
    const result = await this.runCodeByPipelineId(id, data);
    return result;
  }

  async dispatchEvent(eventName: VanblogSystemEvent, data?: any) {
    const pipelines = await this.getPipelinesByEvent(eventName);
    const results: CodeResult[] = [];
    for (const pipeline of pipelines) {
      if (pipeline.enabled) {
        try {
          const result = await this.runCodeByPipelineId(pipeline.id, data);
          results.push(result);
        } catch (e) {
          this.logger.error(e);
        }
      }
    }
    return results;
  }

  getPathById(id: number) {
    return `${this.runnerPath}/${id}.js`;
  }

  async runCodeByPipelineId(id: number, data: any): Promise<CodeResult> {
    this.assertPipelineExecutionEnabled();
    const pipeline = await this.getPipelineById(id);
    if (!pipeline || pipeline.deleted) {
      throw new NotFoundException('Pipeline not found');
    }
    const traceId = new Date().getTime();
    this.logger.log(`[${traceId}]开始运行流水线: ${id}`);
    const run = new Promise<CodeResult>((resolve, reject) => {
      const subProcess = fork(this.getPathById(id), [], {
        cwd: this.runnerPath,
        execArgv: [
          '--max-old-space-size=128',
          '--permission',
          `--allow-fs-read=${this.runnerPath}`,
          `--require=${this.sandboxPreloadPath}`,
        ],
        env: {
          NODE_ENV: process.env.NODE_ENV || 'production',
          PATH: process.env.PATH,
          TZ: process.env.TZ,
        },
      });
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        subProcess.removeAllListeners('message');
        subProcess.removeAllListeners('error');
        subProcess.removeAllListeners('exit');
        try {
          subProcess.disconnect();
        } catch (error) {}
        try {
          if (!subProcess.killed) {
            subProcess.kill('SIGINT');
          }
        } catch (error) {}
      };
      const finish = (handler: (value: CodeResult) => void, payload: CodeResult) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        handler(payload);
      };
      const timeout = setTimeout(() => {
        finish(reject, {
          status: 'error',
          output: {
            message: `流水线执行超时，已强制终止（>${this.pipelineRunTimeoutMs}ms）`,
          },
          logs: [],
        });
      }, this.pipelineRunTimeoutMs);

      subProcess.on('message', (msg: CodeResult) => {
        let messageBytes = 0;
        try {
          messageBytes = Buffer.byteLength(JSON.stringify(msg), 'utf8');
        } catch {
          messageBytes = this.pipelineMaxMessageBytes + 1;
        }
        if (messageBytes > this.pipelineMaxMessageBytes) {
          finish(reject, {
            status: 'error',
            output: {
              message: `流水线输出超过 ${this.pipelineMaxMessageBytes} 字节限制`,
            },
            logs: [],
          });
          return;
        }
        if (msg.status === 'error') {
          finish(reject, msg);
        } else {
          finish(resolve, msg);
        }
      });
      subProcess.on('error', (error: Error) => {
        finish(reject, {
          status: 'error',
          output: {
            message: error?.message || '流水线子进程启动失败',
          },
          logs: [],
        });
      });
      subProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        finish(reject, {
          status: 'error',
          output: {
            message: `流水线子进程异常退出（code=${code ?? 'null'}, signal=${signal ?? 'null'}）`,
          },
          logs: [],
        });
      });
      subProcess.send(data || {});
    });
    try {
      const result = (await run) as CodeResult;
      this.logger.log(`[${traceId}]运行流水线成功: ${id}`);
      this.logProvider.runPipeline(pipeline, data, result);
      return result;
    } catch (err) {
      this.logger.error(`[${traceId}]运行流水线失败: ${id} ${err?.message || 'unknown error'}`);
      this.logProvider.runPipeline(pipeline, data, undefined, err);
      throw err;
    }
  }

  async addDeps(deps: string[]) {
    if (!this.isPipelineExecutionEnabled()) {
      return;
    }
    for (const dep of deps) {
      if (
        typeof dep !== 'string' ||
        !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[a-z0-9*^~<>=|.+_-]+)?$/i.test(
          dep,
        )
      ) {
        throw new BadRequestException(`不允许安装该流水线依赖: ${String(dep)}`);
      }
      try {
        const r = spawnSync(`pnpm`, ['add', '--ignore-scripts', dep], {
          cwd: this.runnerPath,
          shell: process.platform === 'win32',
          timeout: 120000,
          maxBuffer: 1024 * 1024,
          env: {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
            NODE_ENV: 'production',
            PNPM_HOME: process.env.PNPM_HOME,
          },
        });
        if (r.status !== 0) {
          throw new Error(`pnpm exited with status ${r.status}`);
        }
      } catch (e) {
        this.logger.error(`安装流水线依赖失败: ${dep} ${e?.message || e}`);
        throw e;
      }
    }
  }

  async deleteScriptById(id: number) {
    const filePath = this.getPathById(id);
    try {
      rmSync(filePath);
    } catch (err) {
      this.logger.error(err);
    }
  }

  async saveOrUpdateScriptToRunnerPath(id: number, script: string) {
    const filePath = this.getPathById(id);
    const scriptToSave = `
      let input = {};
      let logs = [];
      let logBytes = 0;
      const MAX_LOG_ENTRIES = 100;
      const MAX_LOG_BYTES = 64 * 1024;
      const oldLog = console.log;
      console.log = (...args) => {
        const logArr = [];
        for (const each of args) {
          if (typeof each === 'object') {
            logArr.push(JSON.stringify(each,null,2));
          } else {
            logArr.push(each);
          }
        }
        const line = logArr.join(" ");
        const bytes = Buffer.byteLength(line, "utf8");
        if (logs.length < MAX_LOG_ENTRIES && logBytes + bytes <= MAX_LOG_BYTES) {
          logs.push(line);
          logBytes += bytes;
        }
      };
      process.on('message',async (msg) => {
        input = msg;
        try {
          ${script}
          process.send({
            status: 'success',
            output: input,
            logs,
          });
        } catch(err) {
          process.send({
            status: 'error',
            output: err,
            logs,
          });
        }
      });
    `;
    writeFileSync(filePath, scriptToSave, { encoding: 'utf-8', mode: 0o600 });
  }

  private async saveSandboxPreload() {
    writeFileSync(this.sandboxPreloadPath, PIPELINE_SANDBOX_PRELOAD, {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }
}
