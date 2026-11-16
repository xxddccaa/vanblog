import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { config } from 'src/config/index';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { PublicMaskProvider } from 'src/provider/public-mask/public-mask.provider';
import { PublicMaskScanService } from 'src/provider/public-mask/public-mask-scan.service';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { ApiToken } from 'src/provider/swagger/token';
import {
  compilePublicMask,
  PublicMaskCompileError,
  PublicMaskSetting,
  validatePublicMaskSetting,
} from 'src/utils/publicMask';

const MAX_PREVIEW_CHARS = 200_000;

const isDemo = () => config?.demo == true || config?.demo == 'true';

/**
 * Admin API for public output masking. The route sits under /api/admin/setting,
 * which the access guard restricts to the super admin.
 */
@ApiTags('public-mask')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/setting/public-mask')
export class PublicMaskController {
  constructor(
    private readonly settingProvider: SettingProvider,
    private readonly publicMaskProvider: PublicMaskProvider,
    private readonly isrProvider: ISRProvider,
    private readonly scanService: PublicMaskScanService,
  ) {}

  private getStatus(setting: PublicMaskSetting) {
    try {
      const masker = compilePublicMask(setting);
      return { ok: true, active: masker.active, version: masker.version };
    } catch (error) {
      return {
        ok: false,
        active: false,
        code: error instanceof PublicMaskCompileError ? error.code : 'UNKNOWN',
      };
    }
  }

  /** Validates an optional draft setting, falling back to the saved one. */
  private async resolveDraft(draft: unknown) {
    const source = draft ?? (await this.settingProvider.getPublicMaskSetting());
    return validatePublicMaskSetting(source);
  }

  @Get()
  async getSetting() {
    if (isDemo()) {
      return { statusCode: 200, data: null };
    }
    const setting = await this.settingProvider.getPublicMaskSetting();
    return { statusCode: 200, data: { setting, status: this.getStatus(setting) } };
  }

  @Put()
  async updateSetting(@Body() body: unknown) {
    if (isDemo()) {
      return { statusCode: 401, message: '演示站禁止修改此项！' };
    }
    const { value, errors } = await this.settingProvider.updatePublicMaskSetting(body);
    if (errors.length) {
      return { statusCode: 400, message: 'Invalid public mask setting', data: { errors } };
    }
    this.publicMaskProvider.invalidate();
    // Rebuilding feeds can take a while on large sites; run it in the background.
    void this.isrProvider.refreshForPublicMaskChange('Public mask rules updated');
    return { statusCode: 200, data: { setting: value, status: this.getStatus(value) } };
  }

  /** Masks sample text with a draft (or the saved) setting, as if masking were enabled. */
  @Post('preview')
  async preview(@Body() body: { setting?: unknown; text?: string }) {
    const { value, errors } = await this.resolveDraft(body?.setting);
    if (errors.length) {
      return { statusCode: 200, data: { errors } };
    }
    const text = String(body?.text ?? '').slice(0, MAX_PREVIEW_CHARS);
    const masker = compilePublicMask({ ...value, enabled: true });
    return {
      statusCode: 200,
      data: { masked: masker.mask(text), hits: masker.findHits(text, 200), errors: [] },
    };
  }

  /** Reports where a draft (or the saved) setting would change public output. */
  @Post('scan')
  async scan(@Body() body: { setting?: unknown }) {
    const { value, errors } = await this.resolveDraft(body?.setting);
    if (errors.length) {
      return { statusCode: 200, data: { errors } };
    }
    const masker = compilePublicMask({ ...value, enabled: true });
    return { statusCode: 200, data: { ...(await this.scanService.scan(masker)), errors: [] } };
  }
}
