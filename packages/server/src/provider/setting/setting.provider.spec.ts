import { SettingProvider } from './setting.provider';
import { defaultAdminThemeSetting } from 'src/types/setting.dto';

describe('SettingProvider adminTheme', () => {
  const createProvider = () => {
    const settingModel = {
      create: jest.fn().mockResolvedValue({ _id: 'setting-1' }),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
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

    return {
      provider,
      settingModel,
      structuredDataService,
    };
  };

  it('creates the default admin theme when the setting is missing', async () => {
    const { provider, settingModel, structuredDataService } = createProvider();

    await expect(provider.getAdminThemeSetting()).resolves.toEqual(defaultAdminThemeSetting);
    expect(settingModel.create).toHaveBeenCalledWith({
      type: 'adminTheme',
      value: defaultAdminThemeSetting,
    });
    expect(structuredDataService.upsertSetting).toHaveBeenCalledWith(
      'adminTheme',
      defaultAdminThemeSetting,
      'setting-1',
    );
  });

  it('normalizes persisted admin theme colors before returning them', async () => {
    const { provider, structuredDataService } = createProvider();
    structuredDataService.getSetting.mockResolvedValue({
      value: {
        lightPrimaryColor: 'bad-color',
        darkPrimaryColor: '#ABCDEF',
        lightBackgroundColor: '#F5F7FA',
        darkBackgroundColor: 'bad-dark',
      },
    });

    await expect(provider.getAdminThemeSetting()).resolves.toEqual({
      lightPrimaryColor: '#1772b4',
      darkPrimaryColor: '#abcdef',
      lightBackgroundColor: '#f5f7fa',
      darkBackgroundColor: '#111827',
    });
  });

  it('validates and lowercases admin theme colors before persisting them', async () => {
    const { provider, settingModel, structuredDataService } = createProvider();
    structuredDataService.getSetting
      .mockResolvedValueOnce({ value: defaultAdminThemeSetting })
      .mockResolvedValueOnce({ value: defaultAdminThemeSetting });

    await expect(
      provider.updateAdminThemeSetting({
        lightPrimaryColor: '#INVALID',
        darkPrimaryColor: '#ABC123',
        lightBackgroundColor: '#FAFBFC',
        darkBackgroundColor: '#101820',
      }),
    ).resolves.toEqual({
      lightPrimaryColor: '#1772b4',
      darkPrimaryColor: '#abc123',
      lightBackgroundColor: '#fafbfc',
      darkBackgroundColor: '#101820',
    });

    expect(settingModel.updateOne).toHaveBeenCalledWith(
      { type: 'adminTheme' },
      {
        type: 'adminTheme',
        value: {
          lightPrimaryColor: '#1772b4',
          darkPrimaryColor: '#abc123',
          lightBackgroundColor: '#fafbfc',
          darkBackgroundColor: '#101820',
        },
        updatedAt: expect.any(Date),
      },
      { upsert: true },
    );
    expect(structuredDataService.upsertSetting).toHaveBeenCalledWith('adminTheme', {
      lightPrimaryColor: '#1772b4',
      darkPrimaryColor: '#abc123',
      lightBackgroundColor: '#fafbfc',
      darkBackgroundColor: '#101820',
    });
  });
});
