import { SettingProvider } from './setting.provider';
import { defaultAdminThemeSetting } from 'src/types/setting.dto';
import { decode } from 'js-base64';

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
      darkBackgroundColor: '#111315',
    });
  });

  it('upgrades the old built-in blue dark preset to the new graphite preset', async () => {
    const { provider, structuredDataService } = createProvider();
    structuredDataService.getSetting.mockResolvedValue({
      value: {
        lightPrimaryColor: '#1772b4',
        darkPrimaryColor: '#60a5fa',
        lightBackgroundColor: '#f4f8fb',
        darkBackgroundColor: '#111827',
      },
    });

    await expect(provider.getAdminThemeSetting()).resolves.toEqual(defaultAdminThemeSetting);
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

  describe('encodeLayoutSetting animations', () => {
    it('generates and appends css and script for all enabled animation types', () => {
      const { provider } = createProvider();

      const encoded = provider.encodeLayoutSetting({
        css: '.custom { color: red; }',
        script: 'console.log("custom");',
        animations: {
          enabled: true,
          snowflake: { enabled: true, count: 20 },
          particles: { enabled: true, count: 30 },
          heartClick: { enabled: true },
          mouseDrag: { enabled: true },
        },
      } as any);

      const css = decode(encoded.css);
      const script = decode(encoded.script);

      expect(css).toContain('.custom { color: red; }');
      expect(css).toContain('.snow-container');
      expect(css).toContain('.particles-canvas');
      expect(css).toContain('.heart-particle');
      expect(css).toContain('.mouse-drag-canvas');

      expect(script).toContain('console.log("custom");');
      expect(script).toContain('class SnowflakeSystem');
      expect(script).toContain('class CanvasNest');
      expect(script).toContain('heart-particle');
      expect(script).toContain('class MouseDragSystem');
    });

    it('creates css and script fields when animations are enabled without existing css/script', () => {
      const { provider } = createProvider();

      const encoded = provider.encodeLayoutSetting({
        animations: {
          snowflake: { enabled: true },
        },
      } as any);

      expect(decode(encoded.css)).toContain('.snow-container');
      expect(decode(encoded.script)).toContain('class SnowflakeSystem');
    });

    it('omits animation code when all animations are disabled', () => {
      const { provider } = createProvider();

      const encoded = provider.encodeLayoutSetting({
        css: '.only-custom {}',
        script: 'window.__x = 1;',
        animations: {
          enabled: false,
          snowflake: { enabled: false },
          particles: { enabled: false },
          heartClick: { enabled: false },
          mouseDrag: { enabled: false },
        },
      } as any);

      expect(decode(encoded.css)).toBe('.only-custom {}');
      expect(decode(encoded.script)).toBe('window.__x = 1;');
    });
  });
});
