import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { config } from 'src/config';
import { MetaProvider } from '../meta/meta.provider';
import { washUrl } from 'src/utils/washUrl';

@Injectable()
export class CloudflareCacheProvider {
  private readonly logger = new Logger(CloudflareCacheProvider.name);

  constructor(private readonly metaProvider: MetaProvider) {}

  private isEnabled() {
    return Boolean(config.cloudflareApiToken && config.cloudflareZoneId);
  }

  private getEndpoint() {
    return `https://api.cloudflare.com/client/v4/zones/${config.cloudflareZoneId}/purge_cache`;
  }

  private async toAbsoluteUrls(urls: string[]) {
    const siteInfo = await this.metaProvider.getSiteInfo();
    const baseUrl = washUrl(siteInfo?.baseUrl || '');

    if (!baseUrl) {
      return [];
    }

    return urls
      .filter(Boolean)
      .map((url) => {
        if (/^https?:\/\//.test(url)) {
          return url;
        }
        return new URL(url.startsWith('/') ? url : `/${url}`, baseUrl).toString();
      });
  }

  private async purge(payload: Record<string, any>, reason: string) {
    if (!this.isEnabled()) {
      return;
    }

    await axios.post(this.getEndpoint(), payload, {
      headers: {
        Authorization: `Bearer ${config.cloudflareApiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    this.logger.log(`已请求 Cloudflare 缓存清理: ${reason}`);
  }

  async purgeByTags(tags: string[], reason: string) {
    const uniqueTags = [...new Set((tags || []).filter(Boolean))];
    if (!uniqueTags.length || !this.isEnabled()) {
      return;
    }

    try {
      await this.purge({ tags: uniqueTags }, `${reason} [tags]`);
    } catch (err) {
      this.logger.warn(`Cloudflare tag purge 失败: ${err?.message || err}`);
    }
  }

  async purgeByUrls(urls: string[], reason: string) {
    if (!urls?.length || !this.isEnabled()) {
      return;
    }

    try {
      const files = await this.toAbsoluteUrls(urls);
      if (!files.length) {
        this.logger.warn(`Cloudflare URL purge 已跳过，站点 baseUrl 未配置: ${reason}`);
        return;
      }
      await this.purge({ files }, `${reason} [files]`);
    } catch (err) {
      this.logger.warn(`Cloudflare URL purge 失败: ${err?.message || err}`);
    }
  }

  async purgeByTagsAndUrls(tags: string[], urls: string[], reason: string) {
    await Promise.all([this.purgeByTags(tags, reason), this.purgeByUrls(urls, reason)]);
  }
}
