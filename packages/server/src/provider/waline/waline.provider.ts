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
  private readonly reservedWalineEnvKeys = new Set([
    'AUTHOR_EMAIL',
    'JWT_TOKEN',
    'LOGIN',
    'MONGO_AUTHSOURCE',
    'MONGO_DB',
    'MONGO_HOST',
    'MONGO_PASSWORD',
    'MONGO_PORT',
    'MONGO_USER',
    'PG_DB',
    'PG_HOST',
    'PG_PASSWORD',
    'PG_PORT',
    'PG_SSL',
    'PG_USER',
    'PORT',
    'SITE_NAME',
    'SITE_URL',
    'SMTP_HOST',
    'SMTP_PASS',
    'SMTP_PORT',
    'SMTP_USER',
    'SENDER_EMAIL',
    'SENDER_NAME',
    'WEBHOOK',
  ]);
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
              const normalizedKey = String(k || '').trim();
              if (!normalizedKey) {
                continue;
              }
              if (this.reservedWalineEnvKeys.has(normalizedKey)) {
                this.logger.warn(`已忽略保留的 Waline 自定义环境变量: ${normalizedKey}`);
                continue;
              }
              result[normalizedKey] = v;
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
  private compactEnv(target: Record<string, any>) {
    return Object.fromEntries(
      Object.entries(target).filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      ),
    );
  }

  private maskEnvForLog(target: Record<string, any>) {
    const sensitiveKeyPattern = /(PASS|PASSWORD|TOKEN|SECRET|KEY)/i;
    return Object.fromEntries(
      Object.entries(target || {}).map(([key, value]) => [
        key,
        sensitiveKeyPattern.test(key) ? '***' : value,
      ]),
    );
  }

  private getDatabaseNameFromUrl(url: URL) {
    const pathname = url.pathname?.replace(/^\/+/, '');
    return pathname || config.walineDB;
  }

  private buildMongoEnv(url?: URL) {
    // Legacy Mongo compatibility only. PostgreSQL-backed Waline is the primary path now.
    if (url) {
      return this.compactEnv({
        MONGO_HOST: url.hostname,
        MONGO_PORT: url.port || '27017',
        MONGO_USER: decodeURIComponent(url.username || ''),
        MONGO_PASSWORD: decodeURIComponent(url.password || ''),
        MONGO_DB: this.getDatabaseNameFromUrl(url),
        MONGO_AUTHSOURCE: url.searchParams.get('authSource') || 'admin',
      });
    }

    if (this.isExternalControlMode()) {
      return this.compactEnv({
        MONGO_HOST: process.env['WALINE_MONGO_HOST'] || 'mongo',
        MONGO_PORT: process.env['WALINE_MONGO_PORT'] || '27017',
        MONGO_USER: process.env['WALINE_MONGO_USER'] || '',
        MONGO_PASSWORD: process.env['WALINE_MONGO_PASSWORD'] || '',
        MONGO_DB: config.walineDB,
        MONGO_AUTHSOURCE: process.env['WALINE_MONGO_AUTHSOURCE'] || 'admin',
      });
    }

    return null;
  }

  private logLegacyMongoCompatibility(reason: string) {
    this.logger.warn(`Waline MongoDB 仅保留 legacy 兼容支持，非默认推荐路径：${reason}`);
  }

  private buildPostgresEnv(url: URL) {
    return this.compactEnv({
      PG_HOST: url.hostname,
      PG_PORT: url.port || '5432',
      PG_USER: decodeURIComponent(url.username || ''),
      PG_PASSWORD: decodeURIComponent(url.password || ''),
      PG_DB: this.getDatabaseNameFromUrl(url),
      PG_SSL: url.searchParams.get('sslmode') === 'require' ? 'true' : undefined,
    });
  }

  private buildStorageEnv() {
    if (config.walineDatabaseUrl) {
      const url = new URL(config.walineDatabaseUrl);
      const protocol = url.protocol.replace(/:$/, '').toLowerCase();

      if (protocol === 'postgres' || protocol === 'postgresql') {
        return this.buildPostgresEnv(url);
      }

      if (protocol === 'mongodb' || protocol === 'mongodb+srv') {
        this.logLegacyMongoCompatibility('检测到 MongoDB 数据库地址，继续沿用兼容路径');
        return this.buildMongoEnv(url);
      }

      this.logger.warn(`暂不支持的 Waline 数据库协议: ${url.protocol}`);
      return null;
    }

    const legacyMongoEnv = this.buildMongoEnv();
    if (legacyMongoEnv) {
      this.logLegacyMongoCompatibility('未配置 Waline 数据库地址，回退到旧版 Mongo 环境变量');
    }
    return legacyMongoEnv;
  }
  async loadEnv() {
    const storageEnv = this.buildStorageEnv();
    if (!storageEnv) {
      this.logger.warn('未配置 Waline 数据库地址，跳过 Waline 启动配置同步');
      this.env = {};
      return;
    }
    const siteInfo = await this.metaProvider.getSiteInfo();
    const otherEnv = {
      SITE_NAME: siteInfo?.siteName || undefined,
      SITE_URL: siteInfo?.baseUrl || undefined,
      JWT_TOKEN: process.env['WALINE_JWT_TOKEN'] || global.jwtSecret || makeSalt(),
    };
    const walineConfig = await this.settingProvider.getWalineSetting();
    const walineConfigEnv = this.mapConfig2Env(walineConfig);
    this.env = this.compactEnv({
      ...storageEnv,
      ...otherEnv,
      ...walineConfigEnv,
    });
    this.logger.log(
      `waline 配置： ${JSON.stringify(this.maskEnvForLog(this.env), null, 2)}`,
    );
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
  private getControlToken() {
    return process.env['VANBLOG_WALINE_CONTROL_TOKEN'] || process.env['WALINE_JWT_TOKEN'] || '';
  }
  private async postToExternalControl(pathname: string, payload: Record<string, any> = {}) {
    const controlToken = this.getControlToken();
    if (!controlToken) {
      throw new Error('未配置 Waline 控制令牌，拒绝同步外部 Waline');
    }
    return await withRetry(
      async () => {
        await axios.post(`${this.getControlBaseUrl()}${pathname}`, payload, {
          headers: {
            'x-vanblog-control-token': controlToken,
          },
        });
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
