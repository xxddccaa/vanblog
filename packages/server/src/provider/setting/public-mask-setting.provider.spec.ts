import { SettingProvider } from './setting.provider';
import { defaultPublicMaskSetting } from 'src/utils/publicMask';

describe('SettingProvider publicMask', () => {
  const createProvider = () => {
    const settingModel = {
      create: jest.fn().mockResolvedValue({ _id: 'setting-public-mask' }),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
      find: jest.fn(),
    };
    const structuredDataService = {
      getSetting: jest.fn().mockResolvedValue(null),
      upsertSetting: jest.fn().mockResolvedValue(undefined),
      listSettings: jest.fn().mockResolvedValue([]),
    };
    const provider = new SettingProvider(
      settingModel as any,
      null as any,
      structuredDataService as any,
    );
    return { provider, settingModel, structuredDataService };
  };

  it('returns the disabled default when nothing is stored', async () => {
    const { provider } = createProvider();
    const value = await provider.getPublicMaskSetting();
    expect(value.enabled).toBe(false);
    expect(value.builtins).toEqual(defaultPublicMaskSetting.builtins);
  });

  it('saves a valid setting with an update timestamp', async () => {
    const { provider, structuredDataService } = createProvider();
    const result = await provider.updatePublicMaskSetting({
      enabled: true,
      rules: [{ type: 'keyword', pattern: 'acmecore' }],
    });
    expect(result.errors).toEqual([]);
    expect(result.value?.updatedAt).toEqual(expect.any(String));
    expect(structuredDataService.upsertSetting).toHaveBeenCalledWith(
      'publicMask',
      expect.objectContaining({
        enabled: true,
        rules: [expect.objectContaining({ pattern: 'acmecore' })],
      }),
      'setting-public-mask',
    );
  });

  it('does not save an invalid setting', async () => {
    const { provider, structuredDataService, settingModel } = createProvider();
    const result = await provider.updatePublicMaskSetting({
      rules: [{ type: 'regex', pattern: '(unclosed' }],
    });
    expect(result.errors.map((error) => error.code)).toEqual(['REGEX_INVALID']);
    expect(structuredDataService.upsertSetting).not.toHaveBeenCalled();
    expect(settingModel.create).not.toHaveBeenCalled();
  });

  it('normalizes masking rules restored from a backup', async () => {
    const { provider, structuredDataService } = createProvider();
    await provider.importAllSettings([
      { type: 'publicMask', value: { enabled: 'true', rules: [{ pattern: ' acmecore ' }] } },
    ]);
    expect(structuredDataService.upsertSetting).toHaveBeenCalledWith(
      'publicMask',
      expect.objectContaining({
        enabled: true,
        rules: [expect.objectContaining({ pattern: 'acmecore', type: 'keyword' })],
      }),
      'setting-public-mask',
    );
  });
});
