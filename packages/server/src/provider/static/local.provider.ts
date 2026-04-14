import { BadRequestException, Injectable } from '@nestjs/common';
import { StaticType, StoragePath } from 'src/types/setting.dto';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'src/config';
import { imageSize } from 'image-size';
import { formatBytes } from 'src/utils/size';
import { ImgMeta } from 'src/types/img';
import { isProd } from 'src/utils/isProd';
import compressing from 'compressing';
import dayjs from 'dayjs';
import { checkOrCreate, checkOrCreateByFilePath } from 'src/utils/checkFolder';
import { rmDir } from 'src/utils/deleteFolder';
import { readDirs } from 'src/utils/readFileList';
import { checkOrCreateFile } from 'src/utils/checkFile';
import { getSafeUploadFileName } from 'src/utils/uploadFileName';
@Injectable()
export class LocalProvider {
  private getCustomPageRoot() {
    return path.resolve(config.staticPath, StoragePath['customPage']);
  }

  private resolvePathInsideRoot(root: string, ...segments: Array<string | undefined>) {
    const normalizedSegments = segments
      .filter((item) => item !== undefined && item !== null && item !== '')
      .map((item) => String(item).replace(/^\/+/, ''));
    const resolved = path.resolve(root, ...normalizedSegments);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new BadRequestException('自定义页面路径非法');
    }
    return resolved;
  }

  private resolveCustomPagePath(pathname?: string) {
    const root = this.getCustomPageRoot();
    return this.resolvePathInsideRoot(root, pathname);
  }

  private resolveCustomPageChildPath(pathname?: string, subPath?: string) {
    const basePath = this.resolveCustomPagePath(pathname);
    return this.resolvePathInsideRoot(basePath, subPath);
  }

  resolveCustomPageAssetPath(pathname?: string, subPath?: string) {
    return this.resolveCustomPageChildPath(pathname, subPath);
  }

  private resolveFlatStaticFile(type: StaticType, fileName: string) {
    const storagePath = StoragePath[type] || StoragePath['img'];
    const safeFileName = getSafeUploadFileName(fileName);

    return {
      safeFileName,
      storagePath,
      srcPath: path.join(config.staticPath, storagePath, safeFileName),
    };
  }

  async saveFile(fileName: string, buffer: Buffer, type: StaticType, toRootPath?: boolean) {
    if (type == 'img') {
      return await this.saveImg(fileName, buffer, type, toRootPath);
    } else if (type == 'customPage') {
      const storagePath = StoragePath[type];
      const realName = fileName;
      const srcPath = this.resolveCustomPagePath(realName);
      // 创建文件夹。
      const byteLength = buffer.byteLength;
      const realPath = `/static/${storagePath}/${realName}`;
      checkOrCreateByFilePath(srcPath);
      fs.writeFileSync(srcPath, buffer);
      const meta = { size: formatBytes(byteLength) };
      return {
        meta,
        realPath,
      };
    } else if (type == 'music') {
      const { safeFileName, srcPath } = this.resolveFlatStaticFile(type, fileName);
      let realPath = `/static/${type}/${safeFileName}`;

      if (isProd()) {
        if (toRootPath) {
          realPath = `/${safeFileName}`;
        }
      }

      // 确保音乐目录存在
      checkOrCreateByFilePath(srcPath);

      const byteLength = buffer.byteLength;
      fs.writeFileSync(srcPath, buffer);

      const meta = { size: formatBytes(byteLength) };
      return {
        meta,
        realPath,
      };
    }
  }

  async getFolderFiles(p: string) {
    const absPath = this.resolveCustomPagePath(p);
    const res = readDirs(absPath, absPath);
    return res;
  }
  async createFile(p: string, subPath: string) {
    const absPath = this.resolveCustomPageChildPath(p, subPath);
    checkOrCreateFile(absPath);
  }
  async createFolder(p: string, subPath: string) {
    const absPath = this.resolveCustomPageChildPath(p, subPath);
    checkOrCreate(absPath);
  }
  async getFileContent(p: string, subPath: string) {
    const absPath = this.resolveCustomPageChildPath(p, subPath);

    const r = fs.readFileSync(absPath, { encoding: 'utf-8' });
    return r;
  }
  async updateCustomPageFileContent(pathname: string, filePath: string, content: string) {
    const absPath = this.resolveCustomPageChildPath(pathname, filePath);
    fs.writeFileSync(absPath, content, { encoding: 'utf-8' });
  }

  async saveImg(fileName: string, buffer: Buffer, type: StaticType, toRootPath?: boolean) {
    const { safeFileName, srcPath } = this.resolveFlatStaticFile(type, fileName);
    let realPath = `/static/${type}/${safeFileName}`;

    if (isProd()) {
      if (toRootPath) {
        realPath = `/${safeFileName}`;
      }
    }
    const result = imageSize(buffer);
    const byteLength = buffer.byteLength;

    fs.writeFileSync(srcPath, buffer);
    const meta: ImgMeta = { ...result, size: formatBytes(byteLength) };
    return {
      meta,
      realPath,
    };
  }

  async deleteCustomPageFolder(name: string) {
    const srcPath = this.resolveCustomPagePath(name);
    try {
      rmDir(srcPath);
    } catch (err) {
      console.log('删除实际文件夹失败：', name);
    }
  }

  async deleteFile(fileName: string, type: StaticType) {
    try {
      const { srcPath } = this.resolveFlatStaticFile(type, fileName);
      fs.rmSync(srcPath);
    } catch (err) {
      console.log('删除实际文件失败：', fileName, '可能是更新版本后没映射静态文件目录导致的');
    }
  }
  async exportAllImg() {
    const src = path.join(config.staticPath, 'img');
    const dst = path.join(
      config.staticPath,
      'export',
      `export-img-${dayjs().format('YYYY-MM-DD')}.zip`,
    );
    const dstSrc = `/static/export/export-img-${dayjs().format('YYYY-MM-DD')}.zip`;

    const compressPromise = new Promise((resolve, reject) => {
      compressing.zip
        .compressDir(src, dst)
        .then((v) => {
          resolve(v);
        })
        .catch((e) => {
          reject(e);
        });
    });
    try {
      const r = await Promise.all([compressPromise]);
      console.log(r);
      return {
        success: true,
        path: dstSrc,
      };
    } catch (err) {
      console.log(err);
      return {
        success: false,
        error: err,
      };
    }
  }
}
