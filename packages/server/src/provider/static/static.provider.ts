import { HttpException, HttpStatus, Injectable, NotImplementedException, Optional } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { SearchStaticOption, StaticType, StorageType } from 'src/types/setting.dto';
import { Static, StaticDocument } from 'src/scheme/static.schema';
import { encryptFileMD5 } from 'src/utils/crypto';
import { ArticleProvider } from '../article/article.provider';
import { SettingProvider } from '../setting/setting.provider';
import { MetaProvider } from '../meta/meta.provider';
import { LocalProvider } from './local.provider';
import { PicgoProvider } from './picgo.provider';
import { imageSize } from 'image-size';
import { ImgMeta } from 'src/types/img';
import { formatBytes } from 'src/utils/size';
import axios from 'axios';
import { UploadConfig } from 'src/types/upload';
import { addWaterMarkToIMG } from 'src/utils/watermark';
import { checkTrue } from 'src/utils/checkTrue';
import { compressImgToWebp } from 'src/utils/webp';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { config } from 'src/config';
import { StoragePath } from 'src/types/setting.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StaticProvider {
  constructor(
    @InjectModel('Static')
    private staticModel: Model<StaticDocument>,
    private readonly settingProvider: SettingProvider,
    private readonly metaProvider: MetaProvider,
    private readonly localProvider: LocalProvider,
    private readonly articleProvder: ArticleProvider,
    @Optional()
    private readonly picgoProvider?: PicgoProvider,
    private readonly structuredDataService?: StructuredDataService,
  ) {}
  publicView = {
    _id: 0,
  };
  adminView = undefined;
  getView(view: 'admin' | 'public') {
    if (view == 'admin') {
      return this.adminView;
    }
    return this.publicView;
  }

  private decorateStaticItem(item: any) {
    const payload = { ...(item?._doc || item) };
    delete payload._id;

    if (payload?.storageType === 'local' && payload?.staticType && payload?.name) {
      const storagePath = StoragePath[payload.staticType] || StoragePath['img'];
      const filePath = path.join(config.staticPath, storagePath, payload.name);
      payload.exists = fs.existsSync(filePath);
    }

    return payload;
  }

  async upload(
    file: any,
    type: StaticType,
    isFavicon?: boolean,
    customPathname?: string,
    updateConfig?: UploadConfig,
  ) {
    const { buffer } = file;
    const arr = file.originalname.split('.');
    const fileType = arr[arr.length - 1];
    let buf = buffer;
    let currentSign = encryptFileMD5(buf);
    const staticConfigInDB = await this.settingProvider.getStaticSetting();
    let compressSuccess = true;
    if (type == 'img') {
      try {
        // 用加过水印的 buf 做计算，看看是不是有文件的。
        if (updateConfig && updateConfig.withWaterMark && fileType != 'gif') {
          // 双保险，只有这里开启水印并且设置中也开启了才有效。
          const waterMarkConfigInDB = staticConfigInDB;
          if (waterMarkConfigInDB && checkTrue(waterMarkConfigInDB?.enableWaterMark)) {
            const waterMarkText = updateConfig.waterMarkText || waterMarkConfigInDB.waterMarkText;
            if (waterMarkText && waterMarkText.trim() !== '') {
              buf = await addWaterMarkToIMG(buffer, waterMarkText);
              currentSign = encryptFileMD5(buf);
            }
          }
        }
      } catch (err) {
        // console.log(err);
      }

      if (checkTrue(staticConfigInDB.enableWebp) && !updateConfig?.skipCompress) {
        try {
          buf = await compressImgToWebp(buf);
          currentSign = encryptFileMD5(buf);
        } catch (err) {
          // console.log(err);
          compressSuccess = false;
        }
      }

      const hasFile = await this.getOneBySign(currentSign);

      if (hasFile) {
        return {
          src: hasFile.realPath,
          isNew: false,
        };
      }
    }

    // 对音乐文件也进行重复检测
    if (type == 'music') {
      const hasFile = await this.getOneBySign(currentSign);
      if (hasFile) {
        throw new HttpException('文件已存在，请勿重复上传', HttpStatus.CONFLICT);
      }
    }

    const pureFileName = arr.slice(0, arr.length - 1).join('.');
    let fileName = currentSign + '.' + file.originalname;
    if (type == 'customPage') {
      fileName = customPathname + '/' + file.originalname;
    }
    if (type == 'img' && checkTrue(staticConfigInDB.enableWebp) && compressSuccess && !updateConfig?.skipCompress) {
      fileName = currentSign + '.' + pureFileName + '.webp';
    }
    if (type == 'music') {
      // 对于音乐文件，保持原始文件名以支持中文
      // 确保正确的 UTF-8 编码处理
      try {
        const originalName = decodeURIComponent(escape(file.originalname));
        fileName = currentSign + '.' + originalName;
      } catch (error) {
        // 如果解码失败，使用原始文件名
        fileName = currentSign + '.' + file.originalname;
      }
    }
    const realPath = await this.saveFile(
      fileType,
      isFavicon ? `favicon.${fileType}` : fileName,
      buf,
      type,
      currentSign,
      isFavicon,
    );
    if (!realPath) {
      throw new HttpException('上传失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return {
      src: realPath,
      isNew: true,
    };
  }
  async importItems(items: Static[], clearExisting: boolean = false) {
    if (clearExisting) {
      // 可选：清空现有的静态文件记录（不删除实际文件）
      await this.staticModel.deleteMany({});
      await this.structuredDataService?.deleteAllStatics();
    }
    
    for (const each of items) {
      const oldItem = await this.getOneBySign(each.sign);
      if (!oldItem) {
        await this.createInDB(each);
      } else {
        await this.staticModel.updateOne({ _id: oldItem._id }, each);
      }
    }
    await this.structuredDataService?.refreshStaticsFromRecordStore();
  }
  async fetchImg(link: string): Promise<Buffer | null> {
    try {
      const res = await axios({
        method: 'GET',
        url: encodeURI(link),
        responseType: 'arraybuffer',
      });

      return res.data;
    } catch (err) {
      console.log(err);
      return null;
    }
  }
  async getImgInfoByLink(link: string) {
    const buffer = await this.fetchImg(link);
    if (!buffer) {
      return null;
    }
    const result = imageSize(buffer);
    const meta: ImgMeta = { ...result, size: formatBytes(buffer.byteLength) };
    const filename = link.split('/').pop();
    const fileType = filename?.split('.')?.pop() || '';
    const currentSign = encryptFileMD5(buffer);
    return {
      meta,
      staticType: 'img' as StaticType,
      storageType: 'picgo' as StorageType,
      fileType: result?.type || fileType,
      realPath: link,
      name: filename,
      sign: currentSign,
    };
  }
  async scanLinksOfArticles() {
    const linkObjs = await this.articleProvder.getAllImageLinks();
    const errorLinks = [];
    let total = 0;
    for (const linkObj of linkObjs) {
      const links = linkObj.links;
      for (const link of links) {
        total = total + 1;
        const dto = await this.getImgInfoByLink(link);
        if (!dto) {
          errorLinks.push({
            artcileId: linkObj.articleId,
            title: linkObj.title,
            link,
          });
        } else {
          const hasPicture = await this.getOneBySign(dto?.sign || '');
          console.log(link, dto);
          if (!hasPicture) {
            await this.createInDB(dto);
          }
        }
      }
    }
    return { total: total, errorLinks };
  }

  async exportAllImg() {
    const storageSetting = await this.settingProvider.getStaticSetting();
    const storageType = storageSetting?.storageType || 'local';
    if (storageType == 'local') {
      const { success, path } = await this.localProvider.exportAllImg();
      if (success && path) {
        return path;
      } else {
        throw new HttpException({ statusCode: 500, message: '打包错误！' }, 500);
      }
    } else {
      throw new NotImplementedException('其他图床暂不支持打包导出！');
    }
  }
  async saveFile(
    fileType: string,
    fileName: string,
    buffer: Buffer,
    type: StaticType,
    sign: string,
    toRootPath?: boolean,
  ) {
    const storageSetting = await this.settingProvider.getStaticSetting();
    let storageType = storageSetting?.storageType || 'local';
    if (type == 'customPage') {
      storageType = 'local';
    }
    switch (storageType) {
      case 'local':
        const { realPath, meta } = await this.localProvider.saveFile(
          fileName,
          buffer,
          type,
          toRootPath,
        );
        if (type != 'customPage') {
          await this.createInDB({
            fileType: (meta as any)?.type || fileType,
            staticType: type,
            storageType: storageType,
            sign,
            name: fileName,
            realPath,
            meta,
          });
        }
        return realPath;
      case 'picgo':
        // PicGo 可能被禁用
        if (!this.picgoProvider || typeof this.picgoProvider.saveFile !== 'function') {
          throw new NotImplementedException('PicGo 未启用或未配置');
        }
        const picgoRes = await this.picgoProvider.saveFile(fileName, buffer, type);
        await this.createInDB({
          fileType: picgoRes.meta?.type || fileType,
          staticType: type,
          storageType: storageType,
          sign,
          name: fileName,
          realPath: picgoRes.realPath,
          meta: picgoRes.meta,
        });
        return picgoRes.realPath;
    }
  }
  async createInDB(dto: Partial<Static>) {
    const newModal = new this.staticModel(dto);
    const saved = await newModal.save();
    await this.structuredDataService?.upsertStatic(saved.toObject());
    return saved;
  }
  async getOneBySign(sign: string) {
    const item = await this.structuredDataService?.getStaticBySign(sign);
    if (item || this.structuredDataService?.isInitialized()) {
      return item as any;
    }
    return await this.staticModel.findOne({ sign }).exec();
  }
  async getAll(type: StaticType, view: 'admin' | 'public') {
    const items = await this.structuredDataService?.listStatics(type);
    if (items?.length || this.structuredDataService?.isInitialized()) {
      if (view === 'public') {
        return items.map((item: any) => {
          const payload = { ...(item?._doc || item) };
          delete payload._id;
          return payload;
        }) as any;
      }
      return items as any;
    }
    return await this.staticModel.find({ staticType: type }, this.getView(view)).exec();
  }
  async exportAll() {
    const items = await this.structuredDataService?.exportStatics();
    if (items?.length || this.structuredDataService?.isInitialized()) {
      return items.map((item: any) => {
        const payload = { ...(item?._doc || item) };
        delete payload._id;
        return payload;
      }) as any;
    }
    return await this.staticModel.find({}, this.getView('public')).exec();
  }
  async getByOption(option: SearchStaticOption) {
    const pgResult = await this.structuredDataService?.queryStatics(option);
    if (pgResult && (pgResult.items.length || pgResult.total || this.structuredDataService?.isInitialized())) {
      const data = pgResult.items.map((item: any) => this.decorateStaticItem(item));
      return {
        total: pgResult.total,
        data,
      };
    }
    const query: any = {};
    if (option.staticType) {
      query.staticType = option.staticType;
    }
    const total = await this.staticModel.countDocuments(query);
    const items = await this.staticModel
      .find(query, this.getView(option.view))
      .sort({ updatedAt: -1 })
      .limit(option.pageSize)
      .skip(option.page * option.pageSize - option.pageSize);
    return {
      total,
      data: items.map((item) => this.decorateStaticItem(item)),
    };
  }
  async deleteCustomPage(path: string) {
    const folderName = path.replace('/', '');
    // 直接删除文件夹
    await this.localProvider.deleteCustomPageFolder(folderName);
  }

  async getFolderFiles(path: string) {
    return this.localProvider.getFolderFiles(path);
  }
  async getFileContent(path: string, subPath: string) {
    return this.localProvider.getFileContent(path, subPath);
  }
  async createFile(path: string, subPath: string) {
    return this.localProvider.createFile(path, subPath);
  }
  async createFolder(path: string, subPath: string) {
    return this.localProvider.createFolder(path, subPath);
  }
  async updateCustomPageFileContent(pathname: string, filePath: string, content: string) {
    return this.localProvider.updateCustomPageFileContent(pathname, filePath, content);
  }

  async deleteOneBySign(sign: string) {
    // 先删除实际上的。
    const toDeleteData = await this.staticModel.findOne({ sign }).exec();
    const storageType = toDeleteData.storageType;
    switch (storageType) {
      case 'local':
        await this.localProvider.deleteFile(toDeleteData.name, toDeleteData.staticType);
        break;
      case 'picgo':
        console.log('实际上只删了数据库，网盘上还有的。');
    }
    const result = await this.staticModel.deleteOne({ sign });
    await this.structuredDataService?.deleteStaticBySign(sign);
    return result;
  }
  async deleteAllIMG() {
    // 获取站点信息，确定哪些图片需要保留
    const siteInfo = await this.metaProvider.getSiteInfo();
    const all = await this.getAll('img', 'admin');
    
    let deletedCount = 0;
    let skippedCount = 0;
    
    for (const each of all) {
      let shouldSkip = false;
      
      // 检查是否是网站图标（favicon）
      if (each.name && each.name.startsWith('favicon.')) {
        shouldSkip = true;
      }
      
      // 检查是否是用户头像（authorLogo）
      if (siteInfo?.authorLogo && each.realPath) {
        // 从 authorLogo URL 中提取文件名进行比较
        const authorLogoFileName = siteInfo.authorLogo.split('/').pop();
        const currentFileName = each.realPath.split('/').pop();
        if (authorLogoFileName === currentFileName) {
          shouldSkip = true;
        }
      }
      
      // 检查是否是站点 Logo
      if (siteInfo?.siteLogo && each.realPath) {
        const siteLogoFileName = siteInfo.siteLogo.split('/').pop();
        const currentFileName = each.realPath.split('/').pop();
        if (siteLogoFileName === currentFileName) {
          shouldSkip = true;
        }
      }
      
      if (shouldSkip) {
        skippedCount++;
        console.log(`跳过删除必要图片: ${each.name || each.realPath}`);
      } else {
        await this.deleteOneBySign(each.sign);
        deletedCount++;
      }
    }
    
    return {
      deletedCount,
      skippedCount,
      message: `成功删除 ${deletedCount} 张图片，跳过 ${skippedCount} 张必要图片（网站图标、用户头像、站点Logo）`
    };
  }
}
