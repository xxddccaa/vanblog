import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { CategoryProvider } from 'src/provider/category/category.provider';
import { DraftProvider } from 'src/provider/draft/draft.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { TagProvider } from 'src/provider/tag/tag.provider';
import { UserProvider } from 'src/provider/user/user.provider';
import * as fs from 'fs';
import dayjs from 'dayjs';
import { FileInterceptor } from '@nestjs/platform-express';
import { removeID } from 'src/utils/removeId';
import { ViewerProvider } from 'src/provider/viewer/viewer.provider';
import { VisitProvider } from 'src/provider/visit/visit.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { config } from 'src/config';
import { ApiToken } from 'src/provider/swagger/token';
import { MomentProvider } from 'src/provider/moment/moment.provider';
import { CustomPageProvider } from 'src/provider/customPage/customPage.provider';
import { PipelineProvider } from 'src/provider/pipeline/pipeline.provider';
import { TokenProvider } from 'src/provider/token/token.provider';
import { NavToolProvider } from 'src/provider/nav-tool/nav-tool.provider';
import { NavCategoryProvider } from 'src/provider/nav-category/nav-category.provider';
import { IconProvider } from 'src/provider/icon/icon.provider';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { AITaggingProvider } from 'src/provider/ai-tagging/ai-tagging.provider';
import { DocumentProvider } from 'src/provider/document/document.provider';
import { MindMapProvider } from 'src/provider/mindmap/mindmap.provider';
import { MongoBackupProvider } from 'src/provider/mongo-backup/mongo-backup.provider';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { BackupImportJobProvider } from 'src/provider/backup-import-job/backup-import-job.provider';

interface PreparedImportPayload {
  backupVersion: string;
  currentAdmin: any;
  canRestoreProtectedData: boolean;
  includeAnalytics: boolean;
  meta: any;
  user: any;
  users: any[];
  setting: any;
  settings: any[];
  layoutSetting: any;
  aiTaggingConfig: any;
  categories: any[];
  tags: any[];
  articles: any[];
  drafts: any[];
  viewer: any[];
  visit: any[];
  staticItems: any[];
  moments: any[];
  customPages: any[];
  pipelines: any[];
  tokens: any[];
  navTools: any[];
  navCategories: any[];
  icons: any[];
  documents: any[];
  mindMaps: any[];
}

