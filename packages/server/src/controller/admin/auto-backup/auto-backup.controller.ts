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
} 