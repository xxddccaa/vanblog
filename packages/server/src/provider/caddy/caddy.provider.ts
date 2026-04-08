import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import { withRetry } from 'src/utils/retry';
import { SettingProvider } from '../setting/setting.provider';
@Injectable()
export class CaddyProvider {
  subjects: string[] = [];
  logger = new Logger(CaddyProvider.name);
  private readonly apiBaseUrl = (
    process.env['VANBLOG_CADDY_API_URL'] ||
    (process.env.NODE_ENV === 'production' ? 'http://caddy:2019' : 'http://127.0.0.1:2019')
  ).replace(/\/$/, '');
  constructor(private readonly settingProvider: SettingProvider) {}
  async init() {
    try {
      const configInDB = await this.settingProvider.getHttpsSetting();
      await withRetry(
        async () => {
          const result = await this.setRedirect(!!configInDB?.redirect);
          if (result === false) {
            throw new Error('同步 Caddy HTTPS 重定向配置失败');
          }
        },
        {
          attempts: 20,
          delayMs: 3000,
          logger: this.logger,
          description: '同步 Caddy 配置',
        },
      );
      this.logger.log(
        `初始化 caddy 配置完成！https 自动重定向已${configInDB?.redirect ? '开启' : '关闭'}`,
      );
    } catch (err) {
      this.logger.error(`初始化 caddy 配置失败：${err?.message || err}`);
    }
  }
  clearLog() {
    try {
      fs.writeFileSync('/var/log/caddy.log', '');
    } catch (err) {}
  }
  async addSubject(domain: string) {
    if (!this.subjects.includes(domain)) {
      this.subjects.push(domain);
      await this.updateSubjects(this.subjects);
    }
  }

  async setRedirect(redirect: boolean) {
    if (!redirect) {
      try {
        await axios.delete(`${this.apiBaseUrl}/config/apps/http/servers/srv1/listener_wrappers`);
        this.logger.log('https 自动重定向已关闭');
        return '关闭成功！';
      } catch (err) {
        // console.log(err);
        this.logger.error('关闭 https 自动重定向失败');
        return false;
      }
    } else {
      try {
        await axios.post(`${this.apiBaseUrl}/config/apps/http/servers/srv1/listener_wrappers`, [
          {
            wrapper: 'http_redirect',
          },
        ]);
        this.logger.log('https 自动重定向已开启');
        return '开启成功！';
      } catch (err) {
        // console.log(err);
        this.logger.error('开启 https 自动重定向失败');
        return false;
      }
    }
  }

  async getSubjects() {
    try {
      const res = await axios.get(`${this.apiBaseUrl}/config/apps/tls/automation/policies/subjects`);
      return res?.data;
    } catch (err) {
      // console.log(err);
      this.logger.error('更新 subjects 失败，通过 IP 进行 https 访问可能受限');
    }
  }
  async getAutomaticDomains() {
    try {
      const res = await axios.get(`${this.apiBaseUrl}/config/apps/tls/certificates/automate`);
      return res?.data;
    } catch (err) {
      console.log(err);
    }
  }

  async updateSubjects(domains: string[]) {
    try {
      const res = await axios.patch(
        `${this.apiBaseUrl}/config/apps/tls/automation/policies/0/subjects`,
        domains,
      );
      if (res.status == 200) {
        return true;
      }
    } catch (err) {
      console.log(err?.data?.error || err);
    }
    return false;
  }
  async applyHttpsChange(domains: string[]) {
    return await this.updateHttpsDomains([...domains, ...this.subjects]);
  }

  async updateHttpsDomains(domains: string[]) {
    try {
      const res = await axios.patch(
        `${this.apiBaseUrl}/config/apps/tls/certificates/automate`,
        domains,
      );
      if (res.status == 200) {
        return true;
      }
    } catch (err) {
      console.log(err);
    }
    return false;
  }
  async getConfig() {
    try {
      const res = await axios.get(`${this.apiBaseUrl}/config`);
      return res?.data;
    } catch (err) {
      console.log(err);
    }
  }
  async getLog() {
    try {
      const data = fs.readFileSync('/var/log/caddy.log', { encoding: 'utf-8' });
      return data.toString();
    } catch (err) {
      return '';
    }
  }
}
