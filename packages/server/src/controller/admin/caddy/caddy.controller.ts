import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  Logger,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { config } from 'src/config';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { HttpsSetting } from 'src/types/setting.dto';
import { CaddyProvider } from 'src/provider/caddy/caddy.provider';
import { isIpv4 } from 'src/utils/ip';
import { ApiToken } from 'src/provider/swagger/token';
import { MetaProvider } from 'src/provider/meta/meta.provider';

@ApiTags('caddy')
@ApiToken
@Controller('/api/admin/caddy')
export class CaddyController {
  private readonly logger = new Logger(CaddyController.name);
  constructor(
    private readonly settingProvider: SettingProvider,
    private readonly caddyProvider: CaddyProvider,
    private readonly metaProvider: MetaProvider,
  ) {}

  private async getAllowedOnDemandHosts() {
    const baseUrl = String((await this.metaProvider.getSiteInfo())?.baseUrl || '').trim();
    if (!baseUrl) {
      return new Set<string>();
    }

    try {
      return new Set([new URL(baseUrl).hostname.toLowerCase()]);
    } catch {
      return new Set<string>();
    }
  }
  @UseGuards(...AdminGuard)
  @Get('https')
  async getHttpsConfig() {
    const config = await this.settingProvider.getHttpsSetting();
    return {
      statusCode: 200,
      data: {
        ...config,
        managedByVanblog: this.caddyProvider.isHttpsManagedByVanblog(),
      },
    };
  }

  @Get('ask')
  async askOnDemand(@Query('domain') domain: string) {
    const candidate = String(domain || '').trim().toLowerCase();
    const is = isIpv4(candidate);
    const allowedHosts = await this.getAllowedOnDemandHosts();

    if (!this.caddyProvider.isHttpsManagedByVanblog()) {
      this.logger.warn('内置 HTTPS 管理未开启，拒绝按需证书请求');
      throw new BadRequestException();
    }
    if (!is) {
      if (allowedHosts.has(candidate)) {
        return 'is Domain, on damand https';
      }
      this.logger.warn(`拒绝未授权域名的按需证书请求: ${candidate}`);
      throw new BadRequestException();
    } else {
      // 增加到 subjects 中
      this.logger.log('试图通过 ip + https 访问，已驳回');
      // this.caddyProvider.addSubject(domain);
      throw new BadRequestException();
    }
  }
  @UseGuards(...AdminGuard)
  @Delete('log')
  async clearLog() {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    await this.caddyProvider.clearLog();
    return {
      statusCode: 200,
      data: '清除 Caddy 运行日志成功！',
    };
  }
  @UseGuards(...AdminGuard)
  @Get('log')
  async getCaddyLog() {
    const log = await this.caddyProvider.getLog();
    return {
      statusCode: 200,
      data: log,
    };
  }
  @UseGuards(...AdminGuard)
  @Get('config')
  async getCaddyConfig() {
    const caddyConfig = await this.caddyProvider.getConfig();
    return {
      statusCode: 200,
      data: JSON.stringify(caddyConfig, null, 2),
    };
  }
  @UseGuards(...AdminGuard)
  @Put('https')
  async updateHttpsConfig(@Body() dto: HttpsSetting) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    if (!this.caddyProvider.isHttpsManagedByVanblog()) {
      return {
        statusCode: 400,
        message: '当前部署未启用 VanBlog 内置 Caddy HTTPS 管理，请自行在外部 Caddy 中配置 TLS。',
      };
    }
    const result = await this.caddyProvider.setRedirect(dto.redirect || false);
    if (!result) {
      return {
        statusCode: 500,
        message: '更新失败！请查看 Caddy 日志获取详细信息！',
      };
    }
    await this.settingProvider.updateHttpsSetting(dto);
    return {
      statusCode: 200,
      data: '更新成功！',
    };
  }
}
