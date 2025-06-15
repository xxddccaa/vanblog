import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { CategoryProvider } from 'src/provider/category/category.provider';
import { DraftProvider } from 'src/provider/draft/draft.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { TagProvider } from 'src/provider/tag/tag.provider';
import { UserProvider } from 'src/provider/user/user.provider';
import { ViewerProvider } from 'src/provider/viewer/viewer.provider';
import { VisitProvider } from 'src/provider/visit/visit.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { MomentProvider } from 'src/provider/moment/moment.provider';
import { CustomPageProvider } from 'src/provider/customPage/customPage.provider';
import { PipelineProvider } from 'src/provider/pipeline/pipeline.provider';
import { TokenProvider } from 'src/provider/token/token.provider';
import { NavToolProvider } from 'src/provider/nav-tool/nav-tool.provider';
import { NavCategoryProvider } from 'src/provider/nav-category/nav-category.provider';
import { IconProvider } from 'src/provider/icon/icon.provider';
import { AITaggingProvider } from 'src/provider/ai-tagging/ai-tagging.provider';
import { AliyunpanProvider } from 'src/provider/aliyunpan/aliyunpan.provider';

@Injectable()
export class AutoBackupTask {
  private readonly logger = new Logger(AutoBackupTask.name);
  private readonly backupDir = '/app/static/blog-json';

  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly categoryProvider: CategoryProvider,
    private readonly tagProvider: TagProvider,
    private readonly metaProvider: MetaProvider,
    private readonly draftProvider: DraftProvider,
    private readonly userProvider: UserProvider,
    private readonly viewerProvider: ViewerProvider,
    private readonly visitProvider: VisitProvider,
    private readonly settingProvider: SettingProvider,
    private readonly staticProvider: StaticProvider,
    private readonly momentProvider: MomentProvider,
    private readonly customPageProvider: CustomPageProvider,
    private readonly pipelineProvider: PipelineProvider,
    private readonly tokenProvider: TokenProvider,
    private readonly navToolProvider: NavToolProvider,
    private readonly navCategoryProvider: NavCategoryProvider,
    private readonly iconProvider: IconProvider,
    private readonly aiTaggingProvider: AITaggingProvider,
    private readonly aliyunpanProvider: AliyunpanProvider,
  ) {
    this.ensureBackupDirectoryExists();
    this.initializeDynamicTasks();
  }

  private ensureBackupDirectoryExists() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      this.logger.log(`创建备份目录: ${this.backupDir}`);
    }
  }

  // 初始化动态定时任务
  async initializeDynamicTasks() {
    try {
      const backupSetting = await this.getAutoBackupSetting();
      await this.updateBackupSchedule(backupSetting);
      await this.updateAliyunpanSchedule(backupSetting);
    } catch (error) {
      this.logger.error('初始化动态任务失败:', error.message);
    }
  }

  // 私有变量存储定时任务
  private backupTimer: any = null;

  // 更新备份定时任务
  async updateBackupSchedule(setting: any) {
    // 清除旧定时器
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
      this.backupTimer = null;
      this.logger.log('清除旧的备份定时任务');
    }

    // 如果启用备份，创建新任务
    if (setting.enabled) {
      this.scheduleNextBackup(setting.backupTime);
      this.logger.log(`创建备份定时任务: 每天 ${setting.backupTime} 执行`);
    }
  }

  // 计划下一次备份
  private scheduleNextBackup(backupTime: string) {
    const [hour, minute] = backupTime.split(':').map(Number);
    const now = dayjs();
    let nextRun = now.hour(hour).minute(minute).second(0).millisecond(0);
    
    // 如果今天的时间已过，设置为明天
    if (nextRun.isBefore(now)) {
      nextRun = nextRun.add(1, 'day');
    }

    const delay = nextRun.diff(now);
    this.logger.log(`下次备份时间: ${nextRun.format('YYYY-MM-DD HH:mm:ss')}, 距离现在: ${Math.round(delay / 1000 / 60)} 分钟`);

    this.backupTimer = setTimeout(async () => {
      this.logger.log('执行定时备份...');
      await this.executeBackup();
      await this.cleanupOldBackups();
      this.logger.log('定时备份完成');
      
      // 设置下一次备份（24小时后）
      this.scheduleNextBackup(backupTime);
    }, delay);
  }

  // 私有变量存储阿里云盘同步定时任务
  private aliyunpanTimer: any = null;

  // 更新阿里云盘同步定时任务
  async updateAliyunpanSchedule(setting: any) {
    // 清除旧定时器
    if (this.aliyunpanTimer) {
      clearTimeout(this.aliyunpanTimer);
      this.aliyunpanTimer = null;
      this.logger.log('清除旧的阿里云盘同步定时任务');
    }

    // 如果启用阿里云盘同步，创建新任务
    if (setting.aliyunpan.enabled) {
      this.scheduleNextAliyunpanSync(setting.aliyunpan.syncTime);
      this.logger.log(`创建阿里云盘同步定时任务: 每天 ${setting.aliyunpan.syncTime} 执行`);
    }
  }

  // 计划下一次阿里云盘同步
  private scheduleNextAliyunpanSync(syncTime: string) {
    const [hour, minute] = syncTime.split(':').map(Number);
    const now = dayjs();
    let nextRun = now.hour(hour).minute(minute).second(0).millisecond(0);
    
    // 如果今天的时间已过，设置为明天
    if (nextRun.isBefore(now)) {
      nextRun = nextRun.add(1, 'day');
    }

    const delay = nextRun.diff(now);
    this.logger.log(`下次阿里云盘同步时间: ${nextRun.format('YYYY-MM-DD HH:mm:ss')}, 距离现在: ${Math.round(delay / 1000 / 60)} 分钟`);

    this.aliyunpanTimer = setTimeout(async () => {
      this.logger.log('执行定时阿里云盘同步...');
      await this.executeAliyunpanSync();
      this.logger.log('定时阿里云盘同步完成');
      
      // 设置下一次同步（24小时后）
      this.scheduleNextAliyunpanSync(syncTime);
    }, delay);
  }

  private async getAutoBackupSetting() {
    try {
      return await this.settingProvider.getAutoBackupSetting();
    } catch (error) {
      this.logger.warn('获取自动备份设置失败，使用默认设置');
      return {
        enabled: false,
        backupTime: '03:00',
        retentionCount: 10,
        aliyunpan: {
          enabled: false,
          syncTime: '03:30',
          localPath: '/app/static',
          panPath: '/backup/vanblog-static',
        },
      };
    }
  }

  async executeBackup() {
    try {
      // 获取所有数据
      const [
        articles,
        categories,
        tags,
        meta,
        drafts,
        user,
        viewer,
        visit,
        staticSetting,
        staticItems,
        moments,
        customPages,
        pipelines,
        tokens,
        navTools,
        navCategories,
        icons,
        layoutSetting,
        aiTaggingConfig,
      ] = await Promise.all([
        this.articleProvider.getAll('admin', true),
        this.categoryProvider.getAllCategories(),
        this.tagProvider.getAllTags(true),
        this.metaProvider.getAll(),
        this.draftProvider.getAll(),
        this.userProvider.getUser(),
        this.viewerProvider.getAll(),
        this.visitProvider.getAll(),
        this.settingProvider.getStaticSetting(),
        this.staticProvider.exportAll(),
        this.momentProvider.getByOption({ page: 1, pageSize: -1 }, false).then(result => result.moments),
        this.customPageProvider.getAll(),
        this.pipelineProvider.getAll(),
        this.tokenProvider.getAllAPIToken(),
        this.navToolProvider.getAllTools(),
        this.navCategoryProvider.getAllCategories(),
        this.iconProvider.getAllIcons(),
        this.settingProvider.getLayoutSetting(),
        this.aiTaggingProvider.getConfig(),
      ]);

      const data = {
        articles,
        tags,
        meta,
        drafts,
        categories,
        user,
        viewer,
        visit,
        static: staticItems,
        setting: { static: staticSetting },
        moments,
        customPages,
        pipelines,
        tokens,
        navTools,
        navCategories,
        icons,
        layoutSetting,
        aiTaggingConfig,
        backupInfo: {
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          dataTypes: [
            'articles', 'tags', 'meta', 'drafts', 'categories', 'user',
            'viewer', 'visit', 'static', 'setting', 'moments', 'customPages',
            'pipelines', 'tokens', 'navTools', 'navCategories', 'icons',
            'layoutSetting', 'aiTaggingConfig'
          ],
          counts: {
            articles: articles?.length || 0,
            drafts: drafts?.length || 0,
            moments: moments?.length || 0,
            categories: categories?.length || 0,
            tags: tags?.length || 0,
            customPages: customPages?.length || 0,
            pipelines: pipelines?.length || 0,
            tokens: tokens?.length || 0,
            navTools: navTools?.length || 0,
            navCategories: navCategories?.length || 0,
            icons: icons?.length || 0,
            staticItems: staticItems?.length || 0,
            layoutSetting: layoutSetting ? 1 : 0,
            aiTaggingConfig: aiTaggingConfig ? 1 : 0,
          }
        }
      };

      // 生成文件名 (和导出功能保持一致的命名格式)
      const fileName = `vanblog-backup-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
      const filePath = path.join(this.backupDir, fileName);

      // 写入文件
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      this.logger.log(`自动备份完成: ${fileName}`);
    } catch (error) {
      this.logger.error('执行备份失败:', error.message);
      throw error;
    }
  }

  private async cleanupOldBackups() {
    try {
      const backupSetting = await this.getAutoBackupSetting();
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('vanblog-backup-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // 按修改时间降序排列

      // 保留最新的 retentionCount 个文件
      const filesToDelete = files.slice(backupSetting.retentionCount);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        this.logger.log(`删除过期备份: ${file.name}`);
      }

      if (filesToDelete.length > 0) {
        this.logger.log(`清理了 ${filesToDelete.length} 个过期备份文件，保留最新的 ${backupSetting.retentionCount} 个文件`);
      }
    } catch (error) {
      this.logger.error('清理过期备份失败:', error.message);
    }
  }

  // 执行阿里云盘同步
  async executeAliyunpanSync() {
    try {
      const backupSetting = await this.getAutoBackupSetting();
      
      this.logger.log(`开始执行阿里云盘同步 - 本地路径: ${backupSetting.aliyunpan.localPath}, 云盘路径: ${backupSetting.aliyunpan.panPath}`);
      
      // 检查登录状态
      const loginStatus = await this.aliyunpanProvider.getLoginStatus();
      if (!loginStatus.isLoggedIn) {
        this.logger.error('阿里云盘未登录，无法执行同步');
        return;
      }
      
      this.logger.log('阿里云盘登录状态正常，开始上传文件...');

      // 执行同步
      const result = await this.aliyunpanProvider.executeSync(
        backupSetting.aliyunpan.localPath,
        backupSetting.aliyunpan.panPath
      );

      if (result.success) {
        this.logger.log('阿里云盘同步成功: ' + result.message);
      } else {
        this.logger.error('阿里云盘同步失败:', result.message);
      }
    } catch (error) {
      this.logger.error('执行阿里云盘同步时发生错误:', error.message);
    }
  }

  // 手动触发备份（用于测试或立即备份）
  async triggerManualBackup() {
    this.logger.log('触发手动备份');
    await this.executeBackup();
    await this.cleanupOldBackups();
  }

  // 手动触发阿里云盘同步
  async triggerAliyunpanSync() {
    this.logger.log('触发手动阿里云盘同步');
    await this.executeAliyunpanSync();
  }

  // 获取备份文件列表
  getBackupFiles() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('vanblog-backup-') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
        })
        .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime()); // 按修改时间降序排列

      return files;
    } catch (error) {
      this.logger.error('获取备份文件列表失败:', error.message);
      return [];
    }
  }
} 