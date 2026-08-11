import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MetaProvider } from './provider/meta/meta.provider';

import { NestExpressApplication } from '@nestjs/platform-express';
import { config as globalConfig } from './config/index';
import { checkOrCreate } from './utils/checkFolder';
import * as path from 'path';
import { ISRProvider } from './provider/isr/isr.provider';
import { WalineProvider } from './provider/waline/waline.provider';
import { InitProvider } from './provider/init/init.provider';
import { json } from 'express';
import { UserProvider } from './provider/user/user.provider';
import { SettingProvider } from './provider/setting/setting.provider';
import { WebsiteProvider } from './provider/website/website.provider';
import { CaddyProvider } from './provider/caddy/caddy.provider';
import { initJwt } from './utils/initJwt';
import { SearchIndexProvider } from './provider/search-index/search-index.provider';
import { setStaticCacheHeaders } from './utils/staticCacheHeaders';
import fs from 'fs';

const STDIO_TEE_FLAG = Symbol.for('vanblog.stdio-tee-enabled');

// 生产日志级别：把 config.logLevel 映射成 NestJS logger 级别数组。
// balanced(默认) 保留 error/warn/log 业务日志，砍掉 debug/verbose；silent 仅 error；verbose 全开。
function resolveNestLogLevels(level: string) {
  switch ((level || 'balanced').toLowerCase()) {
    case 'silent':
      return ['error'] as const;
    case 'verbose':
      return ['error', 'warn', 'log', 'debug', 'verbose'] as const;
    case 'balanced':
    default:
      return ['error', 'warn', 'log'] as const;
  }
}

function enableStdioLogMirror(logPath: string) {
  const runtime = globalThis as typeof globalThis & {
    [STDIO_TEE_FLAG]?: boolean;
  };

  if (runtime[STDIO_TEE_FLAG]) {
    return;
  }

  // stdio 镜像文件是后台「系统日志」页的数据源，但历史上只增不减（曾涨到 6MB+）。
  // 加一个简单的大小上限：超过 STDIO_LOG_MAX_BYTES 就滚动一份 .1（只留一份旧的），
  // 磁盘占用被限制在约 2×上限。滚动逻辑绝不能让服务崩，全部 try/catch 兜底。
  const STDIO_LOG_MAX_BYTES = 10 * 1024 * 1024;

  const rotateIfOversized = () => {
    try {
      if (!fs.existsSync(logPath)) return;
      if (fs.statSync(logPath).size <= STDIO_LOG_MAX_BYTES) return;
      const rolled = `${logPath}.1`;
      try {
        if (fs.existsSync(rolled)) fs.rmSync(rolled);
      } catch {
        // ignore
      }
      fs.renameSync(logPath, rolled);
    } catch {
      // 滚动失败不影响主流程
    }
  };

  checkOrCreate(path.dirname(logPath));
  rotateIfOversized();
  let stream = fs.createWriteStream(logPath, { flags: 'a' });
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  const mirrorWrite =
    (write: typeof process.stdout.write) =>
    (
      chunk: Uint8Array | string,
      encoding?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ) => {
      const nextEncoding = typeof encoding === 'string' ? encoding : undefined;
      const nextCallback = typeof encoding === 'function' ? encoding : callback;
      stream.write(chunk, nextEncoding);
      return write(chunk, nextEncoding, nextCallback);
    };

  process.stdout.write = mirrorWrite(originalStdoutWrite);
  process.stderr.write = mirrorWrite(originalStderrWrite);

  // 长期运行时周期检查文件大小，超限即滚动并重开写入流。
  const rotateTimer = setInterval(() => {
    try {
      if (!fs.existsSync(logPath)) return;
      if (fs.statSync(logPath).size <= STDIO_LOG_MAX_BYTES) return;
      const previous = stream;
      rotateIfOversized();
      stream = fs.createWriteStream(logPath, { flags: 'a' });
      previous.end();
    } catch {
      // ignore
    }
  }, 5 * 60 * 1000);
  rotateTimer.unref();

  process.on('exit', () => {
    stream.end();
  });
  runtime[STDIO_TEE_FLAG] = true;
}

