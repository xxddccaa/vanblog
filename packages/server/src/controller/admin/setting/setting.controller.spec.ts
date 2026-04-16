import { SettingController } from './setting.controller';
import { defaultAdminThemeSetting } from 'src/types/setting.dto';

describe('SettingController adminTheme', () => {
  const createController = () => {
    const settingProvider = {
      getAdminThemeSetting: jest.fn().mockResolvedValue(defaultAdminThemeSetting),
      updateAdminThemeSetting: jest.fn().mockResolvedValue(defaultAdminThemeSetting),
    };
    const walineProvider = {
      restart: jest.fn(),
    };
    const isrProvider = {
      activeAll: jest.fn().mockResolvedValue('ok'),
    };

    return {
      controller: new SettingController(
        settingProvider as any,
        walineProvider as any,
        isrProvider as any,
      ),
      settingProvider,
      isrProvider,
    };
  };

  it('returns the persisted admin theme config', async () => {
    const { controller } = createController();

    await expect(controller.getAdminThemeSetting()).resolves.toEqual({
      statusCode: 200,
      data: defaultAdminThemeSetting,
    });
  });

  it('updates admin theme config and refreshes public site-info cache', async () => {
    const { controller, settingProvider, isrProvider } = createController();
    const payload = {
      lightPrimaryColor: '#123456',
      darkPrimaryColor: '#abcdef',
      lightBackgroundColor: '#f3f6fb',
      darkBackgroundColor: '#101828',
    };

    await expect(controller.updateAdminThemeSetting(payload as any)).resolves.toEqual({
      statusCode: 200,
      data: defaultAdminThemeSetting,
    });
    expect(settingProvider.updateAdminThemeSetting).toHaveBeenCalledWith(payload);
    expect(isrProvider.activeAll).toHaveBeenCalledWith('更新 admin theme 设置');
  });

  it('resets admin theme config without touching admin layout settings', async () => {
    const { controller, settingProvider, isrProvider } = createController();

    await expect(controller.resetAdminThemeToDefault()).resolves.toEqual({
      statusCode: 200,
      data: defaultAdminThemeSetting,
      message: '恢复默认后台主题色设置成功！',
    });
    expect(settingProvider.updateAdminThemeSetting).toHaveBeenCalledWith(defaultAdminThemeSetting);
    expect(isrProvider.activeAll).toHaveBeenCalledWith('恢复默认后台主题色设置触发增量渲染！');
  });
});
