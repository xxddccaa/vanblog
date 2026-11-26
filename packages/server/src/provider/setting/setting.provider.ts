import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import {
  HttpsSetting,
  ISRSetting,
  LayoutSetting,
  LoginSetting,
  MenuSetting,
  StaticSetting,
  VersionSetting,
  defaultStaticSetting,
  AdminLayoutSetting,
  defaultAdminLayoutSetting,
  AdminThemeSetting,
  defaultAdminThemeSetting,
  AutoBackupSetting,
  defaultAutoBackupSetting,
  MusicSetting,
  defaultMusicSetting,
  FontSetting,
  defaultFontSetting,
} from 'src/types/setting.dto';
import { SettingDocument } from 'src/scheme/setting.schema';
import { encode } from 'js-base64';
import { defaultMenu, MenuItem } from 'src/types/menu.dto';
import { MetaProvider } from '../meta/meta.provider';
import { parseHtmlToHeadTagArr } from './htmlParser';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { generateAnimationCode } from './animation-code.generator';
import { AdminCommentSetting, CommentSetting } from 'src/types/comment.dto';
import {
  applyCommentSettingUpdate,
  maskCommentSetting,
  normalizeStoredCommentSetting,
} from 'src/utils/commentSetting';
import {
  normalizePublicMaskSetting,
  PublicMaskSetting,
  PublicMaskValidationError,
  validatePublicMaskSetting,
} from 'src/utils/publicMask';
@Injectable()
export class SettingProvider {
  logger = new Logger(SettingProvider.name);
  private static readonly adminThemeColorPattern = /^#[0-9a-f]{6}$/i;

  constructor(
    @InjectModel('Setting')
    private settingModel: Model<SettingDocument>,
    @Optional()
    private readonly metaProvider: MetaProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  private async findSettingRecord(type: string) {
    return await this.structuredDataService.getSetting(type);
  }

  private async createSettingValue(type: string, value: any) {
    const result = await this.settingModel.create({
      type,
      value,
    });
    await this.structuredDataService.upsertSetting(type, value, result?._id);
    return result;
  }

  private async writeSettingValue(type: string, value: any) {
    const result = await this.settingModel.updateOne(
      { type },
      {
        type,
        value,
        updatedAt: new Date(),
      },
      { upsert: true },
    );
    await this.structuredDataService.upsertSetting(type, value);
    return result;
  }

  private async upsertSettingValue(type: string, value: any) {
    const existing = await this.findSettingRecord(type);
    if (!existing) {
      return await this.createSettingValue(type, value);
    }
    return await this.writeSettingValue(type, value);
  }

  async getStaticSetting(): Promise<Partial<StaticSetting>> {
    const res = (await this.findSettingRecord('static')) as {
      value: StaticSetting;
    };
    if (res) {
      return res?.value || defaultStaticSetting;
    } else {
      await this.createSettingValue('static', defaultStaticSetting);
      return defaultStaticSetting;
    }
  }
  async getVersionSetting(): Promise<any> {
    const res = await this.findSettingRecord('version');
    if (res) {
      return res?.value;
    }
    return null;
  }
  async getISRSetting(): Promise<any> {
    const res = await this.findSettingRecord('isr');
    if (res) {
      return res?.value;
    } else {
      await this.createSettingValue('isr', {
        mode: 'onDemand',
      });
      return {
        mode: 'onDemand',
      };
    }
  }
  async updateISRSetting(dto: ISRSetting) {
    const oldValue = await this.getISRSetting();
    const newValue = { ...oldValue, ...dto };
    return await this.upsertSettingValue('isr', newValue);
  }
  async getMenuSetting(): Promise<any> {
    const res = await this.findSettingRecord('menu');
    if (res) {
      return res?.value;
    }
    return null;
  }
  async updateMenuSetting(dto: MenuSetting) {
    const oldValue = await this.getMenuSetting();
    const newValue = { ...oldValue, ...dto };
    return await this.upsertSettingValue('menu', newValue);
  }
  async importSetting(setting: any) {
    for (const [k, v] of Object.entries(setting)) {
      if (k == 'static') {
        await this.importStaticSetting(v as any);
      }
    }
  }
  async importStaticSetting(dto: StaticSetting) {
    await this.updateStaticSetting(dto);
  }
  async exportAllSettings() {
    const settings = await this.structuredDataService.listSettings();
    if (settings.length) {
      return settings;
    }
    return await this.settingModel.find({}).lean().exec();
  }
  async importAllSettings(settings: Array<{ type: string; value: any }>, overwrite = false) {
    for (const setting of settings || []) {
      if (!setting?.type) {
        continue;
      }

      if (setting.type === 'publicMask') {
        // Restore masking rules as a whole and normalize their shape. Invalid rules
        // are kept on purpose: public output then fails closed until they are fixed.
        await this.upsertSettingValue('publicMask', normalizePublicMaskSetting(setting.value));
        continue;
      }

      const payload = {
        type: setting.type,
        value: setting.value,
        updatedAt: new Date(),
      };

      if (overwrite) {
        await this.settingModel.updateOne({ type: setting.type }, payload, { upsert: true });
        await this.structuredDataService.upsertSetting(setting.type, setting.value);
        continue;
      }

      const existing = await this.findSettingRecord(setting.type);
      if (!existing) {
        await this.settingModel.create(payload);
        await this.structuredDataService.upsertSetting(setting.type, setting.value);
      } else {
        const mergedValue = { ...(existing.value || {}), ...(setting.value || {}) };
        await this.settingModel.updateOne(
          { type: setting.type },
          { value: mergedValue, updatedAt: new Date() },
        );
        await this.structuredDataService.upsertSetting(setting.type, mergedValue, existing._id);
      }
    }
  }
  async getHttpsSetting(): Promise<HttpsSetting> {
    const res = await this.findSettingRecord('https');
    if (res) {
      return (res?.value as any) || { redirect: false };
    }
    return null;
  }
  async getLayoutSetting(): Promise<LayoutSetting> {
    const res = await this.findSettingRecord('layout');
    if (res) {
      return res?.value as any;
    }
    return null;
  }
  async getAdminLayoutSetting(): Promise<AdminLayoutSetting> {
    const res = await this.findSettingRecord('adminLayout');
    if (res) {
      return this.normalizeAdminLayoutSetting(res?.value as AdminLayoutSetting);
    } else {
      await this.createSettingValue('adminLayout', defaultAdminLayoutSetting);
      return defaultAdminLayoutSetting;
    }
  }

  private normalizeAdminThemeColor(value: unknown, fallback: string) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();

    if (SettingProvider.adminThemeColorPattern.test(normalized)) {
      return normalized;
    }

    return fallback;
  }

