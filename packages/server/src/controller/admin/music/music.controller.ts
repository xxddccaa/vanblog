import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Put,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { StaticProvider } from 'src/provider/static/static.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { config } from 'src/config';
import { ApiToken } from 'src/provider/swagger/token';
import { MusicSetting } from 'src/types/setting.dto';

@ApiTags('music')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/music')
export class MusicController {
  constructor(
    private readonly staticProvider: StaticProvider,
    private readonly settingProvider: SettingProvider,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: any) {
    // 处理文件名编码问题
    if (file && file.originalname) {
      try {
        // 确保文件名是正确的 UTF-8 编码
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch (error) {
        // 如果编码转换失败，保持原文件名
        console.warn('文件名编码转换失败:', error);
      }
    }
    
    // 验证文件类型
    const allowedTypes = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
    const fileExtension = '.' + file.originalname.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      return {
        statusCode: 400,
        message: '不支持的音频格式，仅支持 MP3、WAV、OGG、M4A、FLAC 格式',
      };
    }

    const res = await this.staticProvider.upload(file, 'music');
    return {
      statusCode: 200,
      data: res,
    };
  }

  @Get('all')
  async getAll() {
    const res = await this.staticProvider.getAll('music', 'public');
    return {
      statusCode: 200,
      data: res,
    };
  }

  @Get('')
  async getByOption(@Query('page') page: number, @Query('pageSize') pageSize = 10) {
    const data = await this.staticProvider.getByOption({
      page,
      pageSize,
      staticType: 'music',
      view: 'public',
    });
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/:sign')
  async delete(@Param('sign') sign: string) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const res = await this.staticProvider.deleteOneBySign(sign);
    return {
      statusCode: 200,
      data: res,
    };
  }

  @Get('setting')
  async getMusicSetting() {
    const res = await this.settingProvider.getMusicSetting();
    return {
      statusCode: 200,
      data: res,
    };
  }

  @Put('setting')
  async updateMusicSetting(@Body() body: Partial<MusicSetting>) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const res = await this.settingProvider.updateMusicSetting(body);
    return {
      statusCode: 200,
      data: res,
    };
  }

  @Post('playlist/update')
  async updatePlaylist(@Body() body: { playlist: string[]; currentIndex?: number }) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    const currentSetting = await this.settingProvider.getMusicSetting();
    const updatedSetting = {
      ...currentSetting,
      currentPlaylist: body.playlist,
      currentIndex: body.currentIndex || 0,
    };
    
    const res = await this.settingProvider.updateMusicSetting(updatedSetting);
    return {
      statusCode: 200,
      data: res,
    };
  }
} 