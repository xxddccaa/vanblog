import { Injectable, NotFoundException } from '@nestjs/common';
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
    // 检查一遍，安装依赖
    this.checkAllDeps();
    await this.saveAllScripts();
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
    const pipeline = await this.getPipelineById(id);
    if (!pipeline || pipeline.deleted) {
      throw new NotFoundException('Pipeline not found');
    }
    const traceId = new Date().getTime();
    this.logger.log(`[${traceId}]开始运行流水线: ${id} ${JSON.stringify(data, null, 2)}`);
    const run = new Promise<CodeResult>((resolve, reject) => {
      const subProcess = fork(this.getPathById(id));
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
      this.logger.log(`[${traceId}]运行流水线成功: ${id} ${JSON.stringify(result, null, 2)}`);
      this.logProvider.runPipeline(pipeline, data, result);
      return result;
    } catch (err) {
      this.logger.error(`[${traceId}]运行流水线失败: ${id} ${JSON.stringify(err, null, 2)}`);
      this.logProvider.runPipeline(pipeline, data, undefined, err);
      throw err;
    }
  }

  async addDeps(deps: string[]) {
    for (const dep of deps) {
      try {
        const r = spawnSync(`pnpm`, ['add', dep], {
          cwd: this.runnerPath,
          shell: process.platform === 'win32',
          env: {
            ...process.env,
          },
        });
        console.log(r.output.toString());
      } catch (e) {
        // console.log(e.output.map(a => a.toString()).join(''));
        console.log(e);
        // this.logger.error(e);
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
        logs.push(logArr.join(" "));
        oldLog(...args);
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
    writeFileSync(filePath, scriptToSave, { encoding: 'utf-8' });
  }
}
