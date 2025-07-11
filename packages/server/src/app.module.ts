import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from './config/index';
import { Article, ArticleSchema } from './scheme/article.schema';
import { Draft, DraftSchema } from './scheme/draft.schema';
import { Meta, MetaSchema } from './scheme/meta.schema';
import { Tag, TagSchema } from './scheme/tag.schema';
import { ArticleProvider } from './provider/article/article.provider';
import { CategoryProvider } from './provider/category/category.provider';
import { DraftProvider } from './provider/draft/draft.provider';
import { MetaProvider } from './provider/meta/meta.provider';
import { TagProvider } from './provider/tag/tag.provider';
import { PublicController } from './controller/public/public.controller';
import { AboutMetaController } from './controller/admin/about/about.meta.controller';
import { LinkMetaController } from './controller/admin/link/link.meta.controller';
import { RewardMetaController } from './controller/admin/reward/reward.meta.controller';
import { SiteMetaController } from './controller/admin/site/site.meta.controller';
import { SocialMetaController } from './controller/admin/social/social.meta.controller';
import { ViewerMetaController } from './controller/admin/meta/viewer.meta.controller';
import { TagController } from './controller/admin/tag/tag.controller';
import { ArticleController } from './controller/admin/article/article.controller';
import { DraftController } from './controller/admin/draft/draft.controller';
import { CategoryController } from './controller/admin/category/category.controller';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controller/admin/auth/auth.controller';
import { UserProvider } from './provider/user/user.provider';
import { AuthProvider } from './provider/auth/auth.provider';
import { User, UserSchema } from './scheme/user.schema';
import { LocalStrategy } from './provider/auth/local.strategy';
import { JwtStrategy } from './provider/auth/jwt.strategy';
import { InitController } from './controller/admin/init/init.controller';
import { InitProvider } from './provider/init/init.provider';
import { InitMiddleware } from './provider/auth/init.middleware';
import { BackupController } from './controller/admin/backup/backup.controller';
import { MenuMetaController } from './controller/admin/menu/menu.meta.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { Viewer, ViewerSchema } from './scheme/viewer.schema';
import { ViewerProvider } from './provider/viewer/viewer.provider';
import { Visit, VisitSchema } from './scheme/visit.schema';
import { VisitProvider } from './provider/visit/visit.provider';
import { MetaController } from './controller/admin/meta/meta.controller';
import { AnalysisController } from './controller/admin/analysis/analysis.controller';
import { AnalysisProvider } from './provider/analysis/analysis.provider';
import { Setting, SettingSchema } from './scheme/setting.schema';
import { Static, StaticSchema } from './scheme/static.schema';
import { SettingProvider } from './provider/setting/setting.provider';
import { StaticProvider } from './provider/static/static.provider';
import { ImgController } from './controller/admin/img/img.controller';
import { LocalProvider } from './provider/static/local.provider';
import { SettingController } from './controller/admin/setting/setting.controller';
import { PicgoProvider } from './provider/static/picgo.provider';
import { ViewerTask } from './schedule/viewer.task';
import { CaddyController } from './controller/admin/caddy/caddy.controller';
import { CaddyProvider } from './provider/caddy/caddy.provider';
import { LogProvider } from './provider/log/log.provider';
import { LogController } from './controller/admin/log/log.controller';
import { ISRProvider } from './provider/isr/isr.provider';
import { WalineProvider } from './provider/waline/waline.provider';
import { CacheProvider } from './provider/cache/cache.provider';
import { LoginGuard } from './provider/auth/login.guard';
import { AccessGuard } from './provider/access/access.guard';
import { CollaboratorController } from './controller/admin/collaborator/collaborator.controller';
import { ISRController } from './controller/admin/isr/isr.controller';
import { ISRTask } from './schedule/isr.task';
import { CustomPage, CustomPageSchema } from './scheme/customPage.schema';
import { CustomPageProvider } from './provider/customPage/customPage.provider';
import { CustomPageController } from './controller/admin/customPage/customPage.controller';
import { RssProvider } from './provider/rss/rss.provider';
import { MarkdownProvider } from './provider/markdown/markdown.provider';
import { SiteMapProvider } from './provider/sitemap/sitemap.provider';
import { TokenProvider } from './provider/token/token.provider';
import { Token, TokenSchema } from './scheme/token.schema';
import { TokenGuard } from './provider/auth/token.guard';
import { WebsiteProvider } from './provider/website/website.provider';
import { Category, CategorySchema } from './scheme/category.schema';
import {
  PublicCustomPageController,
  PublicOldCustomPageRedirectController,
} from './controller/customPage/customPage.controller';
import { Pipeline, PipelineSchema } from './scheme/pipeline.schema';
import { PipelineProvider } from './provider/pipeline/pipeline.provider';
import { PipelineController } from './controller/admin/pipeline/pipeline.controller';
import { TokenController } from './controller/admin/token/token.controller';
import { initJwt } from './utils/initJwt';
import { Moment, MomentSchema } from './scheme/moment.schema';
import { MomentProvider } from './provider/moment/moment.provider';
import { MomentController } from './controller/admin/moment/moment.controller';
import { PublicMomentController } from './controller/public/moment/moment.controller';
import { Icon, IconSchema } from './scheme/icon.schema';
import { IconProvider } from './provider/icon/icon.provider';
import { IconController } from './controller/admin/icon/icon.controller';
import { NavTool, NavToolSchema } from './scheme/nav-tool.schema';
import { NavCategory, NavCategorySchema } from './scheme/nav-category.schema';
import { NavToolProvider } from './provider/nav-tool/nav-tool.provider';
import { NavCategoryProvider } from './provider/nav-category/nav-category.provider';
import { NavToolController } from './controller/admin/nav-tool/nav-tool.controller';
import { NavCategoryController } from './controller/admin/nav-category/nav-category.controller';
import { NavController } from './controller/public/nav/nav.controller';
import { AITaggingController } from './controller/admin/ai-tagging/ai-tagging.controller';
import { AITaggingProvider } from './provider/ai-tagging/ai-tagging.provider';
import { AutoBackupController } from './controller/admin/auto-backup/auto-backup.controller';
import { AutoBackupTask } from './schedule/auto-backup.task';
import { AliyunpanProvider } from './provider/aliyunpan/aliyunpan.provider';
import { MusicController } from './controller/admin/music/music.controller';
import { Document, DocumentSchema } from './scheme/document.schema';
import { DocumentProvider } from './provider/document/document.provider';
import { DocumentController } from './controller/admin/document/document.controller';

