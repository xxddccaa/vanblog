import { SettingProvider } from './setting.provider';
import { defaultFontSetting } from 'src/types/setting.dto';

describe('SettingProvider font', () => {
  const createProvider = () => {
    const settingModel = {
      create: jest.fn().mockResolvedValue({ _id: 'setting-font' }),
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

  it('creates the default (off) font setting when missing', async () => {
    const { provider, settingModel } = createProvider();
    await expect(provider.getFontSetting()).resolves.toEqual(defaultFontSetting);
    expect(settingModel.create).toHaveBeenCalledWith({
      type: 'font',
      value: defaultFontSetting,
    });
  });

  it('merges persisted font setting over the defaults', async () => {
    const { provider, structuredDataService } = createProvider();
    structuredDataService.getSetting.mockResolvedValue({
      value: { mode: 'preset', scope: 'site' },
    });
    await expect(provider.getFontSetting()).resolves.toEqual({
      mode: 'preset',
      scope: 'site',
      fontFamily: '',
      faces: [],
    });
  });

  it('updateFontSetting merges the patch and upserts', async () => {
    const { provider, structuredDataService, settingModel } = createProvider();
    // 已存在一份 off 记录
    structuredDataService.getSetting.mockResolvedValue({
      value: { mode: 'off', scope: 'body', fontFamily: '', faces: [] },
    });
    await provider.updateFontSetting({
      mode: 'custom',
      fontFamily: '"MyFont", sans-serif',
      faces: [{ family: 'MyFont', src: '/static/font/x.MyFont.woff2' }],
    });
    expect(settingModel.updateOne).toHaveBeenCalledWith(
      { type: 'font' },
      expect.objectContaining({
        type: 'font',
        value: expect.objectContaining({
          mode: 'custom',
          scope: 'body',
          fontFamily: '"MyFont", sans-serif',
          faces: [{ family: 'MyFont', src: '/static/font/x.MyFont.woff2' }],
        }),
      }),
      { upsert: true },
    );
  });
});
