import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { StaticProvider } from 'src/provider/static/static.provider';
import { config } from 'src/config';
import { ApiToken } from 'src/provider/swagger/token';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { splitSafeUploadFileName } from 'src/utils/uploadFileName';

const ALLOWED_FONT_EXTENSIONS = ['.woff2', '.woff', '.ttf', '.otf'];

// 通过魔数校验字体文件真实类型，避免仅凭扩展名被绕过。
export function isValidFontBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) {
    return false;
  }
  const ascii = buffer.slice(0, 4).toString('latin1');
  if (ascii === 'wOF2' || ascii === 'wOFF' || ascii === 'OTTO' || ascii === 'true' || ascii === 'ttcf') {
    return true;
  }
  // TrueType: 0x00 0x01 0x00 0x00
  if (
    buffer[0] === 0x00 &&
    buffer[1] === 0x01 &&
    buffer[2] === 0x00 &&
    buffer[3] === 0x00
  ) {
    return true;
  }
  return false;
}

@ApiTags('font')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/font')
export class FontController {
  constructor(
    private readonly staticProvider: StaticProvider,
    private readonly isrProvider: ISRProvider,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: any) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止上传字体！',
      };
    }
    if (!file?.originalname) {
      return {
        statusCode: 400,
        message: '文件名非法',
      };
    }
    // 修正文件名编码（multer 以 latin1 解析）
    try {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (error) {
      console.warn('字体文件名编码转换失败:', error);
    }

    const { extension } = splitSafeUploadFileName(file.originalname);
    const fileExtension = extension ? `.${extension.toLowerCase()}` : '';
    if (!ALLOWED_FONT_EXTENSIONS.includes(fileExtension)) {
      return {
        statusCode: 400,
        message: '不支持的字体格式，仅支持 WOFF2、WOFF、TTF、OTF',
      };
    }

    if (!isValidFontBuffer(file.buffer)) {
      return {
        statusCode: 400,
        message: '文件内容不是有效的字体文件',
      };
    }

    const res = await this.staticProvider.upload(file, 'font');
    this.isrProvider.activeAll('上传字体触发增量渲染！');
    return {
      statusCode: 200,
      data: res,
    };
  }
}