@Module({
  imports: [
    MongooseModule.forRoot(config.mongoUrl, {
      autoIndex: true,
    }),
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: Draft.name, schema: DraftSchema },
      { name: Meta.name, schema: MetaSchema },
      { name: Tag.name, schema: TagSchema },
      { name: User.name, schema: UserSchema },
      { name: Viewer.name, schema: ViewerSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: Setting.name, schema: SettingSchema },
      { name: Static.name, schema: StaticSchema },
      { name: CustomPage.name, schema: CustomPageSchema },
      { name: Token.name, schema: TokenSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Pipeline.name, schema: PipelineSchema },
      { name: Moment.name, schema: MomentSchema },
      { name: Icon.name, schema: IconSchema },
      { name: NavTool.name, schema: NavToolSchema },
      { name: NavCategory.name, schema: NavCategorySchema },
      { name: Document.name, schema: DocumentSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: async () => {
        return {
          secret: await initJwt(),
          signOptions: {
            expiresIn: 3600 * 24 * 7,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    AppController,
    PublicController,
    AboutMetaController,
    LinkMetaController,
    RewardMetaController,
    SiteMetaController,
    SocialMetaController,
    ViewerMetaController,
    TagController,
    ArticleController,
    DraftController,
    CategoryController,
    AuthController,
    InitController,
    MenuMetaController,
    BackupController,
    MetaController,
    AnalysisController,
    SettingController,
    ImgController,
    CaddyController,
    LogController,
    CollaboratorController,
    ISRController,
    CustomPageController,
    PublicCustomPageController,
    PublicOldCustomPageRedirectController,
    PipelineController,
    TokenController,
    MomentController,
    PublicMomentController,
    IconController,
    NavToolController,
    NavCategoryController,
    NavController,
    AITaggingController,
    AutoBackupController,
    MusicController,
    DocumentController,
  ],
  providers: [
    AppService,
    ArticleProvider,
    CategoryProvider,
    MetaProvider,
    DraftProvider,
    PicgoProvider,
    VisitProvider,
    TagProvider,
    UserProvider,
    AuthProvider,
    LocalStrategy,
    ViewerProvider,
    JwtStrategy,
    InitProvider,
    AnalysisProvider,
    SettingProvider,
    StaticProvider,
    LocalProvider,
    ViewerTask,
    CaddyProvider,
    LogProvider,
    ISRProvider,
    WalineProvider,
    CacheProvider,
    LoginGuard,
    AccessGuard,
    ISRTask,
    CustomPageProvider,
    RssProvider,
    MarkdownProvider,
    SiteMapProvider,
    TokenProvider,
    TokenGuard,
    WebsiteProvider,
    PipelineProvider,
    MomentProvider,
    IconProvider,
    NavToolProvider,
    NavCategoryProvider,
    AITaggingProvider,
    AutoBackupTask,
    AliyunpanProvider,
    DocumentProvider,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(InitMiddleware)
      .exclude(
        { path: '/api/admin/init/check', method: RequestMethod.GET },
        { path: '/api/admin/init', method: RequestMethod.POST },
        { path: '/api/admin/init/upload', method: RequestMethod.POST }
      )
      .forRoutes('*');
  }
}