  private normalizeAdminThemeSetting(value?: Partial<AdminThemeSetting> | null): AdminThemeSetting {
    const normalized = {
      lightPrimaryColor: this.normalizeAdminThemeColor(
        value?.lightPrimaryColor,
        defaultAdminThemeSetting.lightPrimaryColor,
      ),
      darkPrimaryColor: this.normalizeAdminThemeColor(
        value?.darkPrimaryColor,
        defaultAdminThemeSetting.darkPrimaryColor,
      ),
      lightBackgroundColor: this.normalizeAdminThemeColor(
        value?.lightBackgroundColor,
        defaultAdminThemeSetting.lightBackgroundColor,
      ),
      darkBackgroundColor: this.normalizeAdminThemeColor(
        value?.darkBackgroundColor,
        defaultAdminThemeSetting.darkBackgroundColor,
      ),
    };

    const shouldUpgradeLegacyTheme =
      normalized.lightPrimaryColor === '#1772b4' &&
      normalized.darkPrimaryColor === '#60a5fa' &&
      normalized.lightBackgroundColor === '#f4f8fb' &&
      normalized.darkBackgroundColor === '#111827';

    return shouldUpgradeLegacyTheme ? defaultAdminThemeSetting : normalized;
  }

  private normalizeAdminLayoutSetting(
    value?: Partial<AdminLayoutSetting> | null,
  ): AdminLayoutSetting {
    const persistedItems = Array.isArray(value?.menuItems) ? value.menuItems : [];
    const persistedByKey = new Map(persistedItems.map((item) => [item?.key, item]));
    const defaultOrderByKey = new Map(
      defaultAdminLayoutSetting.menuItems.map((item, index) => [item.key, index]),
    );

    const normalizedItems = defaultAdminLayoutSetting.menuItems
      .map((defaultItem) => {
        const persistedItem = persistedByKey.get(defaultItem.key);
        return {
          ...defaultItem,
          ...(persistedItem || {}),
          key: defaultItem.key,
          path: defaultItem.path,
          originalName: defaultItem.originalName,
          order: typeof persistedItem?.order === 'number' ? persistedItem.order : defaultItem.order,
          visible:
            typeof persistedItem?.visible === 'boolean'
              ? persistedItem.visible
              : defaultItem.visible,
        };
      })
      .sort((a, b) => {
        if (a.order === b.order) {
          return (defaultOrderByKey.get(a.key) || 0) - (defaultOrderByKey.get(b.key) || 0);
        }
        return a.order - b.order;
      })
      .map((item, index) => ({
        ...item,
        order: index,
      }));

    return {
      menuItems: normalizedItems,
    };
  }

