import {
  Body,
  Controller,
  Get,
  Post,
  Put,
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
import * as dayjs from 'dayjs';
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
  ) {}

  @Get('export')
  async getAll(@Res() res: Response) {
    try {
      this.logger.log('开始导出全部数据...');
      
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
        documents,
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
        this.documentProvider.getByOption({ page: 1, pageSize: -1 }).then(result => result.documents),
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
        documents,
        backupInfo: {
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          dataTypes: [
            'articles', 'tags', 'meta', 'drafts', 'categories', 'user',
            'viewer', 'visit', 'static', 'setting', 'moments', 'customPages',
            'pipelines', 'tokens', 'navTools', 'navCategories', 'icons',
            'layoutSetting', 'aiTaggingConfig', 'documents'
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
            documents: documents?.length || 0,
          }
        }
      };

      this.logger.log(`数据导出完成，共包含 ${Object.keys(data.backupInfo.counts).length} 种数据类型`);

    const name = `temp.json`;
    fs.writeFileSync(name, JSON.stringify(data, null, 2));
    res.download(name, (err) => {
      if (!err) {
          this.logger.log('备份文件下载成功');
        return;
      }
        this.logger.error('备份文件下载失败', err.stack);
      fs.rmSync(name);
    });
    } catch (error) {
      this.logger.error('导出数据时发生错误', error.stack);
      res.status(500).json({
        statusCode: 500,
        message: '导出失败：' + error.message,
      });
    }
  }

  @Post('/import')
  @UseInterceptors(FileInterceptor('file'))
  async importAll(@UploadedFile() file: Express.Multer.File) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    try {
      this.logger.log('开始导入数据...');
      
    const json = file.buffer.toString();
    const data = JSON.parse(json);
      
      const backupVersion = data.backupInfo?.version || '1.0.0';
      this.logger.log(`检测到备份版本: ${backupVersion}`);

          const { meta, user, setting, layoutSetting, aiTaggingConfig } = data;
      let { articles, drafts, viewer, visit, static: staticItems, moments, customPages, pipelines, tokens, navTools, navCategories, icons, documents } = data;

      if (articles) articles = removeID(articles);
      if (drafts) drafts = removeID(drafts);
      if (viewer) viewer = removeID(viewer);
      if (visit) visit = removeID(visit);
      if (staticItems) staticItems = removeID(staticItems);
      if (moments) moments = removeID(moments);
      if (customPages) customPages = removeID(customPages);
      if (pipelines) pipelines = removeID(pipelines);
      if (tokens) tokens = removeID(tokens);
      if (navTools) navTools = removeID(navTools);
      if (navCategories) navCategories = removeID(navCategories);
      if (icons) icons = removeID(icons);
      if (documents) documents = removeID(documents);

    if (setting && setting.static) {
      setting.static = { ...setting.static, _id: undefined, __v: undefined };
    }
      if (user) {
    delete user._id;
    delete user.__v;
      }
      if (meta) {
    delete meta._id;
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
        other: 0,
      };

      // 跳过用户数据导入，避免覆盖登录信息
      if (user) {
        this.logger.log('跳过用户数据导入（避免覆盖登录信息）');
      }

      // 导入元数据，但排除 siteInfo
      if (meta) {
        const { siteInfo, ...metaWithoutSiteInfo } = meta;
        if (Object.keys(metaWithoutSiteInfo).length > 0) {
          await this.metaProvider.update(metaWithoutSiteInfo);
          this.logger.log('元数据导入完成（已排除站点信息）');
        }
        if (siteInfo) {
          this.logger.log('跳过站点信息导入（避免覆盖站点配置）');
        }
      }

      if (setting) {
    await this.settingProvider.importSetting(setting);
        this.logger.log('设置数据导入完成');
      }

      if (data.categories) {
        await this.importCategoriesWithRebuild(data.categories);
        importResults.categories = data.categories.length;
        this.logger.log(`分类数据导入完成: ${importResults.categories} 条`);
      }

      if (data.tags) {
        importResults.tags = data.tags.length;
        this.logger.log(`标签数据准备完成: ${importResults.tags} 条`);
      }

      if (articles) {
        // 先自动创建文章分类
        await this.autoCreateCategoriesFromContent(articles, 'articles');
        
        await this.importArticlesEnhanced(articles);
        importResults.articles = articles.length;
        this.logger.log(`文章数据增量导入完成: ${importResults.articles} 条`);
      }

      if (drafts) {
        // 先自动创建草稿分类
        await this.autoCreateCategoriesFromContent(drafts, 'drafts');
        
        await this.importDraftsEnhanced(drafts);
        importResults.drafts = drafts.length;
        this.logger.log(`草稿数据增量导入完成: ${importResults.drafts} 条`);
      }

      if (moments) {
        await this.importMomentsEnhanced(moments);
        importResults.moments = moments.length;
        this.logger.log(`动态数据增量导入完成: ${importResults.moments} 条`);
      }

      if (customPages) {
        await this.importCustomPagesEnhanced(customPages);
        importResults.customPages = customPages.length;
        this.logger.log(`自定义页面导入完成: ${importResults.customPages} 条`);
      }

      if (navCategories) {
        await this.importNavCategoriesEnhanced(navCategories);
        importResults.navCategories = navCategories.length;
        this.logger.log(`导航分类导入完成: ${importResults.navCategories} 条`);
      }

      if (navTools) {
        // 先确保所有需要的导航分类都存在
        await this.autoCreateNavCategoriesFromTools(navTools);
        
        await this.importNavToolsEnhanced(navTools);
        importResults.navTools = navTools.length;
        this.logger.log(`导航工具导入完成: ${importResults.navTools} 条`);
      }

      if (icons) {
        await this.importIconsEnhanced(icons);
        importResults.icons = icons.length;
        this.logger.log(`图标数据导入完成: ${importResults.icons} 条`);
      }

      if (pipelines) {
        await this.importPipelinesEnhanced(pipelines);
        importResults.pipelines = pipelines.length;
        this.logger.log(`流水线数据导入完成: ${importResults.pipelines} 条`);
      }

      if (tokens) {
        await this.importTokensEnhanced(tokens);
        importResults.tokens = tokens.length;
        this.logger.log(`Token数据导入完成: ${importResults.tokens} 条`);
      }

      if (staticItems) {
        this.logger.log(`开始导入静态文件记录: ${staticItems.length} 条`);
        await this.staticProvider.importItems(staticItems, false); // false = 不清空现有记录，增量导入
        importResults.staticItems = staticItems.length;
        this.logger.log(`静态文件记录导入完成: ${importResults.staticItems} 条`);
      }

    if (visit) {
      await this.visitProvider.import(visit);
        this.logger.log('访问记录导入完成');
    }

    if (viewer) {
      await this.viewerProvider.import(viewer);
        this.logger.log('访客记录导入完成');
    }

      // 导入定制化设置（增量导入）
      if (layoutSetting && Object.keys(layoutSetting).length > 0) {
        try {
          await this.settingProvider.updateLayoutSetting(layoutSetting);
          importResults.layoutSetting = 1;
          this.logger.log('定制化设置导入完成');
          // 触发ISR更新
          this.isrProvider.activeAll('导入定制化设置');
        } catch (error) {
          this.logger.warn(`定制化设置导入失败: ${error.message}`);
        }
      } else {
        this.logger.log('备份文件中未发现定制化设置数据或数据为空');
      }

      // 导入AI标签配置（直接覆盖）
      if (aiTaggingConfig && Object.keys(aiTaggingConfig).length > 0) {
        try {
          await this.aiTaggingProvider.updateConfig(aiTaggingConfig);
          importResults.aiTaggingConfig = 1;
          this.logger.log('AI标签配置导入完成（覆盖模式）');
        } catch (error) {
          this.logger.warn(`AI标签配置导入失败: ${error.message}`);
        }
      } else {
        this.logger.log('备份文件中未发现AI标签配置数据或数据为空');
      }

      // 导入私密文档库数据
      if (documents && documents.length > 0) {
        try {
          await this.importDocumentsEnhanced(documents);
          importResults.documents = documents.length;
          this.logger.log(`私密文档库数据导入完成: ${importResults.documents} 条`);
        } catch (error) {
          this.logger.warn(`私密文档库数据导入失败: ${error.message}`);
        }
      } else {
        this.logger.log('备份文件中未发现私密文档库数据或数据为空');
      }

      // 自动同步标签数据
      try {
        this.logger.log('开始同步标签数据...');
        await this.tagProvider.syncTagsFromArticles();
        this.logger.log('标签数据同步完成');
        
        // 触发标签相关页面的ISR更新
        this.isrProvider.activeUrl('/tag', false);
        this.isrProvider.activePath('tag');
      } catch (error) {
        this.logger.error('标签数据同步失败:', error.message);
      }

      this.logger.log('所有数据导入完成！', importResults);

    return {
      statusCode: 200,
      data: '导入成功！',
        importResults,
      };
    } catch (error) {
      this.logger.error('导入数据时发生错误', error.stack);
      return {
        statusCode: 500,
        message: '导入失败：' + error.message,
      };
    }
  }

  @Post('/clear-all')
  async clearAllData() {
    if (config.demo && config.demo == 'true') {
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
        const momentsResult = await this.momentProvider.getByOption({ page: 1, pageSize: -1 }, false);
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
        const customPages = await this.customPageProvider.getAll();
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

      // 6. 清空分类和标签（在文章清空后）
      try {
        const categories = await this.categoryProvider.getAllCategories(true) as any[];
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
        // 使用MongoDB的deleteMany进行批量物理删除
        await this.staticProvider['staticModel'].deleteMany({});
        clearResults.staticItems = staticItems?.length || 0;
        this.logger.log(`清空静态文件记录完成: ${clearResults.staticItems} 条`);
      } catch (error) {
        this.logger.error('清空静态文件记录失败:', error.message);
      }

      // 9. 清空API Token（保留用户登录token）
      try {
        await this.tokenProvider.disableAllAdmin();
        this.logger.log('清空API Token完成');
      } catch (error) {
        this.logger.error('清空API Token失败:', error.message);
      }

      // 10. 完全清空meta表、用户表和settings表，让网站回到未初始化状态
      try {
        // 使用MongoDB的deleteMany完全删除meta记录
        await this.metaProvider['metaModel'].deleteMany({});
        this.logger.log('清空网站元数据完成');
        
        // 清空用户表，让系统回到未初始化状态
        await this.userProvider['userModel'].deleteMany({});
        this.logger.log('清空用户数据完成');
        
        // 清空settings表
        await this.settingProvider['settingModel'].deleteMany({});
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
          continue;
        }

        // 验证分类名称
        if (!categoryName || categoryName.trim() === '') {
          this.logger.warn(`跳过空分类名称: ${JSON.stringify(category)}`);
          continue;
        }

        // 获取所有现有分类
        const allCategories = await this.categoryProvider.getAllCategories(true) as any[];
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
      } catch (error) {
        this.logger.warn(`分类 ${category} 导入失败: ${error.message}`);
      }
    }
  }

  private async importDraftsEnhanced(drafts: any[]) {
    if (!drafts || drafts.length === 0) return;

    try {
      this.logger.log(`开始增量导入 ${drafts.length} 个草稿...`);
      let newIdCount = 0;
      let updatedCount = 0;
      let createdCount = 0;

      for (const draft of drafts) {
        try {
          let targetId = draft.id;
          
          // 检查ID是否冲突（包括软删除的记录）
          if (targetId) {
            const existingDraft = await this.draftProvider['draftModel'].findOne({ id: targetId });
            if (existingDraft) {
              // ID冲突，分配新ID
              targetId = await this.draftProvider.getNewId();
              newIdCount++;
              this.logger.log(`草稿ID冲突 (${draft.id} -> ${targetId}): ${draft.title}`);
            }
          } else {
            // 没有ID，分配新ID
            targetId = await this.draftProvider.getNewId();
            newIdCount++;
          }

          const { id, _id, __v, ...createDto } = draft;
          
          // 先尝试根据标题查找是否已存在相同草稿（只查未删除的）
          const existingByTitle = await this.draftProvider.findOneByTitle(draft.title);
          if (existingByTitle && !existingByTitle.deleted) {
            // 更新现有草稿
            await this.draftProvider.updateById(existingByTitle.id, { 
              ...createDto, 
              deleted: false,
              updatedAt: new Date(),
            });
            updatedCount++;
            this.logger.log(`更新草稿: ${draft.title}`);
          } else {
            // 创建新草稿，手动设置ID
            const newDraft = new this.draftProvider['draftModel']({
              ...createDto,
              id: targetId,  
              updatedAt: createDto.updatedAt || new Date(),
            });
            await newDraft.save();
            createdCount++;
          }
        } catch (error) {
          this.logger.error(`导入草稿失败 (${draft.title}): ${error.message}`);
        }
      }

      this.logger.log(`草稿增量导入完成: 创建 ${createdCount} 个, 更新 ${updatedCount} 个, 重新分配ID ${newIdCount} 个`);
    } catch (error) {
      this.logger.error('批量导入草稿失败:', error.message);
      throw error;
    }
  }

  private async importMomentsEnhanced(moments: any[]) {
    if (!moments || moments.length === 0) return;

    try {
      this.logger.log(`开始增量导入 ${moments.length} 个动态...`);
      let newIdCount = 0;
      let updatedCount = 0;
      let createdCount = 0;

      for (const moment of moments) {
        try {
          let targetId = moment.id;
          
          // 检查ID是否冲突（包括软删除的记录）
          if (targetId) {
            const existingMoment = await this.momentProvider['momentModel'].findOne({ id: targetId });
            if (existingMoment) {
              // ID冲突，分配新ID
              targetId = await this.momentProvider.getNewId();
              newIdCount++;
              this.logger.log(`动态ID冲突 (${moment.id} -> ${targetId})`);
            }
          } else {
            // 没有ID，分配新ID
            targetId = await this.momentProvider.getNewId();
            newIdCount++;
          }

          const { id, _id, __v, ...createDto } = moment;
          
          // 尝试根据内容和时间查找是否已存在相同动态（只查未删除的）
          let existingByContent = null;
          if (moment.content && moment.createdAt) {
            existingByContent = await this.momentProvider['momentModel'].findOne({
              content: moment.content,
              createdAt: moment.createdAt,
              $or: [
                { deleted: false },
                { deleted: { $exists: false } }
              ]
            });
          }

          if (existingByContent) {
            // 更新现有动态
            await this.momentProvider.updateById(existingByContent.id, {
              ...createDto,
              deleted: false,
              updatedAt: new Date(),
            });
            updatedCount++;
            this.logger.log(`更新动态: ${moment.content?.substring(0, 50)}...`);
          } else {
            // 创建新动态，手动设置ID
            const newMoment = new this.momentProvider['momentModel']({
              ...createDto,
              id: targetId,
              createdAt: createDto.createdAt || new Date(),
              updatedAt: createDto.updatedAt || new Date(),
            });
            await newMoment.save();
            createdCount++;
          }
        } catch (error) {
          this.logger.error(`导入动态失败: ${error.message}`);
        }
      }

      this.logger.log(`动态增量导入完成: 创建 ${createdCount} 个, 更新 ${updatedCount} 个, 重新分配ID ${newIdCount} 个`);
    } catch (error) {
      this.logger.error('批量导入动态失败:', error.message);
      throw error;
    }
  }

  private async importCustomPagesEnhanced(customPages: any[]) {
    for (const page of customPages) {
      try {
        const existingPage = await this.customPageProvider.getCustomPageByPath(page.path);
        if (existingPage) {
          await this.customPageProvider.updateCustomPage(page);
        } else {
          await this.customPageProvider.createCustomPage(page);
        }
      } catch (error) {
        this.logger.warn(`自定义页面 ${page.path} 导入失败: ${error.message}`);
      }
    }
  }

  private async importNavCategoriesEnhanced(navCategories: any[]) {
    for (const category of navCategories) {
      try {
        // 获取所有导航分类
        const allCategories = await this.navCategoryProvider.getAllCategories();
        const existing = allCategories.find(c => c.name === category.name);
        
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
      } catch (error) {
        this.logger.warn(`导航分类 ${category.name} 导入失败: ${error.message}`);
      }
    }
  }

  private async importNavToolsEnhanced(navTools: any[]) {
    for (const tool of navTools) {
      try {
        // 根据 categoryName 查找分类，而不是 categoryId
        const allCategories = await this.navCategoryProvider.getAllCategories();
        const category = allCategories.find(c => c.name === tool.categoryName);
        
        if (!category) {
          this.logger.warn(`导航工具 ${tool.name} 的分类 ${tool.categoryName} 不存在，跳过导入`);
          continue;
        }

        // 获取所有导航工具
        const allTools = await this.navToolProvider.getAllTools();
        const existing = allTools.find(t => t.name === tool.name);
        
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
      } catch (error) {
        this.logger.warn(`导航工具 ${tool.name} 导入失败: ${error.message}`);
      }
    }
  }

  private async importIconsEnhanced(icons: any[]) {
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
      } catch (error) {
        this.logger.warn(`图标 ${icon.name} 导入失败: ${error.message}`);
      }
    }
  }

  private async importPipelinesEnhanced(pipelines: any[]) {
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
      } catch (error) {
        this.logger.warn(`流水线 ${pipeline.name || 'unknown'} 导入失败: ${error.message}`);
      }
    }
  }

  private async importTokensEnhanced(tokens: any[]) {
    // TokenProvider 缺少完整的CRUD方法，暂时跳过Token导入
    // TODO: 在TokenProvider中添加完整的CRUD方法后再实现
    this.logger.warn(`Token导入功能暂未完全实现，跳过 ${tokens?.length || 0} 个Token的导入`);
  }

  private async importArticlesEnhanced(articles: any[]) {
    if (!articles || articles.length === 0) return;

    try {
      this.logger.log(`开始增量导入 ${articles.length} 篇文章...`);
      let newIdCount = 0;
      let updatedCount = 0;
      let createdCount = 0;

      for (const article of articles) {
        let targetId = article.id;
        
        // 检查ID是否冲突（包括软删除的记录）
        if (targetId) {
          const existingArticle = await this.articleProvider['articleModel'].findOne({ id: targetId });
          if (existingArticle) {
            // ID冲突，分配新ID
            targetId = await this.articleProvider.getNewId();
            newIdCount++;
            this.logger.log(`文章ID冲突 (${article.id} -> ${targetId}): ${article.title}`);
          }
        } else {
          // 没有ID，分配新ID
          targetId = await this.articleProvider.getNewId();
          newIdCount++;
        }

        const { id, _id, __v, ...createDto } = article;
        
        try {
          // 先尝试根据标题查找是否已存在相同文章（只查未删除的）
          const existingByTitle = await this.articleProvider.findOneByTitle(article.title);
          if (existingByTitle && !existingByTitle.deleted) {
            // 更新现有文章
            await this.articleProvider.updateById(
              existingByTitle.id,
              {
                ...createDto,
                deleted: false,
                updatedAt: new Date(),
              },
              true
            );
            updatedCount++;
            this.logger.log(`更新文章: ${article.title}`);
          } else {
            // 创建新文章
            await this.articleProvider.create(
              {
                ...createDto,
                updatedAt: createDto.updatedAt || createDto.createdAt || new Date(),
              },
              true,
              targetId
            );
            createdCount++;
          }
        } catch (error) {
          this.logger.error(`导入文章失败 (${article.title}): ${error.message}`);
        }
      }

      this.logger.log(`文章增量导入完成: 创建 ${createdCount} 篇, 更新 ${updatedCount} 篇, 重新分配ID ${newIdCount} 篇`);
      await this.metaProvider.updateTotalWords('增量导入文章');
    } catch (error) {
      this.logger.error('批量导入文章失败:', error.message);
      throw error;
    }
  }

  private async autoCreateCategoriesFromContent(content: any[], contentType: string) {
    if (!content || content.length === 0) return;

    try {
      // 收集所有分类名称
      const categoryNames = new Set<string>();
      content.forEach(item => {
        if (item.category && typeof item.category === 'string' && item.category.trim()) {
          categoryNames.add(item.category.trim());
        }
      });

      if (categoryNames.size === 0) {
        this.logger.log(`${contentType} 中没有发现需要创建的分类`);
        return;
      }

      // 获取现有分类（明确指定返回字符串数组）
      const existingCategories = await this.categoryProvider.getAllCategories(false) as string[];
      const existingCategoryNames = new Set(existingCategories);

      let createdCount = 0;
      for (const categoryName of categoryNames) {
        if (!existingCategoryNames.has(categoryName)) {
          try {
            await this.categoryProvider.addOne(categoryName);
            createdCount++;
            this.logger.log(`自动创建分类: ${categoryName}`);
          } catch (error) {
            this.logger.warn(`创建分类 ${categoryName} 失败: ${error.message}`);
          }
        }
      }

      this.logger.log(`${contentType} 分类自动创建完成: 新建 ${createdCount} 个分类`);
    } catch (error) {
      this.logger.error(`自动创建${contentType}分类失败:`, error.message);
    }
  }

  private async autoCreateNavCategoriesFromTools(navTools: any[]) {
    if (!navTools || navTools.length === 0) return;

    try {
      // 收集所有需要的导航分类名称
      const categoryNames = new Set<string>();
      navTools.forEach(tool => {
        if (tool.categoryName && typeof tool.categoryName === 'string' && tool.categoryName.trim()) {
          categoryNames.add(tool.categoryName.trim());
        }
      });

      if (categoryNames.size === 0) {
        this.logger.log('导航工具中没有发现需要创建的分类');
        return;
      }

      // 获取现有导航分类
      const existingCategories = await this.navCategoryProvider.getAllCategories();
      const existingCategoryNames = new Set(existingCategories.map(c => c.name));

      let createdCount = 0;
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
          }
        }
      }

      this.logger.log(`导航分类自动创建完成: 新建 ${createdCount} 个分类`);
    } catch (error) {
      this.logger.error('自动创建导航分类失败:', error.message);
    }
  }

  private async importDocumentsEnhanced(documents: any[]) {
    if (!documents || documents.length === 0) return;

    try {
      this.logger.log(`开始增量导入 ${documents.length} 个私密文档...`);
      let newIdCount = 0;
      let updatedCount = 0;
      let createdCount = 0;

      for (const document of documents) {
        let targetId = document.id;
        
        // 检查ID是否冲突（包括软删除的记录）
        if (targetId) {
          const existingDocument = await this.documentProvider['documentModel'].findOne({ id: targetId });
          if (existingDocument) {
            // ID冲突，分配新ID
            targetId = await this.documentProvider.getNewId();
            newIdCount++;
            this.logger.log(`文档ID冲突 (${document.id} -> ${targetId}): ${document.title}`);
          }
        } else {
          // 没有ID，分配新ID
          targetId = await this.documentProvider.getNewId();
          newIdCount++;
        }

        const { id, _id, __v, ...createDto } = document;
        
        try {
          // 先尝试根据标题查找是否已存在相同文档（只查未删除的）
          const existingByTitle = await this.documentProvider['documentModel'].findOne({ 
            title: document.title, 
            deleted: false 
          });
          if (existingByTitle) {
            // 更新现有文档
            await this.documentProvider.updateById(
              existingByTitle.id,
              {
                ...createDto,
                deleted: false,
                updatedAt: new Date(),
              }
            );
            updatedCount++;
            this.logger.log(`更新文档: ${document.title}`);
          } else {
            // 创建新文档
            await this.documentProvider.create({
              ...createDto,
              id: targetId,
              updatedAt: createDto.updatedAt || createDto.createdAt || new Date(),
            });
            createdCount++;
          }
        } catch (error) {
          this.logger.error(`导入文档失败 (${document.title}): ${error.message}`);
        }
      }

      this.logger.log(`私密文档增量导入完成: 创建 ${createdCount} 个, 更新 ${updatedCount} 个, 重新分配ID ${newIdCount} 个`);
    } catch (error) {
      this.logger.error('批量导入私密文档失败:', error.message);
      throw error;
    }
  }
}
