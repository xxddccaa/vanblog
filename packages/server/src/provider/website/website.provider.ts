import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { withRetry } from 'src/utils/retry';
import { MetaProvider } from '../meta/meta.provider';
import { SettingProvider } from '../setting/setting.provider';

const ignoreWebsiteWarnings = [
  'Experimental features are not covered by semver',
  'You have enabled experimental feature',
  'Invalid next.config.js options',
  'The value at .experimental has an',
  '(node:62) ExperimentalWarning',
  'null',
];

@Injectable()
export class WebsiteProvider {
  // constructor() {}
  ctx: ChildProcess = null;
  logger = new Logger(WebsiteProvider.name);
  private readonly controlUrl = process.env['VANBLOG_WEBSITE_CONTROL_URL'];
  constructor(
    private metaProvider: MetaProvider,
    private settingProvider: SettingProvider,
  ) {}
  private maskEnvForLog(target: Record<string, any>) {
    const sensitiveKeyPattern = /(PASS|PASSWORD|TOKEN|SECRET|KEY)/i;
    return Object.fromEntries(
      Object.entries(target || {}).map(([key, value]) => [
        key,
        sensitiveKeyPattern.test(key) ? '***' : value,
      ]),
    );
  }
  async init() {
    this.run();
  }
  async loadEnv() {
    const meta = await this.metaProvider.getAll();
    const isrConfig = await this.settingProvider.getISRSetting();
    const isrEnv =
      isrConfig.mode == 'delay'
        ? {
            VAN_BLOG_REVALIDATE: 'true',
            VAN_BLOG_REVALIDATE_TIME: isrConfig.delay,
          }
        : {
            VAN_BLOG_REVALIDATE: 'false',
          };
    const sharedIsrEnv = {
      VANBLOG_ISR_TOKEN: process.env['VANBLOG_ISR_TOKEN'] || process.env['WALINE_JWT_TOKEN'] || '',
      WALINE_JWT_TOKEN: process.env['WALINE_JWT_TOKEN'] || '',
    };
    if (!meta?.siteInfo) return { ...sharedIsrEnv, ...isrEnv };
    const siteinfo = meta.siteInfo;
    const socials = meta.socials || [];
    const urls = [];
    const addEach = (u: string) => {
      if (!u) return null;
      try {
        const url = new URL(u);
        if (url?.host) {
          if (!urls.includes(url?.host)) {
            urls.push(url?.host);
          }
        }
      } catch (err) {
        return null;
      }
    };
    addEach(siteinfo?.baseUrl);
    addEach(siteinfo?.siteLogo);
    addEach(siteinfo?.authorLogo);
    addEach(siteinfo?.authorLogoDark);
    addEach(siteinfo?.payAliPay);
    addEach(siteinfo?.payAliPayDark);
    addEach(siteinfo?.payWechat);
    addEach(siteinfo?.payWechatDark);
    const wechatItem = socials.find((s) => s.type == 'wechat');
    if (wechatItem) {
      addEach(wechatItem?.value);
    }
    const wechatDarkItem = socials.find((s) => s.type == 'wechat-dark');
    if (wechatDarkItem) {
      addEach(wechatDarkItem?.value);
    }
    return {
      VAN_BLOG_ALLOW_DOMAINS: urls.join(','),
      ...sharedIsrEnv,
      ...isrEnv,
    };
  }
  async restart(reason: string) {
    this.logger.log(`${reason}重启 website`);
    if (this.isExternalControlMode()) {
      await this.run();
      return;
    }
    if (this.ctx) {
      await this.stop();
    }
  }
  async restore(reason: string) {
    this.logger.log(`${reason}`);
    if (this.ctx) this.ctx = null;
    await this.run();
  }
  async stop(noMessage?: boolean) {
    if (this.isExternalControlMode()) {
      try {
        await this.postToExternalControl('/stop');
      } catch (err) {
        this.logger.error(`停止外部 website 失败: ${err?.message || err}`);
      }
      return;
    }
    if (this.ctx) {
      this.ctx.unref();
      process.kill(-this.ctx.pid);
      this.ctx = null;
      if (noMessage) return;
      this.logger.log('website 停止成功！');
    }
  }
  isExternalControlMode() {
    return !!this.controlUrl;
  }
  private getControlBaseUrl() {
    return this.controlUrl?.replace(/\/$/, '');
  }
  private getControlToken() {
    return (
      process.env['VANBLOG_WEBSITE_CONTROL_TOKEN'] ||
      process.env['VANBLOG_ISR_TOKEN'] ||
      process.env['WALINE_JWT_TOKEN'] ||
      ''
    );
  }
  private async postToExternalControl(pathname: string, payload: Record<string, any> = {}) {
    const controlToken = this.getControlToken();
    if (!controlToken) {
      throw new Error('未配置 website 控制令牌，拒绝同步外部 website');
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
        description: `同步外部 website 控制器 ${pathname}`,
      },
    );
  }
  async run(): Promise<any> {
    if (this.isExternalControlMode()) {
      const loadEnvs = await this.loadEnv();
      try {
        await this.postToExternalControl('/restart', {
          env: loadEnvs,
        });
        this.logger.log('外部 website 已完成配置同步');
      } catch (err) {
        this.logger.error(`同步外部 website 配置失败: ${err?.message || err}`);
      }
      return;
    }
    if (process.env['VANBLOG_DISABLE_WEBSITE'] === 'true') {
      this.logger.log('无 website 模式');
      return;
    }
    let cmd = 'pnpm';
    let args = ['dev'];
    if (process.env.NODE_ENV == 'production') {
      cmd = 'node';
      args = ['./packages/website/server.js'];
    }
    const loadEnvs = await this.loadEnv();
    this.logger.log(JSON.stringify(this.maskEnvForLog(loadEnvs), null, 2));
    if (this.ctx == null) {
      this.ctx = spawn(cmd, args, {
        env: {
          ...process.env,
          ...loadEnvs,
          HOSTNAME: '0.0.0.0',
        },
        cwd: path.join(path.resolve(process.cwd(), '..'), 'website'),
        detached: true,
        shell: process.platform === 'win32',
      });
      this.ctx.on('message', (message) => {
        this.logger.log(message);
      });
      this.ctx.on('exit', async () => {
        await this.restore('website 进程退出，自动重启');
      });
      this.ctx.stdout.on('data', (data) => {
        const t: string = data.toString();
        this.logger.log(t.substring(0, t.length - 1));
      });
      this.ctx.stderr.on('data', (data) => {
        const t: string = data.toString();

        let showLog = true;
        for (const each of ignoreWebsiteWarnings) {
          if (t.includes(each)) showLog = false;
        }
        if (showLog) {
          this.logger.error(t.substring(0, t.length - 1));
        }
      });
    } else {
      this.logger.log('Website 启动成功！');
    }
  }
}