  async getAdminThemeSetting(): Promise<AdminThemeSetting> {
    const res = await this.findSettingRecord('adminTheme');
    if (res?.value) {
      return this.normalizeAdminThemeSetting(res.value as AdminThemeSetting);
    }

    await this.createSettingValue('adminTheme', defaultAdminThemeSetting);
    return defaultAdminThemeSetting;
  }
  async getLoginSetting(): Promise<LoginSetting> {
    const res = await this.findSettingRecord('login');
    if (res) {
      return (
        (res?.value as any) || {
          enableMaxLoginRetry: false,
          maxRetryTimes: 3,
          durationSeconds: 60,
          expiresIn: 3600 * 24 * 7,
        }
      );
    }
    return null;
  }
  encodeLayoutSetting(dto: LayoutSetting) {
    if (!dto) {
      return null;
    }
    const res: any = {};

    // 首先处理动画，生成额外的CSS和Script
    let additionalCss = '';
    let additionalScript = '';

    // 如果总开关启用，或者任何子动画启用，都生成动画代码
    const hasAnyAnimationEnabled =
      dto.animations &&
      (dto.animations.enabled ||
        dto.animations.snowflake?.enabled ||
        dto.animations.particles?.enabled ||
        dto.animations.heartClick?.enabled ||
        dto.animations.mouseDrag?.enabled);

    if (hasAnyAnimationEnabled) {
      const animationCode = generateAnimationCode(dto.animations);
      additionalCss = animationCode.css || '';
      additionalScript = animationCode.script || '';
    }

    // 然后处理其他字段
    for (const key of Object.keys(dto)) {
      if (key == 'head') {
        res[key] = parseHtmlToHeadTagArr(dto[key]);
      } else if (key == 'animations') {
        // 保存动画配置
        res[key] = dto[key];
      } else if (key == 'css') {
        // 合并原有CSS和动画CSS
        const existingCss = dto[key] || '';
        const finalCss = existingCss + (additionalCss ? '\n' + additionalCss : '');
        res[key] = encode(finalCss);
      } else if (key == 'script') {
        // 合并原有Script和动画Script
        const existingScript = dto[key] || '';
        const finalScript = existingScript + (additionalScript ? '\n' + additionalScript : '');
        res[key] = encode(finalScript);
      } else {
        res[key] = encode(dto[key]);
      }
    }

    // 如果没有原始的css/script字段但有动画代码，需要添加它们
    if (additionalCss && !dto.css) {
      res.css = encode(additionalCss);
    }
    if (additionalScript && !dto.script) {
      res.script = encode(additionalScript);
    }

    return res;
  }

  async updateLoginSetting(dto: LoginSetting) {
    const oldValue = await this.getLoginSetting();
    const newValue = { ...oldValue, ...dto };
    return await this.upsertSettingValue('login', newValue);
  }
  async updateVersionSetting(dto: VersionSetting) {
    const oldValue = await this.getVersionSetting();
    const newValue = { ...oldValue, ...dto };
    return await this.upsertSettingValue('version', newValue);
  }

  async updateLayoutSetting(dto: LayoutSetting) {
    const oldValue = await this.getLayoutSetting();
    const newValue = { ...(oldValue || {}), ...dto };
    return await this.upsertSettingValue('layout', newValue);
  }
  async updateAdminLayoutSetting(dto: AdminLayoutSetting) {
    const oldValue = await this.getAdminLayoutSetting();
    const newValue = this.normalizeAdminLayoutSetting({ ...oldValue, ...dto });
    return await this.upsertSettingValue('adminLayout', newValue);
  }
  async updateAdminThemeSetting(dto: AdminThemeSetting) {
    const newValue = this.normalizeAdminThemeSetting(dto);
    await this.upsertSettingValue('adminTheme', newValue);
    return newValue;
  }
  async updateHttpsSetting(dto: HttpsSetting) {
    const oldValue = await this.getHttpsSetting();
    const newValue = { ...oldValue, ...dto };
    return await this.upsertSettingValue('https', newValue);
  }
  async updateStaticSetting(dto: Partial<StaticSetting>) {
    const oldValue = await this.getStaticSetting();
    const newValue = { ...oldValue, ...dto };
    return await this.upsertSettingValue('static', newValue);
  }
  async washDefaultMenu() {
    const r = await this.findSettingRecord('menu');
    if (!r) {
      // 没有的话需要清洗
      const toInsert: MenuItem[] = defaultMenu;
      const meta = await this.metaProvider.getAll();
      const oldMenus = meta?.menus || [];
      const d = Date.now();
      oldMenus.forEach((item: any, index: number) => {
        toInsert.push({
          id: d + index,
          level: 0,
          name: item.name,
          value: item.value,
        });
      });
      await this.updateMenuSetting({ data: toInsert });
      this.logger.log('清洗老 menu 数据成功！');
    }
  }

