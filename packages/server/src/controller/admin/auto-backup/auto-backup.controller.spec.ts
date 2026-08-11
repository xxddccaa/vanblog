import { BadRequestException } from '@nestjs/common';
import { AutoBackupController } from './auto-backup.controller';

describe('AutoBackupController', () => {
  const createController = () => {
    const settingProvider = { updateAutoBackupSetting: jest.fn() };
    const autoBackupTask = {
      updateBackupSchedule: jest.fn(),
      updateAliyunpanSchedule: jest.fn(),
    };
    return {
      controller: new AutoBackupController(
        settingProvider as any,
        autoBackupTask as any,
        {} as any,
      ),
      settingProvider,
    };
  };

  it('rejects invalid clock values and retention counts at runtime', async () => {
    const { controller, settingProvider } = createController();

    await expect(
      controller.updateSetting({
        enabled: true,
        backupTime: '25:99',
        retentionCount: 0,
        aliyunpan: {
          enabled: false,
          syncTime: '03:30',
          localPath: '/app/static',
          panPath: '/backup',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(settingProvider.updateAutoBackupSetting).not.toHaveBeenCalled();
  });

  it('accepts a valid automatic backup schedule', async () => {
    const { controller, settingProvider } = createController();
    const setting = {
      enabled: true,
      backupTime: '03:00',
      retentionCount: 10,
      aliyunpan: {
        enabled: true,
        syncTime: '03:30',
        localPath: '/app/static',
        panPath: '/backup',
      },
    };

    await expect(controller.updateSetting(setting)).resolves.toEqual({
      statusCode: 200,
      data: '设置更新成功，定时任务已重新安排！',
    });
    expect(settingProvider.updateAutoBackupSetting).toHaveBeenCalledWith(setting);
  });
});
