import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ChildProcess, spawn } from 'node:child_process';
import { config } from 'src/config';
import { WalineSetting } from 'src/types/setting.dto';
import { makeSalt } from 'src/utils/crypto';
import { withRetry } from 'src/utils/retry';
import { MetaProvider } from '../meta/meta.provider';
import { SettingProvider } from '../setting/setting.provider';
@Injectable()
export class WalineProvider {
  // constructor() {}
  ctx: ChildProcess = null;
  logger = new Logger(WalineProvider.name);
  env = {};
  private readonly controlUrl = process.env['VANBLOG_WALINE_CONTROL_URL'];
  constructor(
    private metaProvider: MetaProvider,
    private readonly settingProvider: SettingProvider,
  ) {}

  mapConfig2Env(config: WalineSetting) {
    const walineEnvMapping = {
      'smtp.port': 'SMTP_PORT',
      'smtp.host': 'SMTP_HOST',
      'smtp.user': 'SMTP_USER',
      'sender.name': 'SENDER_NAME',
      'sender.email': 'SENDER_EMAIL',
      'smtp.password': 'SMTP_PASS',
      authorEmail: 'AUTHOR_EMAIL',
      webhook: 'WEBHOOK',
      forceLoginComment: 'LOGIN',
    };
    const result = {};
    if (!config) {
      return result;
    }
    for (const key of Object.keys(config)) {
      if (key == 'forceLoginComment') {
        if (config.forceLoginComment) {
          result['LOGIN'] = 'force';
        }
      } else if (key == 'otherConfig') {
        if (config.otherConfig) {
          try {
            const data = JSON.parse(config.otherConfig);
            for (const [k, v] of Object.entries(data)) {
              result[k] = v;
            }
          } catch (err) {}
        }
      } else {
        const rKey = walineEnvMapping[key];
        if (rKey) {
          result[rKey] = config[key];
        }
      }
    }
    if (!config['smtp.enabled']) {
      const r2 = {};
      for (const [k, v] of Object.entries(result)) {
        if (
          ![
            'SMTP_PASS',
            'SMTP_USER',
            'SMTP_HOST',
            'SMTP_PORT',
            'SENDER_NAME',
            'SENDER_EMAIL',
          ].includes(k)
        ) {
          r2[k] = v;
        }
      }
      return r2;
    }
    // console.log(result);
    return result;
  }
  private buildMongoEnv() {
    if (config.walineDatabaseUrl) {
      const url = new URL(config.walineDatabaseUrl);
      return {
        MONGO_HOST: url.hostname,
        MONGO_PORT: url.port || '27017',
        MONGO_USER: url.username,
        MONGO_PASSWORD: url.password,
        MONGO_DB: config.walineDB,
        MONGO_AUTHSOURCE: 'admin',
      };
    }

    if (this.isExternalControlMode()) {
      return {
        MONGO_HOST: process.env['WALINE_MONGO_HOST'] || 'mongo',
        MONGO_PORT: process.env['WALINE_MONGO_PORT'] || '27017',
        MONGO_USER: process.env['WALINE_MONGO_USER'] || '',
        MONGO_PASSWORD: process.env['WALINE_MONGO_PASSWORD'] || '',
        MONGO_DB: config.walineDB,
        MONGO_AUTHSOURCE: process.env['WALINE_MONGO_AUTHSOURCE'] || 'admin',
      };
    }

    return null;
  }
  async loadEnv() {
    const mongoEnv = this.buildMongoEnv();
    if (!mongoEnv) {
      this.logger.warn('未配置 Waline 数据库地址，跳过 Waline 内置控制');
      this.env = {};
      return;
    }
    const siteInfo = await this.metaProvider.getSiteInfo();
    const otherEnv = {
      SITE_NAME: siteInfo?.siteName || undefined,
      SITE_URL: undefined,
      JWT_TOKEN: global.jwtSecret || makeSalt(),
    };
    const walineConfig = await this.settingProvider.getWalineSetting();
    const walineConfigEnv = this.mapConfig2Env(walineConfig);
    this.env = {
      ...mongoEnv,
      ...otherEnv,
      ...walineConfigEnv,
    };
    this.logger.log(`waline 配置： ${JSON.stringify(this.env, null, 2)}`);
  }
  async init() {
    this.run();
  }
  private getApiBaseUrl() {
    return config.walineApiUrl?.replace(/\/$/, '') || '';
  }
  async getCommentCounts(paths: string[], lang: string = 'zh-CN') {
    const apiBaseUrl = this.getApiBaseUrl();
    if (!apiBaseUrl || !paths?.length) {
      return paths.map(() => 0);
    }

    try {
      const { data } = await axios.get(`${apiBaseUrl}/comment`, {
        params: {
          type: 'count',
          url: paths.join(','),
          lang,
        },
        timeout: 5000,
      });
      const rawCounts = Array.isArray(data) ? data : [data];
      return rawCounts.map((item) => Number(item) || 0);
    } catch (err) {
      this.logger.warn(`获取 Waline 评论数失败: ${err?.message || err}`);
      return paths.map(() => 0);
    }
  }
  async getCommentCount(path: string, lang: string = 'zh-CN') {
    const [count] = await this.getCommentCounts([path], lang);
    return count || 0;
  }
  async restart(reason: string) {
    this.logger.log(`${reason}重启 waline`);
    if (this.isExternalControlMode()) {
      await this.run();
      return;
    }
    if (this.ctx) {
      await this.stop();
    }
    await this.run();
  }
  async stop() {
    if (this.isExternalControlMode()) {
      try {
        await this.postToExternalControl('/stop');
      } catch (err) {
        this.logger.error(`停止外部 waline 失败: ${err?.message || err}`);
      }
      return;
    }
    if (this.ctx) {
      this.ctx.unref();
      process.kill(-this.ctx.pid);
      this.ctx = null;
      this.logger.log('waline 停止成功！');
    }
  }
  isExternalControlMode() {
    return !!this.controlUrl;
  }
  private getControlBaseUrl() {
    return this.controlUrl?.replace(/\/$/, '');
  }
  private async postToExternalControl(pathname: string, payload: Record<string, any> = {}) {
    return await withRetry(
      async () => {
        await axios.post(`${this.getControlBaseUrl()}${pathname}`, payload);
      },
      {
        attempts: 20,
        delayMs: 3000,
        logger: this.logger,
        description: `同步外部 waline 控制器 ${pathname}`,
      },
    );
  }
  async run(): Promise<any> {
    await this.loadEnv();
    if (!config.walineDatabaseUrl && !this.isExternalControlMode()) {
      return;
    }
    if (this.isExternalControlMode()) {
      try {
        await this.postToExternalControl('/restart', {
          env: this.env,
        });
        this.logger.log('外部 waline 已完成配置同步');
      } catch (err) {
        this.logger.error(`同步外部 waline 配置失败: ${err?.message || err}`);
      }
      return;
    }
    const base = '../waline/node_modules/@waline/vercel/vanilla.js';
    if (this.ctx == null) {
      this.ctx = spawn('node', [base], {
        env: {
          ...process.env,
          ...this.env,
        },
        cwd: process.cwd(),
        detached: true,
      });
      this.ctx.on('message', (message) => {
        this.logger.log(message);
      });
      this.ctx.on('exit', () => {
        this.ctx = null;
        this.logger.warn('Waline 进程退出');
      });
      this.ctx.stdout.on('data', (data) => {
        const t = data.toString();
        if (!t.includes('Cannot find module')) {
          this.logger.log(t.substring(0, t.length - 1));
        }
      });
      this.ctx.stderr.on('data', (data) => {
        const t = data.toString();
        this.logger.error(t.substring(0, t.length - 1));
      });
    } else {
      await this.stop();
      await this.run();
    }
    this.logger.log('Waline 启动成功！');
  }
}
