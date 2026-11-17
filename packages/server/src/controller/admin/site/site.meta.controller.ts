import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UpdateSiteInfoDto } from 'src/types/site.dto';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { config } from 'src/config';
import { WebsiteProvider } from 'src/provider/website/website.provider';
import { PipelineProvider } from 'src/provider/pipeline/pipeline.provider';
import { ApiToken } from 'src/provider/swagger/token';
import { PrivateSiteProvider } from 'src/provider/private-site/private-site.provider';
@ApiTags('site')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/meta/site')
export class SiteMetaController {
  constructor(
    private readonly metaProvider: MetaProvider,
    private readonly isrProvider: ISRProvider,
    private readonly websiteProvider: WebsiteProvider,
    private readonly pipelineProvider: PipelineProvider,
    private readonly privateSiteProvider: PrivateSiteProvider,
  ) {}

  @Get()
  async get() {
    const data = await this.metaProvider.getSiteInfo();
    return {
      statusCode: 200,
      data,
    };
  }

  @Put()
  async update(@Body() updateDto: UpdateSiteInfoDto) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const previous: any = await this.metaProvider.getSiteInfo();
    const data = await this.metaProvider.updateSiteInfo(updateDto);
    await this.privateSiteProvider.handleSiteInfoUpdated(
      previous?.privateSite,
      (updateDto as any)?.privateSite ?? previous?.privateSite,
    );
    this.pipelineProvider.dispatchEvent('updateSiteInfo', updateDto);
    this.isrProvider.activeAll('更新站点配置触发增量渲染！');
    this.websiteProvider.restart('更新站点信息');
    return {
      statusCode: 200,
      data,
    };
  }
}
