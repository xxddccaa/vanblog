import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { ApiToken } from 'src/provider/swagger/token';
import { AutoBackupSetting } from 'src/types/setting.dto';
import { AutoBackupTask } from 'src/schedule/auto-backup.task';
import { AliyunpanProvider } from 'src/provider/aliyunpan/aliyunpan.provider';
import { config } from 'src/config';

@ApiTags('auto-backup')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/auto-backup')
export class AutoBackupController {
  private readonly logger = new Logger(AutoBackupController.name);

  constructor(
    private readonly settingProvider: SettingProvider,
    private readonly autoBackupTask: AutoBackupTask,
    private readonly aliyunpanProvider: AliyunpanProvider,
  ) {}

  @Get('setting')
  async getSetting() {
    try {
      const setting = await this.settingProvider.getAutoBackupSetting();
      return {
        statusCode: 200,
        data: setting,
      };
    } catch (error) {
      this.logger.error('获取自动备份设置失败', error.stack);
      return {
        statusCode: 500,
        message: '获取设置失败：' + error.message,
      };
    }
  }

  @Put('setting')
  async updateSetting(@Body() dto: AutoBackupSetting) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    try {
      await this.settingProvider.updateAutoBackupSetting(dto);
      
      this.logger.log(`自动备份设置已更新：${dto.enabled ? '启用' : '停用'}，备份时间：${dto.backupTime}`);

      return {
        statusCode: 200,
        data: '设置更新成功！',
      };
    } catch (error) {
      this.logger.error('更新自动备份设置失败', error.stack);
      return {
        statusCode: 500,
        message: '更新设置失败：' + error.message,
      };
    }
  }

  @Post('trigger')
  async triggerBackup() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止执行此操作！',
      };
    }

    try {
      this.logger.log('手动触发备份');
      await this.autoBackupTask.triggerManualBackup();
      return {
        statusCode: 200,
        data: '备份任务已触发！',
      };
    } catch (error) {
      this.logger.error('手动触发备份失败', error.stack);
      return {
        statusCode: 500,
        message: '触发备份失败：' + error.message,
      };
    }
  }

  @Get('files')
  async getBackupFiles() {
    try {
      const files = this.autoBackupTask.getBackupFiles();
      return {
        statusCode: 200,
        data: files,
      };
    } catch (error) {
      this.logger.error('获取备份文件列表失败', error.stack);
      return {
        statusCode: 500,
        message: '获取备份文件列表失败：' + error.message,
      };
    }
  }

  // 阿里云盘相关API
  @Get('aliyunpan/status')
  async getAliyunpanStatus() {
    try {
      const status = await this.aliyunpanProvider.getLoginStatus();
      const quota = status.isLoggedIn ? await this.aliyunpanProvider.getQuotaInfo() : null;
      
      return {
        statusCode: 200,
        data: {
          ...status,
          quota: quota?.quota || null,
        },
      };
    } catch (error) {
      this.logger.error('获取阿里云盘状态失败', error.stack);
      return {
        statusCode: 500,
        message: '获取状态失败：' + error.message,
      };
    }
  }

  @Post('aliyunpan/login')
  async startAliyunpanLogin() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止执行此操作！',
      };
    }

    try {
      const result = await this.aliyunpanProvider.generateLoginUrl();
      
      if (result.error) {
        return {
          statusCode: 500,
          message: result.error,
        };
      }

      return {
        statusCode: 200,
        data: {
          loginUrl: result.loginUrl,
          message: '请在浏览器中打开登录链接完成扫码登录',
        },
      };
    } catch (error) {
      this.logger.error('启动阿里云盘登录失败', error.stack);
      return {
        statusCode: 500,
        message: '启动登录失败：' + error.message,
      };
    }
  }

  @Post('aliyunpan/complete-login')
  async completeAliyunpanLogin() {
    try {
      const result = await this.aliyunpanProvider.completeLogin();
      
      return {
        statusCode: result.success ? 200 : 500,
        message: result.message,
        data: result,
      };
    } catch (error) {
      this.logger.error('完成阿里云盘登录失败', error.stack);
      return {
        statusCode: 500,
        message: '完成登录失败：' + error.message,
      };
    }
  }

  @Post('aliyunpan/check-login')
  async checkAliyunpanLogin() {
    try {
      const result = await this.aliyunpanProvider.checkLoginCompletion();
      
      return {
        statusCode: 200,
        data: result,
      };
    } catch (error) {
      this.logger.error('检查阿里云盘登录状态失败', error.stack);
      return {
        statusCode: 500,
        message: '检查登录状态失败：' + error.message,
      };
    }
  }

  @Post('aliyunpan/logout')
  async logoutAliyunpan() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止执行此操作！',
      };
    }

    try {
      const result = await this.aliyunpanProvider.logout();
      
      return {
        statusCode: result.success ? 200 : 500,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('阿里云盘退出登录失败', error.stack);
      return {
        statusCode: 500,
        message: '退出登录失败：' + error.message,
      };
    }
  }

  @Post('aliyunpan/test')
  async testAliyunpanConnection() {
    try {
      const result = await this.aliyunpanProvider.testConnection();
      
      return {
        statusCode: result.success ? 200 : 500,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('阿里云盘连接测试失败', error.stack);
      return {
        statusCode: 500,
        message: '连接测试失败：' + error.message,
      };
    }
  }

  @Post('aliyunpan/sync')
  async triggerAliyunpanSync() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止执行此操作！',
      };
    }

    try {
      const setting = await this.settingProvider.getAutoBackupSetting();
      
      if (!setting.aliyunpan.enabled) {
        return {
          statusCode: 400,
          message: '阿里云盘备份未启用',
        };
      }

      const result = await this.aliyunpanProvider.executeSync(
        setting.aliyunpan.localPath,
        setting.aliyunpan.panPath
      );
      
      return {
        statusCode: result.success ? 200 : 500,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('阿里云盘同步失败', error.stack);
      return {
        statusCode: 500,
        message: '同步失败：' + error.message,
      };
    }
  }
} 