@ApiTags('backup')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);
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
    private readonly isrProvider: ISRProvider,
    private readonly aiTaggingProvider: AITaggingProvider,
    private readonly documentProvider: DocumentProvider,
    private readonly mindMapProvider: MindMapProvider,
    private readonly mongoBackupProvider: MongoBackupProvider,
    private readonly structuredDataService: StructuredDataService,
    private readonly backupImportJobProvider: BackupImportJobProvider,
  ) {}

  private async refreshStructuredData(
    reason: string,
    collections?: Array<'articles' | 'drafts' | 'documents' | 'moments'>,
  ) {
    try {
      if (collections?.length) {
        await this.structuredDataService.refreshCollectionsFromRecordStore(collections, reason);
        return;
      }
      await this.structuredDataService.refreshAllFromRecordStore(reason);
    } catch (error) {
      this.logger.error(`结构化数据同步失败(${reason}): ${error.message}`);
    }
  }

  private cloneAdminSnapshot(currentAdmin: any) {
    if (!currentAdmin) {
      return currentAdmin;
    }
    if (typeof currentAdmin.toObject === 'function') {
      return currentAdmin.toObject();
    }
    return JSON.parse(JSON.stringify(currentAdmin));
  }

  private sanitizeArray(items: any[] | undefined, useRemoveId = true) {
    if (!items?.length) {
      return [];
    }
    return useRemoveId ? removeID(items) : items.map((item) => ({ ...item }));
  }

  private shouldReportProgress(processed: number, total: number) {
    if (processed <= 1 || processed === total) {
      return true;
    }
    if (total <= 20) {
      return true;
    }
    if (total <= 200) {
      return processed % 5 === 0;
    }
    if (total <= 2000) {
      return processed % 20 === 0;
    }
    return processed % 50 === 0;
  }

  private getImportConcurrency(total: number, max = 8) {
    if (total <= 1) {
      return 1;
    }
    return Math.max(1, Math.min(max, total));
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
  ) {
    if (!items?.length) {
      return;
    }

    const runnerCount = Math.max(1, Math.min(concurrency, items.length));
    let cursor = 0;

    await Promise.all(
      Array.from({ length: runnerCount }, async () => {
        while (true) {
          const currentIndex = cursor++;
          if (currentIndex >= items.length) {
            return;
          }
          await worker(items[currentIndex], currentIndex);
        }
      }),
    );
  }

  private parseIncludeAnalyticsFlag(value: any) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return false;
  }

  private sanitizeTokensForBackup(_tokens: any[]) {
    return [];
  }

  private sanitizeRawCollectionsForBackup(rawCollections: Record<string, any[]>) {
    return {
      ...(rawCollections || {}),
      tokens: [],
    };
  }

  private buildImportSummary(prepared: PreparedImportPayload) {
    return {
      backupVersion: prepared.backupVersion,
      includeAnalytics: prepared.includeAnalytics,
      counts: {
        articles: prepared.articles.length,
        drafts: prepared.drafts.length,
        moments: prepared.moments.length,
        documents: prepared.documents.length,
        mindMaps: prepared.mindMaps.length,
        settings: prepared.settings?.length || 0,
        staticItems: prepared.staticItems.length,
        tokens: prepared.tokens.length,
        visit: prepared.visit.length,
        viewer: prepared.viewer.length,
      },
    };
  }

  private buildImportStages(prepared: PreparedImportPayload) {
    const stages: Array<{ key: string; label: string; total?: number }> = [];
    if (!prepared.canRestoreProtectedData) {
      stages.push({ key: 'cleanupExisting', label: '清理现有站点数据', total: 1 });
    }
    if ((prepared.users?.length || 0) > 0 || prepared.currentAdmin?.id !== undefined) {
      stages.push({
        key: 'users',
        label: '恢复管理员账号',
        total: Math.max(prepared.users?.length || 0, 1),
      });
    }
    if (prepared.meta) {
      stages.push({ key: 'meta', label: '恢复站点信息', total: 1 });
    }
    if ((prepared.settings?.length || 0) > 0 || prepared.setting) {
      stages.push({
        key: 'settings',
        label: '恢复系统设置',
        total: Math.max(prepared.settings?.length || 0, 1),
      });
    }
    if (prepared.categories.length > 0) {
      stages.push({ key: 'categories', label: '恢复分类', total: prepared.categories.length });
    }
    if (prepared.articles.length > 0) {
      stages.push({ key: 'articles', label: '恢复文章', total: prepared.articles.length });
    }
    if (prepared.drafts.length > 0) {
      stages.push({ key: 'drafts', label: '恢复草稿', total: prepared.drafts.length });
    }
    if (prepared.moments.length > 0) {
      stages.push({ key: 'moments', label: '恢复动态', total: prepared.moments.length });
    }
    if (prepared.customPages.length > 0) {
      stages.push({
        key: 'customPages',
        label: '恢复自定义页面',
        total: prepared.customPages.length,
      });
    }
    if (prepared.navCategories.length > 0) {
      stages.push({
        key: 'navCategories',
        label: '恢复导航分类',
        total: prepared.navCategories.length,
      });
    }
    if (prepared.navTools.length > 0) {
      stages.push({ key: 'navTools', label: '恢复导航工具', total: prepared.navTools.length });
    }
    if (prepared.icons.length > 0) {
      stages.push({ key: 'icons', label: '恢复图标', total: prepared.icons.length });
    }
    if (prepared.pipelines.length > 0) {
      stages.push({ key: 'pipelines', label: '恢复流水线', total: prepared.pipelines.length });
    }
    if (prepared.tokens.length > 0) {
      stages.push({ key: 'tokens', label: '恢复 Token', total: prepared.tokens.length });
    }
    if (prepared.staticItems.length > 0) {
      stages.push({
        key: 'staticItems',
        label: '恢复静态文件记录',
        total: prepared.staticItems.length,
      });
    }
    stages.push({
      key: 'analytics',
      label: '访问统计数据',
      total: Math.max(prepared.visit.length + prepared.viewer.length, 1),
    });
    if (prepared.layoutSetting && Object.keys(prepared.layoutSetting).length > 0) {
      stages.push({ key: 'layoutSetting', label: '恢复定制化设置', total: 1 });
    }
    if (prepared.aiTaggingConfig && Object.keys(prepared.aiTaggingConfig).length > 0) {
      stages.push({ key: 'aiTaggingConfig', label: '恢复 AI 标签配置', total: 1 });
    }
    if (prepared.documents.length > 0) {
      stages.push({ key: 'documents', label: '恢复私密文档', total: prepared.documents.length });
    }
    if (prepared.mindMaps.length > 0) {
      stages.push({ key: 'mindMaps', label: '恢复思维导图', total: prepared.mindMaps.length });
    }
    stages.push({ key: 'structuredData', label: '同步结构化数据', total: 1 });
    stages.push({ key: 'syncTags', label: '同步标签与前台缓存', total: 1 });
    return stages;
  }

  private getStructuredCollectionsForImport(prepared: PreparedImportPayload) {
    const collections: Array<'articles' | 'drafts' | 'documents' | 'moments'> = [];
    if (prepared.articles.length > 0) {
      collections.push('articles');
    }
    if (prepared.drafts.length > 0) {
      collections.push('drafts');
    }
    if (prepared.moments.length > 0) {
      collections.push('moments');
    }
    if (prepared.documents.length > 0) {
      collections.push('documents');
    }
    return collections;
  }

  private async prepareImportPayload(
    file: Express.Multer.File,
    includeAnalytics = false,
  ): Promise<PreparedImportPayload> {
    const json = file.buffer.toString();
    const data = this.normalizeBackupPayload(JSON.parse(json));
    const currentAdmin = await this.userProvider.getUser();
    const canRestoreProtectedData = await this.canRestoreProtectedData();
    const backupVersion = data.backupInfo?.version || '1.0.0';

    const prepared: PreparedImportPayload = {
      backupVersion,
      currentAdmin: this.cloneAdminSnapshot(currentAdmin),
      canRestoreProtectedData,
      includeAnalytics,
      meta: data.meta ? { ...data.meta } : undefined,
      user: data.user ? { ...data.user } : undefined,
      users: this.sanitizeArray(data.users),
      setting: data.setting ? { ...data.setting } : undefined,
      settings: this.sanitizeArray(data.settings, false),
      layoutSetting: data.layoutSetting,
      aiTaggingConfig: data.aiTaggingConfig,
      categories: Array.isArray(data.categories)
        ? data.categories.map((item: any) => ({ ...item }))
        : [],
      tags: Array.isArray(data.tags) ? data.tags.map((item: any) => ({ ...item })) : [],
      articles: this.sanitizeArray(data.articles),
      drafts: this.sanitizeArray(data.drafts),
      viewer: includeAnalytics ? this.sanitizeArray(data.viewer) : [],
      visit: includeAnalytics ? this.sanitizeArray(data.visit) : [],
      staticItems: this.sanitizeArray(data.static),
      moments: this.sanitizeArray(data.moments),
      customPages: this.sanitizeArray(data.customPages),
      pipelines: this.sanitizeArray(data.pipelines),
      tokens: [],
      navTools: this.sanitizeArray(data.navTools),
      navCategories: this.sanitizeArray(data.navCategories),
      icons: this.sanitizeArray(data.icons),
      documents: this.sanitizeArray(data.documents),
      mindMaps: Array.isArray(data.mindMaps)
        ? data.mindMaps.map((item: any) => {
            const payload = { ...item };
            delete payload.__v;
            return payload;
          })
        : [],
    };

    if (prepared.setting?.static) {
      prepared.setting.static = {
        ...prepared.setting.static,
        _id: undefined,
        __v: undefined,
      };
    }
    if (prepared.user) {
      delete prepared.user._id;
      delete prepared.user.__v;
    }
    if (prepared.meta) {
      delete prepared.meta._id;
      delete prepared.meta.__v;
    }
    if (Array.isArray(data?.tokens) && data.tokens.length > 0) {
      this.logger.warn('检测到备份文件包含 Token，出于安全原因已忽略这些凭证数据');
    }
    return prepared;
  }

  @Get('export')
  async getAll(@Res() res: Response) {
    try {
      this.logger.log('开始导出完整站点 JSON...');

      const [
        articles,
        categories,
        tags,
        meta,
        drafts,
        user,
        users,
        viewer,
        visit,
        staticSetting,
        allSettings,
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
        documents,
        mindMaps,
        rawCollections,
      ] = await Promise.all([
        this.articleProvider.getAll('admin', true),
        this.categoryProvider.getAllCategories(true),
        this.tagProvider.getAllTagRecords(),
        this.metaProvider.getAll(),
        this.draftProvider.getAll(),
        this.userProvider.getUser(),
        this.userProvider.getAllUsers(),
        this.viewerProvider.getAll(),
        this.visitProvider.getAll(),
        this.settingProvider.getStaticSetting(),
        this.settingProvider.exportAllSettings(),
        this.staticProvider.exportAll(),
        this.momentProvider
          .getByOption({ page: 1, pageSize: -1 }, false)
          .then((result) => result.moments),
        this.customPageProvider.getAll(true),
        this.pipelineProvider.getAll(),
        this.tokenProvider.getAllTokens(),
        this.navToolProvider.getAllTools(),
        this.navCategoryProvider.getAllCategories(),
        this.iconProvider.getAllIcons(),
        this.settingProvider.getLayoutSetting(),
        this.aiTaggingProvider.getConfig(),
        this.documentProvider
          .getByOption({ page: 1, pageSize: -1 })
          .then((result) => result.documents),
        this.mindMapProvider.getAllForBackup(),
        this.mongoBackupProvider.exportAllCollections(),
      ]);

      const safeTokens = this.sanitizeTokensForBackup(tokens);
      const safeRawCollections = this.sanitizeRawCollectionsForBackup(rawCollections);
      const rawCollectionCounts = Object.fromEntries(
        Object.entries(safeRawCollections).map(([name, docs]) => [
          name,
          Array.isArray(docs) ? docs.length : 0,
        ]),
      );
      const localStaticArtifactCount = (staticItems || []).filter(
        (item: any) => item?.storageType === 'local',
      ).length;
      const customPageFolderArtifactCount = (customPages || []).filter(
        (page: any) => page?.type === 'folder',
      ).length;
      const hasUnembeddedArtifacts =
        localStaticArtifactCount > 0 || customPageFolderArtifactCount > 0;

      const data = {
        articles,
        tags,
        meta,
        drafts,
        categories,
        user,
        users,
        viewer,
        visit,
        static: staticItems,
        setting: { static: staticSetting },
        settings: allSettings,
        moments,
        customPages,
        pipelines,
        tokens: safeTokens,
        navTools,
        navCategories,
        icons,
        layoutSetting,
        aiTaggingConfig,
        documents,
        mindMaps,
        rawCollections: safeRawCollections,
        mongoCollections: safeRawCollections,
        backupInfo: {
          version: '4.0.0',
          formatVersion: '4.0.0',
          timestamp: new Date().toISOString(),
          scope: 'full-site-json',
          contract: 'full-site-backup-json',
          sourceDatabase: 'postgresql',
          dataTypes: [
            'articles',
            'tags',
            'meta',
            'drafts',
            'categories',
            'user',
            'users',
            'viewer',
            'visit',
            'static',
            'setting',
            'settings',
            'moments',
            'customPages',
            'pipelines',
            'tokens',
            'navTools',
            'navCategories',
            'icons',
            'layoutSetting',
            'aiTaggingConfig',
            'documents',
            'mindMaps',
            'rawCollections',
            'mongoCollections',
          ],
          counts: {
            articles: articles?.length || 0,
            drafts: drafts?.length || 0,
            moments: moments?.length || 0,
            categories: categories?.length || 0,
            tags: tags?.length || 0,
            customPages: customPages?.length || 0,
            pipelines: pipelines?.length || 0,
            tokens: safeTokens?.length || 0,
            navTools: navTools?.length || 0,
            navCategories: navCategories?.length || 0,
            icons: icons?.length || 0,
            staticItems: staticItems?.length || 0,
            settings: allSettings?.length || 0,
            users: users?.length || 0,
            layoutSetting: layoutSetting ? 1 : 0,
            aiTaggingConfig: aiTaggingConfig ? 1 : 0,
            documents: documents?.length || 0,
            mindMaps: mindMaps?.length || 0,
          },
          rawCollectionCounts,
          mongoCollectionCounts: rawCollectionCounts,
          legacyFields: ['mongoCollections'],
          credentialWarnings: {
            tokensExcluded: true,
            message:
              '为避免凭证泄露，JSON 备份不会导出登录会话 Token 或 API Token；恢复后需重新登录并重新创建 API Token。',
          },
          artifactWarnings: hasUnembeddedArtifacts
            ? {
                embedded: false,
                localStaticFiles: localStaticArtifactCount,
                customPageFolders: customPageFolderArtifactCount,
                message:
                  '当前 JSON 备份不会内嵌本地静态文件和 folder 型自定义页面的实际文件内容；恢复时只会导入数据库记录。',
              }
            : undefined,
        },
      };

      if (hasUnembeddedArtifacts) {
        this.logger.warn(
          `检测到未内嵌到 JSON 备份中的本地文件资产：static=${localStaticArtifactCount}, customPageFolders=${customPageFolderArtifactCount}`,
        );
      }

      this.logger.log(
        `数据导出完成，共包含 ${Object.keys(data.backupInfo.counts).length} 种数据类型`,
      );

      const name = `vanblog-backup-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
      fs.writeFileSync(name, JSON.stringify(data, null, 2));
      res.download(name, (err) => {
        if (!err) {
          this.logger.log('备份文件下载成功');
          fs.rmSync(name, { force: true });
          return;
        }
        this.logger.error('备份文件下载失败', err.stack);
        fs.rmSync(name, { force: true });
      });
    } catch (error) {
      this.logger.error('导出数据时发生错误', error.stack);
      res.status(500).json({
        statusCode: 500,
        message: '导出失败：' + error.message,
      });
    }
  }

  private throwIfImportFailures(stageLabel: string, failures: string[]) {
    if (!failures.length) {
      return;
    }
    const preview = failures.slice(0, 3).join('；');
    const suffix = failures.length > 3 ? `；另有 ${failures.length - 3} 条失败` : '';
    throw new Error(`${stageLabel} 恢复不完整，失败 ${failures.length} 条：${preview}${suffix}`);
  }

  @Post('/import')
  @UseInterceptors(FileInterceptor('file'))
  async importAll(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    try {
      if (!file?.buffer?.length) {
        return {
          statusCode: 400,
          message: '未检测到备份文件内容',
        };
      }

      const includeAnalytics = this.parseIncludeAnalyticsFlag(body?.includeAnalytics);
      const prepared = await this.prepareImportPayload(file, includeAnalytics);
      this.logger.log(`检测到备份版本: ${prepared.backupVersion}`);

      const created = await this.backupImportJobProvider.createJob(
        this.buildImportStages(prepared),
        this.buildImportSummary(prepared),
      );

      if (!created.created) {
        return {
          statusCode: 409,
          message: '已有备份导入任务正在执行，请等待当前任务完成',
          data: {
            jobId: created.job.id,
          },
        };
      }

      void Promise.resolve().then(async () => {
        try {
          await this.executeImport(prepared, created.job.id);
        } catch (error) {
          const message = error?.message || '未知错误';
          this.logger.error(`后台导入任务失败(${created.job.id}): ${message}`, error?.stack);
          await this.backupImportJobProvider.failJob(created.job.id, message);
        }
      });

      return {
        statusCode: 202,
        message: '备份文件已接收，正在后台导入',
        data: {
          jobId: created.job.id,
        },
      };
    } catch (error) {
      this.logger.error('导入数据时发生错误', error.stack);
      return {
        statusCode: 500,
        message: '导入失败：' + error.message,
      };
    }
  }

  @Get('/import/status/:jobId')
  async getImportStatus(@Param('jobId') jobId: string) {
    const job = await this.backupImportJobProvider.getJob(jobId);
    if (!job) {
      return {
        statusCode: 404,
        message: '导入任务不存在或已过期',
      };
    }
    return {
      statusCode: 200,
      data: job,
    };
  }

  async importAllSync(file: Express.Multer.File, includeAnalytics = false) {
    const prepared = await this.prepareImportPayload(file, includeAnalytics);
    return await this.executeImport(prepared);
  }

  private async executeImport(prepared: PreparedImportPayload, jobId?: string) {
    const startStage = async (key: string, detail?: string) => {
      if (jobId) {
        await this.backupImportJobProvider.startStage(jobId, key, detail);
      }
    };
    const advanceStage = async (key: string, completed: number, detail?: string) => {
      if (jobId) {
        await this.backupImportJobProvider.advanceStage(jobId, key, completed, detail);
      }
    };
    const completeStage = async (key: string, detail?: string) => {
      if (jobId) {
        await this.backupImportJobProvider.completeStage(jobId, key, detail);
      }
    };
    const skipStage = async (key: string, detail?: string) => {
      if (jobId) {
        await this.backupImportJobProvider.skipStage(jobId, key, detail);
      }
    };

    try {
      this.logger.log('开始导入数据...');
      if (jobId) {
        await this.backupImportJobProvider.markRunning(jobId, '开始后台导入备份数据');
      }

      const importResults = {
        articles: 0,
        drafts: 0,
        moments: 0,
        categories: 0,
        tags: 0,
        customPages: 0,
        pipelines: 0,
        tokens: 0,
        navCategories: 0,
        navTools: 0,
        icons: 0,
        staticItems: 0,
        layoutSetting: 0,
        aiTaggingConfig: 0,
        documents: 0,
        users: 0,
        settings: 0,
        mindMaps: 0,
        other: 0,
      };

      const usersToImport = this.buildUsersForRestore(
        prepared.users || (prepared.user ? [prepared.user] : []),
        prepared.currentAdmin,
      );
      this.logger.log(
        prepared.canRestoreProtectedData
          ? '检测到目标站点为空，直接执行整站恢复'
          : '检测到目标站点已有数据，先清空现有站点数据，仅保留当前登录名与密码后再恢复',
      );

      if (!prepared.canRestoreProtectedData) {
        await startStage('cleanupExisting', '正在清理旧站点数据');
        await this.prepareForFullRestore(prepared.currentAdmin);
        await completeStage('cleanupExisting', '旧站点数据清理完成');
      }

      if (usersToImport?.length) {
        await startStage('users', '正在恢复管理员账号');
        await this.userProvider.importUsers(usersToImport);
        importResults.users = usersToImport.length;
        this.logger.log(`用户数据导入完成: ${importResults.users} 条（已保留当前登录名与密码）`);
        await completeStage('users', `已恢复 ${importResults.users} 个用户记录`);
      } else if (prepared.currentAdmin?.id !== undefined) {
        this.logger.log('备份文件中未发现用户数据，保留当前管理员账号');
        await skipStage('users', '备份中没有用户数据，已保留当前管理员');
      }

      if (prepared.meta) {
        await startStage('meta', '正在恢复站点信息');
        await this.restoreMeta(prepared.meta);
        this.logger.log('元数据导入完成（包含站点信息）');
        await completeStage('meta', '站点信息已恢复');
      }

      if (prepared.settings?.length) {
        await startStage('settings', '正在恢复系统设置');
        await this.settingProvider.importAllSettings(prepared.settings, true);
        importResults.settings = prepared.settings.length;
        this.logger.log(`完整设置导入完成: ${importResults.settings} 条（覆盖模式）`);
        await completeStage('settings', `已恢复 ${importResults.settings} 条系统设置`);
      } else if (prepared.setting) {
        await startStage('settings', '正在恢复系统设置');
        await this.settingProvider.importSetting(prepared.setting);
        this.logger.log('设置数据导入完成');
        await completeStage('settings', '系统设置已恢复');
      }

      if (prepared.categories.length > 0) {
        await startStage('categories', '正在恢复分类');
        importResults.categories = await this.importCategoriesWithRebuild(prepared.categories);
        this.logger.log(`分类数据导入完成: ${importResults.categories} 条`);
        await completeStage('categories', `已恢复 ${importResults.categories} 个分类`);
      }

      if (prepared.tags.length > 0) {
        importResults.tags = prepared.tags.length;
        this.logger.log(`标签数据准备完成: ${importResults.tags} 条`);
      }

      if (prepared.articles.length > 0) {
        await startStage('articles', `准备恢复 ${prepared.articles.length} 篇文章`);
        await this.autoCreateCategoriesFromContent(prepared.articles, 'articles');
        await this.importArticlesEnhanced(prepared.articles, async (completed, detail) => {
          if (this.shouldReportProgress(completed, prepared.articles.length)) {
            await advanceStage('articles', completed, detail);
          }
        });
        importResults.articles = prepared.articles.length;
        this.logger.log(`文章数据增量导入完成: ${importResults.articles} 条`);
        await completeStage('articles', `已恢复 ${importResults.articles} 篇文章`);
      }

      if (prepared.drafts.length > 0) {
        await startStage('drafts', `准备恢复 ${prepared.drafts.length} 个草稿`);
        await this.autoCreateCategoriesFromContent(prepared.drafts, 'drafts');
        await this.importDraftsEnhanced(prepared.drafts, async (completed, detail) => {
          if (this.shouldReportProgress(completed, prepared.drafts.length)) {
            await advanceStage('drafts', completed, detail);
          }
        });
        importResults.drafts = prepared.drafts.length;
        this.logger.log(`草稿数据增量导入完成: ${importResults.drafts} 条`);
        await completeStage('drafts', `已恢复 ${importResults.drafts} 个草稿`);
      }

      if (prepared.moments.length > 0) {
        await startStage('moments', `准备恢复 ${prepared.moments.length} 条动态`);
        await this.importMomentsEnhanced(prepared.moments, async (completed, detail) => {
          if (this.shouldReportProgress(completed, prepared.moments.length)) {
            await advanceStage('moments', completed, detail);
          }
        });
        importResults.moments = prepared.moments.length;
        this.logger.log(`动态数据增量导入完成: ${importResults.moments} 条`);
        await completeStage('moments', `已恢复 ${importResults.moments} 条动态`);
      }

      if (prepared.customPages.length > 0) {
        await startStage('customPages', '正在恢复自定义页面');
        importResults.customPages = await this.importCustomPagesEnhanced(prepared.customPages);
        this.logger.log(`自定义页面导入完成: ${importResults.customPages} 条`);
        await completeStage('customPages', `已恢复 ${importResults.customPages} 个自定义页面`);
      }

      if (prepared.navCategories.length > 0) {
        await startStage('navCategories', '正在恢复导航分类');
        importResults.navCategories = await this.importNavCategoriesEnhanced(prepared.navCategories);
        this.logger.log(`导航分类导入完成: ${importResults.navCategories} 条`);
        await completeStage('navCategories', `已恢复 ${importResults.navCategories} 个导航分类`);
      }

      if (prepared.navTools.length > 0) {
        await startStage('navTools', '正在恢复导航工具');
        await this.autoCreateNavCategoriesFromTools(prepared.navTools);
        importResults.navTools = await this.importNavToolsEnhanced(prepared.navTools);
        this.logger.log(`导航工具导入完成: ${importResults.navTools} 条`);
        await completeStage('navTools', `已恢复 ${importResults.navTools} 个导航工具`);
      }

      if (prepared.icons.length > 0) {
        await startStage('icons', '正在恢复图标');
        importResults.icons = await this.importIconsEnhanced(prepared.icons);
        this.logger.log(`图标数据导入完成: ${importResults.icons} 条`);
        await completeStage('icons', `已恢复 ${importResults.icons} 个图标`);
      }

      if (prepared.pipelines.length > 0) {
        await startStage('pipelines', '正在恢复流水线');
        importResults.pipelines = await this.importPipelinesEnhanced(prepared.pipelines);
        this.logger.log(`流水线数据导入完成: ${importResults.pipelines} 条`);
        await completeStage('pipelines', `已恢复 ${importResults.pipelines} 条流水线配置`);
      }

      if (prepared.tokens.length > 0) {
        if (!prepared.canRestoreProtectedData) {
          this.logger.warn('目标站点已有数据，跳过恢复备份 Token，避免旧凭证在当前站点继续生效');
          await skipStage('tokens', '目标站点已有数据时不恢复备份 Token，避免旧凭证继续有效');
        } else {
          await startStage('tokens', '正在恢复 Token');
          await this.importTokensEnhanced(prepared.tokens);
          importResults.tokens = prepared.tokens.length;
          this.logger.log(`Token数据导入完成: ${importResults.tokens} 条`);
          await completeStage('tokens', `已恢复 ${importResults.tokens} 条 Token`);
        }
      }

      if (prepared.staticItems.length > 0) {
        await startStage('staticItems', `正在恢复 ${prepared.staticItems.length} 条静态文件记录`);
        this.logger.log(`开始导入静态文件记录: ${prepared.staticItems.length} 条`);
        await this.staticProvider.importItems(prepared.staticItems, false);
        importResults.staticItems = prepared.staticItems.length;
        this.logger.log(`静态文件记录导入完成: ${importResults.staticItems} 条`);
        await completeStage('staticItems', `已恢复 ${importResults.staticItems} 条静态文件记录`);
      }

      if (prepared.layoutSetting && Object.keys(prepared.layoutSetting).length > 0) {
        await startStage('layoutSetting', '正在恢复定制化设置');
        try {
          await this.settingProvider.updateLayoutSetting(prepared.layoutSetting);
          importResults.layoutSetting = 1;
          this.logger.log('定制化设置导入完成');
          this.isrProvider.activeAll('导入定制化设置');
          await completeStage('layoutSetting', '定制化设置已恢复');
        } catch (error) {
          this.logger.warn(`定制化设置导入失败: ${error.message}`);
          await skipStage('layoutSetting', `定制化设置恢复失败：${error.message}`);
        }
      } else {
        this.logger.log('备份文件中未发现定制化设置数据或数据为空');
      }

      if (prepared.aiTaggingConfig && Object.keys(prepared.aiTaggingConfig).length > 0) {
        await startStage('aiTaggingConfig', '正在恢复 AI 标签配置');
        try {
          await this.aiTaggingProvider.updateConfig(prepared.aiTaggingConfig);
          importResults.aiTaggingConfig = 1;
          this.logger.log('AI标签配置导入完成（覆盖模式）');
          await completeStage('aiTaggingConfig', 'AI 标签配置已恢复');
        } catch (error) {
          this.logger.warn(`AI标签配置导入失败: ${error.message}`);
          await skipStage('aiTaggingConfig', `AI 标签配置恢复失败：${error.message}`);
        }
      } else {
        this.logger.log('备份文件中未发现AI标签配置数据或数据为空');
      }

      if (prepared.documents.length > 0) {
        await startStage('documents', `准备恢复 ${prepared.documents.length} 个私密文档`);
        try {
          await this.importDocumentsEnhanced(prepared.documents, async (completed, detail) => {
            if (this.shouldReportProgress(completed, prepared.documents.length)) {
              await advanceStage('documents', completed, detail);
            }
          });
          importResults.documents = prepared.documents.length;
          this.logger.log(`私密文档库数据导入完成: ${importResults.documents} 条`);
          await completeStage('documents', `已恢复 ${importResults.documents} 个私密文档`);
        } catch (error) {
          this.logger.warn(`私密文档库数据导入失败: ${error.message}`);
          throw error;
        }
      } else {
        this.logger.log('备份文件中未发现私密文档库数据或数据为空');
      }

      if (prepared.mindMaps.length > 0) {
        await startStage('mindMaps', '正在恢复思维导图');
        await this.mindMapProvider.importMindMaps(prepared.mindMaps);
        importResults.mindMaps = prepared.mindMaps.length;
        this.logger.log(`脑图数据导入完成: ${importResults.mindMaps} 条`);
        await completeStage('mindMaps', `已恢复 ${importResults.mindMaps} 个思维导图`);
      }

      if (!prepared.includeAnalytics) {
        await skipStage(
          'analytics',
          '已默认跳过访问统计（viewer/visit）；这类按日期和页面路径累计的历史数据恢复意义低，且会显著拖慢导入',
        );
      } else {
        await startStage('analytics', '正在恢复访问统计');
        if (prepared.visit.length > 0) {
          await this.visitProvider.import(prepared.visit);
        }
        if (prepared.viewer.length > 0) {
          await this.viewerProvider.import(prepared.viewer);
        }
        this.logger.log('访问统计导入完成');
        await completeStage(
          'analytics',
          `已恢复 ${prepared.visit.length + prepared.viewer.length} 条访问统计`,
        );
      }

      await startStage('structuredData', '正在同步结构化数据');
      await this.refreshStructuredData(
        'backup-import',
        this.getStructuredCollectionsForImport(prepared),
      );
      await completeStage('structuredData', '结构化数据同步完成');

      await startStage('syncTags', '正在同步标签与前台缓存');
      try {
        this.logger.log('开始清理标签缓存并刷新前台缓存...');
        await this.tagProvider.invalidateCache();
        this.logger.log('标签缓存清理完成');
        this.isrProvider.activeUrl('/tag', false);
        this.isrProvider.activePath('tag');
        await completeStage('syncTags', '标签同步完成');
      } catch (error) {
        this.logger.error('标签数据同步失败:', error.message);
        await skipStage('syncTags', `标签同步失败：${error.message}`);
      }

      const skippedNotes = prepared.includeAnalytics
        ? []
        : ['访问统计（viewer/visit）已默认跳过，不会导入这类按日期和路径累计的历史数据。'];

      this.logger.log('所有数据导入完成！', importResults);
      const result = {
        statusCode: 200,
        data: '导入成功！',
        importResults,
        skippedNotes,
      };
      if (jobId) {
        await this.backupImportJobProvider.completeJob(jobId, result, '导入完成');
      }
      return result;
    } catch (error) {
      this.logger.error('导入数据时发生错误', error.stack);
      if (jobId) {
        await this.backupImportJobProvider.failJob(jobId, error.message);
      }
      return {
        statusCode: 500,
        message: '导入失败：' + error.message,
      };
    }
  }

  @Post('/clear-all')
  async clearAllData() {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    try {
      this.logger.warn('开始清空所有数据...');

      const clearResults = {
        articles: 0,
        drafts: 0,
        moments: 0,
        mindMaps: 0,
        categories: 0,
        tags: 0,
        customPages: 0,
        pipelines: 0,
        navTools: 0,
        navCategories: 0,
        icons: 0,
        staticItems: 0,
        viewer: 0,
        visit: 0,
        tokens: 0,
        documents: 0,
      };

      // 1. 清空内容数据 - 使用物理删除
      try {
        // 直接删除数据库中的所有文章记录，而不是软删除
        const articles = await this.articleProvider.findAll();
        const articleCount = articles.length;

        // 使用MongoDB的deleteMany进行批量物理删除
        await this.articleProvider['articleModel'].deleteMany({});

        clearResults.articles = articleCount;
        this.logger.log(`清空文章数据完成: ${clearResults.articles} 条`);

        // 清空文章后立即同步标签数据，这会自动删除所有标签
        try {
          await this.tagProvider.syncTagsFromArticles();
          const remainingTags = await this.tagProvider.getAllTags(true);
          clearResults.tags = remainingTags.length;
          this.logger.log(`文章清空后标签同步完成，剩余标签: ${remainingTags.length} 条`);
        } catch (tagError) {
          this.logger.warn('标签同步失败，使用强制删除:', tagError.message);
          // 如果同步失败，强制删除所有标签
          await this.tagProvider['tagModel'].deleteMany({});
          clearResults.tags = 0;
        }
      } catch (error) {
        this.logger.error('清空文章数据失败:', error.message);
      }

      try {
        const drafts = await this.draftProvider.getAll();
        const draftCount = drafts.length;

        // 使用MongoDB的deleteMany进行批量物理删除
        await this.draftProvider['draftModel'].deleteMany({});

        clearResults.drafts = draftCount;
        this.logger.log(`清空草稿数据完成: ${clearResults.drafts} 条`);
      } catch (error) {
        this.logger.error('清空草稿数据失败:', error.message);
      }

      try {
        const momentsResult = await this.momentProvider.getByOption(
          { page: 1, pageSize: -1 },
          false,
        );
        const momentCount = momentsResult.moments.length;

        // 使用MongoDB的deleteMany进行批量物理删除
        await this.momentProvider['momentModel'].deleteMany({});

        clearResults.moments = momentCount;
        this.logger.log(`清空动态数据完成: ${clearResults.moments} 条`);
      } catch (error) {
        this.logger.error('清空动态数据失败:', error.message);
      }

      // 2. 清空自定义页面
      try {
        const customPages = await this.customPageProvider.getAll(true);
        await this.purgePersistedFiles(customPages, []);
        for (const page of customPages) {
          await this.customPageProvider.deleteByPath(page.path);
        }
        clearResults.customPages = customPages.length;
        this.logger.log(`清空自定义页面完成: ${clearResults.customPages} 条`);
      } catch (error) {
        this.logger.error('清空自定义页面失败:', error.message);
      }

      // 3. 清空导航数据
      try {
        const navTools = await this.navToolProvider.getAllTools();
        for (const tool of navTools) {
          await this.navToolProvider.deleteTool(tool._id);
        }
        clearResults.navTools = navTools.length;
        this.logger.log(`清空导航工具完成: ${clearResults.navTools} 条`);
      } catch (error) {
        this.logger.error('清空导航工具失败:', error.message);
      }

      try {
        const navCategories = await this.navCategoryProvider.getAllCategories();
        for (const category of navCategories) {
          await this.navCategoryProvider.deleteCategory(category._id);
        }
        clearResults.navCategories = navCategories.length;
        this.logger.log(`清空导航分类完成: ${clearResults.navCategories} 条`);
      } catch (error) {
        this.logger.error('清空导航分类失败:', error.message);
      }

      // 4. 清空图标数据
      try {
        await this.iconProvider.deleteAllIcons();
        this.logger.log('清空图标数据完成');
      } catch (error) {
        this.logger.error('清空图标数据失败:', error.message);
      }

      // 5. 清空流水线
      try {
        const pipelines = await this.pipelineProvider.getAll();
        for (const pipeline of pipelines) {
          await this.pipelineProvider.deletePipelineById(pipeline.id);
        }
        clearResults.pipelines = pipelines.length;
        this.logger.log(`清空流水线完成: ${clearResults.pipelines} 条`);
      } catch (error) {
        this.logger.error('清空流水线失败:', error.message);
      }

      // 6. 清空私密文档库
      try {
        const documents = await this.documentProvider.getByOption({ page: 1, pageSize: -1 });

        // 使用MongoDB的deleteMany进行批量物理删除
        await this.documentProvider['documentModel'].deleteMany({});

        clearResults.documents = documents.documents.length;
        this.logger.log(`清空私密文档库完成: ${clearResults.documents} 条`);
      } catch (error) {
        this.logger.error('清空私密文档库失败:', error.message);
      }

      try {
        const { total } = await this.mindMapProvider.getByOption({ page: 1, pageSize: 1 });
        await this.mindMapProvider['mindMapModel'].deleteMany({});
        clearResults.mindMaps = total || 0;
        this.logger.log(`清空脑图数据完成: ${clearResults.mindMaps} 条`);
      } catch (error) {
        this.logger.error('清空脑图数据失败:', error.message);
      }

      // 6. 清空分类和标签（在文章清空后）
      try {
        const categories = (await this.categoryProvider.getAllCategories(true)) as any[];
        for (const category of categories) {
          try {
            await this.categoryProvider.deleteOne(category.name);
          } catch {
            // 有些分类可能因为依赖关系无法删除，忽略错误
          }
        }
        clearResults.categories = categories.length;
        this.logger.log(`清空分类数据完成: ${clearResults.categories} 条`);
      } catch (error) {
        this.logger.error('清空分类数据失败:', error.message);
      }

      // 7. 清空统计数据
      try {
        const viewers = await this.viewerProvider.getAll();
        // 使用MongoDB的deleteMany进行批量物理删除
        await this.viewerProvider['viewerModel'].deleteMany({});
        clearResults.viewer = viewers?.length || 0;
        this.logger.log(`清空访客数据完成: ${clearResults.viewer} 条`);
      } catch (error) {
        this.logger.error('清空访客数据失败:', error.message);
      }

      try {
        const visits = await this.visitProvider.getAll();
        // 使用MongoDB的deleteMany进行批量物理删除
        await this.visitProvider['visitModel'].deleteMany({});
        clearResults.visit = visits?.length || 0;
        this.logger.log(`清空访问数据完成: ${clearResults.visit} 条`);
      } catch (error) {
        this.logger.error('清空访问数据失败:', error.message);
      }

      // 8. 清空静态文件记录数据
      try {
        const staticItems = await this.staticProvider.exportAll();
        await this.purgePersistedFiles([], staticItems);
        await this.staticProvider['staticModel'].deleteMany({});
        await this.structuredDataService.deleteAllStatics();
        clearResults.staticItems = staticItems?.length || 0;
        this.logger.log(`清空静态文件记录完成: ${clearResults.staticItems} 条`);
      } catch (error) {
        this.logger.error('清空静态文件记录失败:', error.message);
      }

      // 9. 禁用所有仍可用的 Token，避免清库后继续使用旧凭证访问后台
      try {
        await this.tokenProvider.disableAll();
        this.logger.log('禁用所有 Token 完成');
      } catch (error) {
        this.logger.error('禁用所有 Token 失败:', error.message);
      }

      // 10. 完全清空meta表、用户表和settings表，让网站回到未初始化状态
      try {
        // 使用MongoDB的deleteMany完全删除meta记录
        await this.metaProvider['metaModel'].deleteMany({});
        this.logger.log('清空网站元数据完成');

        // 清空用户表，让系统回到未初始化状态
        await this.userProvider['userModel'].deleteMany({});
        await this.structuredDataService.deleteUsersExcept([]);
        this.logger.log('清空用户数据完成');

        // 清空settings表
        await this.settingProvider['settingModel'].deleteMany({});
        await this.structuredDataService.deleteAllSettings();
        this.logger.log('清空网站设置完成，网站已重置为未初始化状态');
      } catch (error) {
        this.logger.error('清空网站数据失败:', error.message);
      }

      // 11. 触发全量渲染
      try {
        await this.isrProvider.activeAll();
        this.logger.log('触发全量渲染完成');
      } catch (error) {
        this.logger.error('触发全量渲染失败:', error.message);
      }

      this.logger.warn('所有数据清空完成！', clearResults);
      await this.refreshStructuredData('clear-all');

      return {
        statusCode: 200,
        data: '数据清空成功！',
        clearResults,
      };
    } catch (error) {
      this.logger.error('清空数据时发生错误', error.stack);
      return {
        statusCode: 500,
        message: '清空失败：' + error.message,
      };
    }
  }

  private async importCategoriesWithRebuild(categories: any[]) {
    let successCount = 0;
    const failures: string[] = [];
    for (const category of categories) {
      try {
        // 处理分类数据，支持字符串和对象两种格式
        let categoryName: string;
        let categoryData: any = {};

        if (typeof category === 'string') {
          // 旧格式：字符串数组
          categoryName = category;
        } else if (typeof category === 'object' && category.name) {
          // 新格式：对象数组
          categoryName = category.name;
          categoryData = category;
        } else {
          this.logger.warn(`跳过无效分类数据: ${JSON.stringify(category)}`);
          failures.push(JSON.stringify(category));
          continue;
        }

        // 验证分类名称
        if (!categoryName || categoryName.trim() === '') {
          this.logger.warn(`跳过空分类名称: ${JSON.stringify(category)}`);
          failures.push(JSON.stringify(category));
          continue;
        }

        // 获取所有现有分类
        const allCategories = (await this.categoryProvider.getAllCategories(true)) as any[];
        const existingCategory = allCategories.find((c: any) => c.name === categoryName);

        if (existingCategory) {
          // 更新现有分类，保留新导入的数据
          await this.categoryProvider.updateCategoryByName(categoryName, {
            private: categoryData.private,
            password: categoryData.password,
          });
        } else {
          // 创建新分类
          await this.categoryProvider.addOne(categoryName);
          // 如果有额外属性，再更新一次
          if (categoryData.private || categoryData.password) {
            await this.categoryProvider.updateCategoryByName(categoryName, {
              private: categoryData.private,
              password: categoryData.password,
            });
          }
        }
        successCount++;
      } catch (error) {
        this.logger.warn(`分类 ${category} 导入失败: ${error.message}`);
        failures.push(typeof category === 'string' ? category : category?.name || JSON.stringify(category));
      }
    }
    this.throwIfImportFailures('分类', failures);
    return successCount;
  }

  private async importDraftsEnhanced(
    drafts: any[],
    onProgress?: (completed: number, detail?: string) => Promise<void> | void,
  ) {
    if (!drafts || drafts.length === 0) return;

    try {
      this.logger.log(`开始快速恢复 ${drafts.length} 个草稿...`);
      const usedIds = new Set<number>();
      let newIdCount = 0;
      const payloads: any[] = [];

      for (const draft of drafts) {
        let targetId = Number(draft?.id);

        if (!Number.isFinite(targetId) || targetId <= 0 || usedIds.has(targetId)) {
          targetId = await this.draftProvider.getNewId();
          newIdCount++;
          if (draft?.id) {
            this.logger.log(`草稿ID冲突 (${draft.id} -> ${targetId}): ${draft.title}`);
          }
        }

        usedIds.add(targetId);
        const { id, _id, __v, ...createDto } = draft;
        payloads.push({
          ...createDto,
          id: targetId,
          deleted: createDto.deleted ?? false,
          createdAt: createDto.createdAt || new Date(),
          updatedAt: createDto.updatedAt || createDto.createdAt || new Date(),
        });
      }

      let processedCount = 0;
      await this.runWithConcurrency(
        payloads,
        this.getImportConcurrency(payloads.length),
        async (payload) => {
          const newDraft = new this.draftProvider['draftModel'](payload);
          await newDraft.save();
          processedCount++;
          if (onProgress && this.shouldReportProgress(processedCount, payloads.length)) {
            await onProgress(processedCount, payload.title);
          }
        },
      );

      this.logger.log(`草稿快速恢复完成: 创建 ${payloads.length} 个, 重新分配ID ${newIdCount} 个`);
    } catch (error) {
      this.logger.error('批量导入草稿失败:', error.message);
      throw error;
    }
  }

  private async importMomentsEnhanced(
    moments: any[],
    onProgress?: (completed: number, detail?: string) => Promise<void> | void,
  ) {
    if (!moments || moments.length === 0) return;

    try {
      this.logger.log(`开始快速恢复 ${moments.length} 个动态...`);
      const usedIds = new Set<number>();
      let newIdCount = 0;
      const payloads: any[] = [];

      for (const moment of moments) {
        let targetId = Number(moment?.id);

        if (!Number.isFinite(targetId) || targetId <= 0 || usedIds.has(targetId)) {
          targetId = await this.momentProvider.getNewId();
          newIdCount++;
          if (moment?.id) {
            this.logger.log(`动态ID冲突 (${moment.id} -> ${targetId})`);
          }
        }

        usedIds.add(targetId);
        const { id, _id, __v, ...createDto } = moment;
        payloads.push({
          ...createDto,
          id: targetId,
          deleted: createDto.deleted ?? false,
          createdAt: createDto.createdAt || new Date(),
          updatedAt: createDto.updatedAt || createDto.createdAt || new Date(),
        });
      }

      let processedCount = 0;
      await this.runWithConcurrency(
        payloads,
        this.getImportConcurrency(payloads.length),
        async (payload) => {
          const newMoment = new this.momentProvider['momentModel'](payload);
          await newMoment.save();
          processedCount++;
          if (onProgress && this.shouldReportProgress(processedCount, payloads.length)) {
            await onProgress(processedCount, payload.content?.substring(0, 30));
          }
        },
      );

      this.logger.log(`动态快速恢复完成: 创建 ${payloads.length} 个, 重新分配ID ${newIdCount} 个`);
    } catch (error) {
      this.logger.error('批量导入动态失败:', error.message);
      throw error;
    }
  }

  private async importCustomPagesEnhanced(customPages: any[]) {
    let successCount = 0;
    const failures: string[] = [];
    for (const page of customPages) {
      try {
        const existingPage = await this.customPageProvider.getCustomPageByPath(page.path);
        if (existingPage) {
          await this.customPageProvider.updateCustomPage(page);
        } else {
          await this.customPageProvider.createCustomPage(page);
        }
        successCount++;
      } catch (error) {
        this.logger.warn(`自定义页面 ${page.path} 导入失败: ${error.message}`);
        failures.push(page?.path || 'unknown');
      }
    }
    this.throwIfImportFailures('自定义页面', failures);
    return successCount;
  }

  private async importNavCategoriesEnhanced(navCategories: any[]) {
    let successCount = 0;
    const failures: string[] = [];
    for (const category of navCategories) {
      try {
        // 获取所有导航分类
        const allCategories = await this.navCategoryProvider.getAllCategories();
        const existing = allCategories.find((c) => c.name === category.name);

        if (existing) {
          await this.navCategoryProvider.updateCategory(existing._id, {
            ...category,
            updatedAt: new Date(),
          });
        } else {
          await this.navCategoryProvider.createCategory({
            ...category,
            createdAt: category.createdAt || new Date(),
            updatedAt: category.updatedAt || new Date(),
          });
        }
        successCount++;
      } catch (error) {
        this.logger.warn(`导航分类 ${category.name} 导入失败: ${error.message}`);
        failures.push(category?.name || 'unknown');
      }
    }
    this.throwIfImportFailures('导航分类', failures);
    return successCount;
  }

  private async importNavToolsEnhanced(navTools: any[]) {
    let successCount = 0;
    const failures: string[] = [];
    for (const tool of navTools) {
      try {
        // 根据 categoryName 查找分类，而不是 categoryId
        const allCategories = await this.navCategoryProvider.getAllCategories();
        const category = allCategories.find((c) => c.name === tool.categoryName);

        if (!category) {
          this.logger.warn(`导航工具 ${tool.name} 的分类 ${tool.categoryName} 不存在，跳过导入`);
          failures.push(tool?.name || 'unknown');
          continue;
        }

        // 获取所有导航工具
        const allTools = await this.navToolProvider.getAllTools();
        const existing = allTools.find((t) => t.name === tool.name);

        const toolData = {
          ...tool,
          categoryId: category._id, // 使用新的分类ID
          updatedAt: new Date(),
        };

        if (existing) {
          await this.navToolProvider.updateTool(existing._id, toolData);
        } else {
          await this.navToolProvider.createTool({
            ...toolData,
            createdAt: tool.createdAt || new Date(),
          });
        }
        successCount++;
      } catch (error) {
        this.logger.warn(`导航工具 ${tool.name} 导入失败: ${error.message}`);
        failures.push(tool?.name || 'unknown');
      }
    }
    this.throwIfImportFailures('导航工具', failures);
    return successCount;
  }

  private async importIconsEnhanced(icons: any[]) {
    let successCount = 0;
    const failures: string[] = [];
    for (const icon of icons) {
      try {
        const existing = await this.iconProvider.getIconByName(icon.name);
        if (existing) {
          await this.iconProvider.updateIcon(icon.name, {
            ...icon,
            updatedAt: new Date(),
          });
        } else {
          await this.iconProvider.createIcon({
            ...icon,
            createdAt: icon.createdAt || new Date(),
            updatedAt: icon.updatedAt || new Date(),
          });
        }
        successCount++;
      } catch (error) {
        this.logger.warn(`图标 ${icon.name} 导入失败: ${error.message}`);
        failures.push(icon?.name || 'unknown');
      }
    }
    this.throwIfImportFailures('图标', failures);
    return successCount;
  }

  private async importPipelinesEnhanced(pipelines: any[]) {
    let successCount = 0;
    const failures: string[] = [];
    for (const pipeline of pipelines) {
      try {
        const { id, ...createDto } = pipeline;
        let existing = null;

        if (id) {
          existing = await this.pipelineProvider.getPipelineById(id);
        }

        if (existing) {
          await this.pipelineProvider.updatePipelineById(existing.id, {
            ...createDto,
            updatedAt: new Date(),
          });
        } else {
          await this.pipelineProvider.createPipeline({
            ...createDto,
            createdAt: createDto.createdAt || new Date(),
            updatedAt: createDto.updatedAt || new Date(),
          });
        }
        successCount++;
      } catch (error) {
        this.logger.warn(`流水线 ${pipeline.name || 'unknown'} 导入失败: ${error.message}`);
        failures.push(pipeline?.name || 'unknown');
      }
    }
    this.throwIfImportFailures('流水线', failures);
    return successCount;
  }

  private async importTokensEnhanced(tokens: any[]) {
    if (!tokens || tokens.length === 0) {
      return;
    }
    await this.tokenProvider.importTokens(tokens);
  }

  private async purgePersistedFiles(customPages: any[], staticItems: any[]) {
    for (const page of customPages || []) {
      if (page?.type === 'folder' && page?.path) {
        await this.staticProvider.deleteCustomPage(page.path);
      }
    }

    for (const item of staticItems || []) {
      if (item?.sign) {
        await this.staticProvider.deleteOneBySign(item.sign);
      }
    }
  }

  private async canRestoreProtectedData() {
    const [
      articles,
      drafts,
      categories,
      customPages,
      moments,
      navTools,
      navCategories,
      documents,
      mindMaps,
    ] = await Promise.all([
      this.articleProvider.getTotalNum(true),
      this.draftProvider.getAll().then((items) => items.length),
      this.categoryProvider.getAllCategories(),
      this.customPageProvider.getAll(),
      this.momentProvider
        .getByOption({ page: 1, pageSize: 1 }, false)
        .then((result) => result.total),
      this.navToolProvider.getAllTools(),
      this.navCategoryProvider.getAllCategories(),
      this.documentProvider.getByOption({ page: 1, pageSize: 1 }).then((result) => result.total),
      this.mindMapProvider.getByOption({ page: 1, pageSize: 1 }).then((result) => result.total),
    ]);

    return (
      (articles || 0) === 0 &&
      (drafts || 0) === 0 &&
      (categories?.length || 0) === 0 &&
      (customPages?.length || 0) === 0 &&
      (moments || 0) === 0 &&
      (navTools?.length || 0) === 0 &&
      (navCategories?.length || 0) === 0 &&
      (documents || 0) === 0 &&
      (mindMaps || 0) === 0
    );
  }

  private async prepareForFullRestore(currentAdmin?: any) {
    const keepAdminId = currentAdmin?.id;
    const [customPages, staticItems] = await Promise.all([
      this.customPageProvider.getAll(true),
      this.staticProvider.exportAll(),
    ]);

    await this.purgePersistedFiles(customPages, staticItems);

    await Promise.all([
      this.articleProvider['articleModel']?.deleteMany?.({}),
      this.draftProvider['draftModel']?.deleteMany?.({}),
      this.momentProvider['momentModel']?.deleteMany?.({}),
      this.categoryProvider['categoryModal']?.deleteMany?.({}),
      this.tagProvider['tagModel']?.deleteMany?.({}),
      this.customPageProvider['customPageModal']?.deleteMany?.({}),
      this.pipelineProvider['pipelineModel']?.deleteMany?.({}),
      this.navToolProvider['navToolModel']?.deleteMany?.({}),
      this.navCategoryProvider['navCategoryModel']?.deleteMany?.({}),
      this.iconProvider['iconModel']?.deleteMany?.({}),
      this.staticProvider['staticModel']?.deleteMany?.({}),
      this.viewerProvider['viewerModel']?.deleteMany?.({}),
      this.visitProvider['visitModel']?.deleteMany?.({}),
      this.tokenProvider['tokenModel']?.deleteMany?.({}),
      this.documentProvider['documentModel']?.deleteMany?.({}),
      this.mindMapProvider['mindMapModel']?.deleteMany?.({}),
      this.settingProvider['settingModel']?.deleteMany?.({}),
      this.metaProvider['metaModel']?.deleteMany?.({}),
      keepAdminId === undefined
        ? this.userProvider['userModel']?.deleteMany?.({})
        : this.userProvider['userModel']?.deleteMany?.({ id: { $ne: keepAdminId } }),
    ]);

    await this.structuredDataService.clearStructuredDataForRestore(
      keepAdminId === undefined ? [] : [Number(keepAdminId)],
    );
  }

  private buildUsersForRestore(users: any[], currentAdmin?: any) {
    const normalizedUsers = Array.isArray(users)
      ? users
          .filter((item) => item?.name)
          .map((item) => {
            const { _id, __v, ...rest } = item;
            return rest;
          })
      : [];

    if (!currentAdmin?.name || !currentAdmin?.password || !currentAdmin?.salt) {
      return normalizedUsers;
    }

    const { _id, __v, ...currentAdminPayload } = currentAdmin?.toObject
      ? currentAdmin.toObject()
      : currentAdmin;

    let adminMerged = false;
    const mergedUsers = normalizedUsers.map((item) => {
      const isAdminRecord =
        item?.id === currentAdminPayload.id || item?.id === 0 || item?.type === 'admin';

      if (!isAdminRecord || adminMerged) {
        return item;
      }

      adminMerged = true;
      return {
        ...item,
        id: currentAdminPayload.id ?? item.id ?? 0,
        type: currentAdminPayload.type || item.type || 'admin',
        name: currentAdminPayload.name,
        password: currentAdminPayload.password,
        salt: currentAdminPayload.salt,
      };
    });

    if (!adminMerged) {
      mergedUsers.unshift({
        ...currentAdminPayload,
        id: currentAdminPayload.id ?? 0,
        type: currentAdminPayload.type || 'admin',
      });
    }

    return mergedUsers;
  }

  private async restoreMeta(meta: any) {
    const payload = { ...meta };
    delete payload._id;
    delete payload.__v;
    await this.metaProvider['metaModel'].updateOne({}, payload, { upsert: true });
    await this.structuredDataService.upsertMeta(payload);
  }

  private async importArticlesEnhanced(
    articles: any[],
    onProgress?: (completed: number, detail?: string) => Promise<void> | void,
  ) {
    if (!articles || articles.length === 0) return;

    try {
      this.logger.log(`开始快速恢复 ${articles.length} 篇文章...`);
      const usedIds = new Set<number>();
      let newIdCount = 0;
      const payloads: any[] = [];

      for (const article of articles) {
        let targetId = Number(article?.id);

        if (!Number.isFinite(targetId) || targetId <= 0 || usedIds.has(targetId)) {
          targetId = await this.articleProvider.getNewId();
          newIdCount++;
          if (article?.id) {
            this.logger.log(`文章ID冲突 (${article.id} -> ${targetId}): ${article.title}`);
          }
        }

        usedIds.add(targetId);
        const { id, _id, __v, ...createDto } = article;
        payloads.push({
          ...createDto,
          id: targetId,
          deleted: createDto.deleted ?? false,
          pathname: createDto.pathname || '',
          createdAt: createDto.createdAt || new Date(),
          updatedAt: createDto.updatedAt || createDto.createdAt || new Date(),
        });
      }

      let processedCount = 0;
      await this.runWithConcurrency(
        payloads,
        this.getImportConcurrency(payloads.length),
        async (payload) => {
          const newArticle = new this.articleProvider['articleModel'](payload);
          await newArticle.save();
          processedCount++;
          if (onProgress && this.shouldReportProgress(processedCount, payloads.length)) {
            await onProgress(processedCount, payload.title);
          }
        },
      );

      this.logger.log(`文章快速恢复完成: 创建 ${payloads.length} 篇, 重新分配ID ${newIdCount} 篇`);
      await this.metaProvider.updateTotalWords('增量导入文章');
    } catch (error) {
      this.logger.error('批量导入文章失败:', error.message);
      throw error;
    }
  }

  private async autoCreateCategoriesFromContent(content: any[], contentType: string) {
    if (!content || content.length === 0) return;

    try {
      const categoryNames = new Set<string>();
      content.forEach((item) => {
        if (item.category && typeof item.category === 'string' && item.category.trim()) {
          categoryNames.add(item.category.trim());
        }
      });

      if (categoryNames.size === 0) {
        this.logger.log(`${contentType} 中没有发现需要创建的分类`);
        return;
      }

      const existingCategories = (await this.categoryProvider.getAllCategories(false)) as string[];
      const existingCategoryNames = new Set(existingCategories);

      let createdCount = 0;
      const failures: string[] = [];
      for (const categoryName of categoryNames) {
        if (!existingCategoryNames.has(categoryName)) {
          try {
            await this.categoryProvider.addOne(categoryName);
            createdCount++;
            this.logger.log(`自动创建分类: ${categoryName}`);
          } catch (error) {
            this.logger.warn(`创建分类 ${categoryName} 失败: ${error.message}`);
            failures.push(categoryName);
          }
        }
      }

      this.throwIfImportFailures(`${contentType} 分类`, failures);
      this.logger.log(`${contentType} 分类自动创建完成: 新建 ${createdCount} 个分类`);
    } catch (error) {
      this.logger.error(`自动创建${contentType}分类失败:`, error.message);
      throw error;
    }
  }

  private async autoCreateNavCategoriesFromTools(navTools: any[]) {
    if (!navTools || navTools.length === 0) return;

    try {
      // 收集所有需要的导航分类名称
      const categoryNames = new Set<string>();
      navTools.forEach((tool) => {
        if (
          tool.categoryName &&
          typeof tool.categoryName === 'string' &&
          tool.categoryName.trim()
        ) {
          categoryNames.add(tool.categoryName.trim());
        }
      });

      if (categoryNames.size === 0) {
        this.logger.log('导航工具中没有发现需要创建的分类');
        return;
      }

      // 获取现有导航分类
      const existingCategories = await this.navCategoryProvider.getAllCategories();
      const existingCategoryNames = new Set(existingCategories.map((c) => c.name));

      let createdCount = 0;
      const failures: string[] = [];
      for (const categoryName of categoryNames) {
        if (!existingCategoryNames.has(categoryName)) {
          try {
            await this.navCategoryProvider.createCategory({
              name: categoryName,
              description: '',
              sort: 0,
              hide: false,
            });
            createdCount++;
            this.logger.log(`自动创建导航分类: ${categoryName}`);
          } catch (error) {
            this.logger.warn(`创建导航分类 ${categoryName} 失败: ${error.message}`);
            failures.push(categoryName);
          }
        }
      }

      this.throwIfImportFailures('导航分类自动创建', failures);
      this.logger.log(`导航分类自动创建完成: 新建 ${createdCount} 个分类`);
    } catch (error) {
      this.logger.error('自动创建导航分类失败:', error.message);
      throw error;
    }
  }

  private async importDocumentsEnhanced(
    documents: any[],
    onProgress?: (completed: number, detail?: string) => Promise<void> | void,
  ) {
    if (!documents || documents.length === 0) return;

    try {
      this.logger.log(`开始快速恢复 ${documents.length} 个私密文档...`);
      const orderedDocuments = [...documents].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'library' ? -1 : 1;
        }
        const aDepth = Array.isArray(a.path) ? a.path.length : 0;
        const bDepth = Array.isArray(b.path) ? b.path.length : 0;
        if (aDepth !== bDepth) {
          return aDepth - bDepth;
        }
        if ((a.sort_order || 0) !== (b.sort_order || 0)) {
          return (a.sort_order || 0) - (b.sort_order || 0);
        }
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });

      const idMap = new Map<number, number>();
      const usedIds = new Set<number>();
      let newIdCount = 0;
      const payloads: any[] = [];

      for (const document of orderedDocuments) {
        let targetId = Number(document?.id);

        if (!Number.isFinite(targetId) || targetId <= 0 || usedIds.has(targetId)) {
          targetId = await this.documentProvider.getNewId();
          newIdCount++;
          if (document.id) {
            this.logger.log(`文档ID冲突 (${document.id} -> ${targetId}): ${document.title}`);
          }
        }

        if (typeof document.id === 'number') {
          idMap.set(document.id, targetId);
        }
        usedIds.add(targetId);
        const { id, _id, __v, ...createDto } = document;
        const mappedParentId =
          createDto.parent_id === null || createDto.parent_id === undefined
            ? createDto.parent_id
            : idMap.get(createDto.parent_id) ?? createDto.parent_id;
        const mappedLibraryId =
          createDto.library_id === null || createDto.library_id === undefined
            ? createDto.library_id
            : idMap.get(createDto.library_id) ?? createDto.library_id;
        const mappedPath = Array.isArray(createDto.path)
          ? createDto.path.map((pathId: number) => idMap.get(pathId) ?? pathId)
          : [];

        payloads.push({
          ...createDto,
          id: targetId!,
          parent_id: mappedParentId,
          library_id: mappedLibraryId,
          path: mappedPath,
          deleted: createDto.deleted ?? false,
          createdAt: createDto.createdAt || new Date(),
          updatedAt: createDto.updatedAt || createDto.createdAt || new Date(),
        });
      }

      let processedCount = 0;
      await this.runWithConcurrency(
        payloads,
        this.getImportConcurrency(payloads.length, 6),
        async (payload) => {
          const newDocument = new this.documentProvider['documentModel'](payload);
          await newDocument.save();
          processedCount++;
          if (onProgress && this.shouldReportProgress(processedCount, orderedDocuments.length)) {
            await onProgress(processedCount, payload.title);
          }
        },
      );

      this.logger.log(
        `私密文档快速恢复完成: 创建 ${payloads.length} 个, 重新分配ID ${newIdCount} 个`,
      );
    } catch (error) {
      this.logger.error('批量导入私密文档失败:', error.message);
      throw error;
    }
  }

  private normalizeBackupPayload(data: any) {
    const mongoCollections = data?.rawCollections || data?.mongoCollections || {};
    const settings = data?.settings || this.getCollection(mongoCollections, ['settings']);

    return {
      ...data,
      articles: data?.articles ?? this.getCollection(mongoCollections, ['articles']),
      drafts: data?.drafts ?? this.getCollection(mongoCollections, ['drafts']),
      meta: data?.meta ?? this.getFirstDocument(mongoCollections, ['metas', 'meta']),
      categories: data?.categories ?? this.getCollection(mongoCollections, ['categories']),
      tags: data?.tags ?? this.getCollection(mongoCollections, ['tags']),
      user:
        data?.user ??
        (Array.isArray(data?.users)
          ? data.users.find((item: any) => item?.id === 0)
          : this.getAdminUserFromCollection(mongoCollections)),
      users: data?.users ?? this.getCollection(mongoCollections, ['users']),
      viewer: data?.viewer ?? this.getCollection(mongoCollections, ['viewers']),
      visit: data?.visit ?? this.getCollection(mongoCollections, ['visits']),
      static: data?.static ?? this.getCollection(mongoCollections, ['statics', 'static']),
      setting: data?.setting ?? this.buildLegacySettingPayload(settings),
      settings,
      moments: data?.moments ?? this.getCollection(mongoCollections, ['moments']),
      customPages:
        data?.customPages ?? this.getCollection(mongoCollections, ['custompages', 'customPages']),
      pipelines: data?.pipelines ?? this.getCollection(mongoCollections, ['pipelines']),
      tokens: data?.tokens ?? this.getCollection(mongoCollections, ['tokens']),
      navTools: data?.navTools ?? this.getCollection(mongoCollections, ['navtools', 'navTools']),
      navCategories:
        data?.navCategories ??
        this.getCollection(mongoCollections, ['navcategories', 'navCategories']),
      icons: data?.icons ?? this.getCollection(mongoCollections, ['icons']),
      layoutSetting: data?.layoutSetting ?? this.findSettingValue(settings, 'layout'),
      aiTaggingConfig: data?.aiTaggingConfig ?? this.findSettingValue(settings, 'aiTagging'),
      documents: data?.documents ?? this.getCollection(mongoCollections, ['documents']),
      mindMaps: data?.mindMaps ?? this.getCollection(mongoCollections, ['mindmaps', 'mindMaps']),
    };
  }

  private getCollection(collections: Record<string, any[]>, names: string[]) {
    for (const name of names) {
      if (Array.isArray(collections?.[name])) {
        return collections[name];
      }
    }
    return undefined;
  }

  private getFirstDocument(collections: Record<string, any[]>, names: string[]) {
    const docs = this.getCollection(collections, names);
    if (!Array.isArray(docs) || docs.length === 0) {
      return undefined;
    }
    return docs[0];
  }

  private getAdminUserFromCollection(collections: Record<string, any[]>) {
    const users = this.getCollection(collections, ['users']);
    if (!Array.isArray(users)) {
      return undefined;
    }
    return users.find((item: any) => item?.id === 0);
  }

  private buildLegacySettingPayload(settings: any[] | undefined) {
    const staticSetting = this.findSettingValue(settings, 'static');
    if (!staticSetting) {
      return undefined;
    }
    return {
      static: staticSetting,
    };
  }

  private findSettingValue(settings: any[] | undefined, type: string) {
    if (!Array.isArray(settings)) {
      return undefined;
    }
    const item = settings.find((setting) => setting?.type === type);
    return item?.value;
  }
}
