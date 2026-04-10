import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { InitDto } from 'src/types/init.dto';
import { MetaDocument } from 'src/scheme/meta.schema';
import { UserDocument } from 'src/scheme/user.schema';
import { WalineProvider } from '../waline/waline.provider';
import { SettingProvider } from '../setting/setting.provider';
import { version } from '../../utils/loadConfig';
import { encryptPassword, makeSalt } from 'src/utils/crypto';
import { defaultMenu } from 'src/types/menu.dto';
import { CacheProvider } from '../cache/cache.provider';
import fs from 'fs';
import path from 'path';
import { WebsiteProvider } from '../website/website.provider';
import { CategoryDocument } from 'src/scheme/category.schema';
import { CustomPageDocument } from 'src/scheme/customPage.schema';
import { StructuredDataService } from 'src/storage/structured-data.service';
@Injectable()
export class InitProvider {
  logger = new Logger(InitProvider.name);
  constructor(
    @InjectModel('Meta') private metaModel: Model<MetaDocument>,
    @InjectModel('User') private userModel: Model<UserDocument>,
    @InjectModel('Category') private categoryModal: Model<CategoryDocument>,
    @InjectModel('CustomPage')
    private customPageModal: Model<CustomPageDocument>,
    private readonly walineProvider: WalineProvider,
    private readonly settingProvider: SettingProvider,
    private readonly cacheProvider: CacheProvider,
    private readonly websiteProvider: WebsiteProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  private buildSiteInfoPayload(siteInfo: InitDto['siteInfo']) {
    const safeSiteInfo = siteInfo || ({} as InitDto['siteInfo']);
    const normalized = {
      ...safeSiteInfo,
      author: safeSiteInfo?.author || '',
      authorDesc: (safeSiteInfo as any)?.authorDesc || '',
      authorLogo: safeSiteInfo?.authorLogo || '',
      authorLogoDark: safeSiteInfo?.authorLogoDark || '',
      siteLogo: safeSiteInfo?.siteLogo || '',
      siteLogoDark: safeSiteInfo?.siteLogoDark || '',
      favicon: safeSiteInfo?.favicon || '',
      siteName: safeSiteInfo?.siteName || 'VanBlog',
      siteDesc: safeSiteInfo?.siteDesc || '',
      baseUrl: safeSiteInfo?.baseUrl || '',
    };
    if (normalized?.since) {
      return normalized;
    }
    return { ...normalized, since: new Date() };
  }

  private async upsertAdminUser(user: InitDto['user']) {
    const existingAdmin = await this.userModel.findOne({ id: 0 }).exec();
    const salt = makeSalt();
    const payload = {
      id: 0,
      name: user.username,
      password: encryptPassword(user.username, user.password, salt),
      nickname: user?.nickname || user.username,
      type: 'admin' as const,
      salt,
    };

    if (existingAdmin) {
      await this.userModel.updateOne({ id: 0 }, payload);
      const latestAdmin = await this.userModel.findOne({ id: 0 }).lean().exec();
      await this.structuredDataService.upsertUser(latestAdmin);
      return latestAdmin;
    }

    const admin = await this.userModel.create(payload);
    const plainAdmin = admin.toObject();
    await this.structuredDataService.upsertUser(plainAdmin);
    return plainAdmin;
  }

  private async upsertMeta(siteInfo: InitDto['siteInfo']) {
    const existingMeta = await this.metaModel.findOne().lean().exec();
    const payload = {
      siteInfo: {
        ...(existingMeta?.siteInfo || {}),
        ...siteInfo,
      },
      links: existingMeta?.links || [],
      socials: existingMeta?.socials || [],
      menus: existingMeta?.menus || [],
      rewards: existingMeta?.rewards || [],
      about: existingMeta?.about || {
        updatedAt: new Date(),
        content: '',
      },
      categories: existingMeta?.categories || [],
      viewer: existingMeta?.viewer || 0,
      visited: existingMeta?.visited || 0,
      totalWordCount: existingMeta?.totalWordCount || 0,
    };

    if (existingMeta) {
      await this.metaModel.updateOne({}, payload);
      const latestMeta = await this.metaModel.findOne().lean().exec();
      await this.structuredDataService.upsertMeta(latestMeta);
      return latestMeta;
    }

    const meta = await this.metaModel.create(payload);
    const plainMeta = meta.toObject();
    await this.structuredDataService.upsertMeta(plainMeta);
    return plainMeta;
  }

  async init(initDto: InitDto) {
    const { user, siteInfo } = initDto;
    const siteInfoPayload = this.buildSiteInfoPayload(siteInfo);
    if (!siteInfoPayload.author) {
      siteInfoPayload.author = user?.nickname || user?.username || 'VanBlog';
    }
    try {
      await this.upsertAdminUser(user);
      await this.upsertMeta(siteInfoPayload);
      await this.settingProvider.updateMenuSetting({ data: defaultMenu });
    } catch (err) {
      this.logger.error(`初始化核心数据失败: ${err?.message || err}`);
      throw new BadRequestException('初始化失败');
    }

    try {
      await this.walineProvider.init();
    } catch (err) {
      this.logger.warn(`初始化后同步 Waline 失败: ${err?.message || err}`);
    }

    try {
      await this.websiteProvider.restart('初始化');
    } catch (err) {
      this.logger.warn(`初始化后同步 Website 失败: ${err?.message || err}`);
    }

    return '初始化成功!';
  }

  async checkHasInited() {
    const user = await this.userModel.findOne({}).exec();
    if (!user) {
      return false;
    }
    return true;
  }
  async initRestoreKey() {
    const key = makeSalt();
    await this.cacheProvider.set('restoreKey', key);
    const filePath = path.join('/var/log/', 'restore.key');
    try {
      fs.writeFileSync(filePath, key, { encoding: 'utf-8' });
    } catch (err) {
      this.logger.error('写入恢复密钥到文件失败！');
    }
    this.logger.warn(
      `忘记密码恢复密钥为： ${key}\n 注意此密钥也会同时写入到日志目录中的 restore.key 文件中，每次重启 vanblog 或老密钥被使用时都会重新生成此密钥`,
    );
  }

  async washStaticSetting() {
    // 新版加入了图床自动压缩功能，默认开启，需要洗一下。
    const staticSetting = await this.settingProvider.getStaticSetting();
    console.log(staticSetting);
    if (staticSetting && staticSetting.enableWebp === undefined) {
      this.logger.log('新版本自动开启图床压缩功能');
      await this.settingProvider.updateStaticSetting({
        enableWebp: true,
      });
    }
  }

  async washCustomPage() {
    // 老版本的 custom 表没带 type，洗一下加上
    const all = await this.customPageModal.find({
      type: {
        $exists: false,
      },
    });
    if (all && all.length) {
      for (const each of all) {
        this.logger.log(`清洗老版本自定义页面数据：${each.name}`);
        await this.customPageModal.updateOne(
          {
            _id: each._id,
          },
          {
            type: 'file',
          },
        );
      }
    }
  }

  async washCategory() {
    //! 因为新增了 category 的表，所以需要清洗数据。
    // 条件： meta.category 有数据，但 category 表为空。
    const meta = await this.metaModel.findOne();
    const categoryInMeta = meta?.categories || [];
    const data = await this.categoryModal.find({});
    if (!data.length && !!categoryInMeta.length) {
      this.logger.warn('版本升级，自动清洗分类数据！');
      let i = 1;
      for (const c of categoryInMeta) {
        await this.categoryModal.create({
          id: i,
          name: c,
          type: 'category',
          private: false,
          password: '',
        });
        i = i + 1;
      }
      this.logger.warn(`清洗完成！共 ${i} 条！`);
    }
  }
  async initVersion() {
    if (!version || version == 'dev') {
      this.logger.debug('开发版本');
      return;
    }
    try {
      const versionSetting = await this.settingProvider.getVersionSetting();
      if (!versionSetting || !versionSetting?.version) {
        // 没有版本信息，加进去
        await this.settingProvider.updateVersionSetting({
          version: version,
        });
      } else {
        // TODO 后面这里会判断版本执行一些版本迁移的数据清洗脚本
        await this.settingProvider.updateVersionSetting({
          version,
        });
      }
    } catch (err) {
      this.logger.error(`初始化版本信息失败: ${JSON.stringify(err, null, 2)}`);
    }
  }
}
