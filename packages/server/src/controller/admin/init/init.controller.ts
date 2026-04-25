import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Query,
  Request,
  UploadedFile,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { InitDto } from 'src/types/init.dto';
import { InitProvider } from 'src/provider/init/init.provider';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { ApiToken } from 'src/provider/swagger/token';
import { getNetIp } from 'src/provider/log/utils';

@ApiTags('init')
@ApiToken
@Controller('/api/admin')
export class InitController {
  constructor(
    private readonly initProvider: InitProvider,
    private readonly staticProvider: StaticProvider,
    private readonly isrProvider: ISRProvider,
  ) {}

  private async ensureInitRequestIsPrivate(request: any) {
    const { ip } = await getNetIp(request);
    if (String(ip || '').trim()) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: '初始化入口仅允许在受信任网络中使用',
      });
    }
  }

  @Get('/init/check')
  async checkInitStatus() {
    const hasInit = await this.initProvider.checkHasInited();
    return {
      statusCode: 200,
      data: {
        initialized: hasInit,
      },
    };
  }

  @Post('/init')
  async initSystem(@Request() request: any, @Body() initDto: InitDto) {
    const hasInit = await this.initProvider.checkHasInited();
    if (hasInit) {
      throw new HttpException('已初始化', 500);
    }
    await this.ensureInitRequestIsPrivate(request);
    await this.initProvider.init(initDto);
    this.isrProvider.activeAll('初始化触发增量渲染！', undefined, {
      forceActice: true,
    });
    return {
      statusCode: 200,
      message: '初始化成功!',
    };
  }

  @Post('/init/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImg(
    @Request() request: any,
    @UploadedFile() file: any,
    @Query('favicon') favicon: string,
  ) {
    const hasInit = await this.initProvider.checkHasInited();
    if (hasInit) {
      throw new HttpException('已初始化', 500);
    }
    await this.ensureInitRequestIsPrivate(request);
    let isFavicon = false;
    if (favicon && favicon == 'true') {
      isFavicon = true;
    }
    const res = await this.staticProvider.upload(file, 'img', isFavicon);
    
    // 在初始化阶段，即使图片已存在，也将isNew设置为true，确保前端显示成功
    if (res) {
      res.isNew = true;
    }
    
    return {
      statusCode: 200,
      data: res,
    };
  }
}