async function bootstrap() {
  enableStdioLogMirror(path.join(globalConfig.log, 'vanblog-stdio.log'));
  const jwtSecret = await initJwt();
  global.jwtSecret = jwtSecret;
  // Pipeline providers initialize during Nest application creation.
  checkOrCreate(globalConfig.codeRunnerPath);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: [...resolveNestLogLevels(globalConfig.logLevel)],
  });
  app.disable('x-powered-by');
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

  // JSON APIs should not accept backup-sized payloads; file imports use multipart limits.
  app.use(json({ limit: '1mb' }));

  app.useStaticAssets(globalConfig.staticPath, {
    prefix: '/static/',
    setHeaders: (res, filePath) => setStaticCacheHeaders('asset', res, filePath),
  });

  // 查看文件夹是否存在 并创建.
  checkOrCreate(globalConfig.staticPath);
  checkOrCreate(path.join(globalConfig.staticPath, 'img'));
  checkOrCreate(path.join(globalConfig.staticPath, 'tmp'));
  checkOrCreate(path.join(globalConfig.staticPath, 'export'));

  // 自定义页面
  checkOrCreate(path.join(globalConfig.staticPath, 'customPage'));

  // rss
  checkOrCreate(path.join(globalConfig.staticPath, 'rss'));
  app.useStaticAssets(path.join(globalConfig.staticPath, 'rss'), {
    prefix: '/rss/',
    setHeaders: (res, filePath) => setStaticCacheHeaders('feed', res, filePath),
  });

  // sitemap
  checkOrCreate(path.join(globalConfig.staticPath, 'sitemap'));
  app.useStaticAssets(path.join(globalConfig.staticPath, 'sitemap'), {
    prefix: '/sitemap/',
    setHeaders: (res, filePath) => setStaticCacheHeaders('sitemap', res, filePath),
  });

  const config = new DocumentBuilder()
    .setTitle('VanBlog API Reference')
    .setDescription('API Token 请在后台设置页面获取，请添加到请求头的 token 字段中进行鉴权。')
    .setVersion('1.0')
    .build();
  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document);
  }
  await app.listen(3000);

  const caddyProvider = app.get(CaddyProvider);
  const websiteProvider = app.get(WebsiteProvider);

  void caddyProvider.init();
  void websiteProvider.init();

  const initProvider = app.get(InitProvider);
  initProvider.initVersion();
  initProvider.initRestoreKey();
  if (await initProvider.checkHasInited()) {
    // 新版本自动启动图床压缩功能
    await initProvider.washStaticSetting();
    // 老版本自定义数据洗一下
    await initProvider.washCustomPage();
    // 老版本的分类数据洗一下
    await initProvider.washCategory();
    const userProvider = app.get(UserProvider);
    // 老版本没加盐的用户数据洗一下。
    userProvider.washUserWithSalt();
    const settingProvider = app.get(SettingProvider);
    // 老版本菜单数据洗一下。
    settingProvider.washDefaultMenu();
    const metaProvider = app.get(MetaProvider);
    metaProvider.updateTotalWords('首次启动');
    const walineProvider = app.get(WalineProvider);
    walineProvider.init();
    process.on('SIGINT', async () => {
      await walineProvider.stop();
      await websiteProvider.stop();
      console.log('检测到关闭信号，优雅退出！');
      process.exit();
    });
    // 触发增量渲染生成静态页面，防止升级后内容为空
    const isrProvider = app.get(ISRProvider);
    const searchIndexProvider = app.get(SearchIndexProvider);
    isrProvider.activeAll('首次启动触发全量渲染！', 1000, {
      forceActice: true,
    });
    searchIndexProvider.generateSearchIndex('首次启动生成搜索索引！', 1000);
  }
  setTimeout(() => {
    console.log('应用已启动，端口: 3000');
    console.log('API 端点地址: http://<domain>/api');
    console.log('swagger 地址: http://<domain>/swagger');
    console.log('开源地址: https://github.com/xxddccaa/vanblog');
  }, 3000);
}
bootstrap();