  async getAutoBackupSetting(): Promise<AutoBackupSetting> {
    const setting = await this.findSettingRecord('autoBackup');
    if (!setting || !setting.value) {
      return defaultAutoBackupSetting;
    }

    // 类型断言，因为我们知道这是 AutoBackupSetting 类型
    const autoBackupValue = setting.value as AutoBackupSetting;

    // 合并默认设置以确保新增字段有默认值
    return {
      ...defaultAutoBackupSetting,
      ...autoBackupValue,
      aliyunpan: {
        ...defaultAutoBackupSetting.aliyunpan,
        ...(autoBackupValue.aliyunpan || {}),
      },
    };
  }

  async updateAutoBackupSetting(setting: AutoBackupSetting): Promise<void> {
    await this.upsertSettingValue('autoBackup', setting);
  }

  async getMusicSetting(): Promise<MusicSetting> {
    const res = await this.findSettingRecord('music');
    if (res) {
      return res?.value as any;
    } else {
      await this.createSettingValue('music', defaultMusicSetting);
      return defaultMusicSetting;
    }
  }

  async getMusicSettingRecord(): Promise<{
    value: MusicSetting;
    updatedAt?: Date | string;
  } | null> {
    const res = await this.findSettingRecord('music');
    if (res) {
      return {
        value: (res?.value as any) || defaultMusicSetting,
        updatedAt: res?.updatedAt,
      };
    }

    await this.createSettingValue('music', defaultMusicSetting);
    return {
      value: defaultMusicSetting,
    };
  }

  async updateMusicSetting(dto: Partial<MusicSetting>) {
    const oldValue = await this.getMusicSetting();
    const newValue = { ...oldValue, ...dto };

    const existingSetting = await this.findSettingRecord('music');
    const res = await this.upsertSettingValue('music', newValue);
    this.logger.log(existingSetting ? '音乐设置已更新' : '音乐设置已创建');
    return res;
  }

  async getFontSetting(): Promise<FontSetting> {
    const res = await this.findSettingRecord('font');
    if (res) {
      return { ...defaultFontSetting, ...(res?.value as any) };
    } else {
      await this.createSettingValue('font', defaultFontSetting);
      return defaultFontSetting;
    }
  }

  async updateFontSetting(dto: Partial<FontSetting>) {
    const oldValue = await this.getFontSetting();
    const newValue = { ...oldValue, ...dto };

    const existingSetting = await this.findSettingRecord('font');
    const res = await this.upsertSettingValue('font', newValue);
    this.logger.log(existingSetting ? '字体设置已更新' : '字体设置已创建');
    return res;
  }

  async getCommentSetting(): Promise<CommentSetting> {
    const res = await this.findSettingRecord('comment');
    return normalizeStoredCommentSetting(res?.value);
  }

  /** Same as getCommentSetting but safe to return to the admin UI. */
  async getAdminCommentSetting(): Promise<AdminCommentSetting> {
    return maskCommentSetting(await this.getCommentSetting());
  }

  /** Validates and merges a partial update. Throws BadRequestException on invalid input. */
  async updateCommentSetting(input: unknown): Promise<AdminCommentSetting> {
    const next = applyCommentSettingUpdate(await this.getCommentSetting(), input);
    await this.upsertSettingValue('comment', next);
    return maskCommentSetting(next);
  }

  async getPublicMaskSetting(): Promise<PublicMaskSetting> {
    const res = await this.findSettingRecord('publicMask');
    return normalizePublicMaskSetting(res?.value);
  }

  /** Validates and replaces the whole masking setting. Nothing is saved on errors. */
  async updatePublicMaskSetting(
    input: unknown,
  ): Promise<{ value?: PublicMaskSetting; errors: PublicMaskValidationError[] }> {
    const { value, errors } = validatePublicMaskSetting(input);
    if (errors.length) {
      return { errors };
    }
    const saved: PublicMaskSetting = { ...value, updatedAt: new Date().toISOString() };
    await this.upsertSettingValue('publicMask', saved);
    this.logger.log(`Public mask setting saved (${saved.rules.length} rules)`);
    return { value: saved, errors: [] };
  }
}
