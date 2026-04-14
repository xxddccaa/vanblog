import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { CustomPage, CustomPageDocument } from 'src/scheme/customPage.schema';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { normalizeCustomPageRoutePath } from 'src/utils/customPagePath';

@Injectable()
export class CustomPageProvider {
  constructor(
    @InjectModel('CustomPage')
    private customPageModal: Model<CustomPageDocument>,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  private projectPage(page: any, includeHtml: boolean) {
    if (!page) {
      return page;
    }
    const payload = { ...(page?._doc || page) };
    if (!includeHtml) {
      delete payload.html;
    }
    return payload;
  }

  async createCustomPage(dto: CustomPage) {
    const normalizedPath = normalizeCustomPageRoutePath(dto.path);
    const payload = {
      ...dto,
      path: normalizedPath,
    };
    const old = await this.customPageModal.findOne({ path: normalizedPath });
    if (old) {
      throw new ForbiddenException('已有此路由的自定义页面！无法重复创建！');
    }
    const created = await this.customPageModal.create(payload);
    await this.structuredDataService.upsertCustomPage(
      created.toObject ? created.toObject() : created,
    );
    return created;
  }

  async updateCustomPage(dto: CustomPage) {
    const normalizedPath = normalizeCustomPageRoutePath(dto.path);
    const current = await this.getCustomPageByPath(normalizedPath);
    const payload = {
      ...(current?._doc || current || {}),
      ...dto,
      path: normalizedPath,
      updatedAt: new Date(),
      _id: current?._id,
    };
    const result = await this.customPageModal.updateOne({ path: normalizedPath }, payload);
    if (current) {
      await this.structuredDataService.upsertCustomPage(payload);
    }
    return result;
  }

  async getCustomPageByPath(path: string) {
    const normalizedPath = normalizeCustomPageRoutePath(path);
    const page = await this.structuredDataService.getCustomPageByPath(normalizedPath);
    if (page || this.structuredDataService.isInitialized()) {
      return page as any;
    }
    return await this.customPageModal.findOne({ path: normalizedPath });
  }

  async getAll(includeHtml = false) {
    const pages = await this.structuredDataService.listCustomPages(includeHtml);
    if (pages.length || this.structuredDataService.isInitialized()) {
      return pages.map((page: any) => this.projectPage(page, includeHtml)) as any;
    }
    return await this.customPageModal.find({}, includeHtml ? undefined : { html: 0 });
  }

  async deleteByPath(path: string) {
    const normalizedPath = normalizeCustomPageRoutePath(path);
    const result = await this.customPageModal.deleteOne({ path: normalizedPath });
    await this.structuredDataService.deleteCustomPageByPath(normalizedPath);
    return result;
  }
}
