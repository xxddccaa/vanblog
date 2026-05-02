import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const compose = fs.readFileSync('docker-compose.yml', 'utf8');
const composeImage = fs.readFileSync('docker-compose.image.yml', 'utf8');
const composeAllInOne = fs.readFileSync('docker-compose.all-in-one.yml', 'utf8');
const composeAllInOneImage = fs.readFileSync('docker-compose.all-in-one.image.yml', 'utf8');
const composeAllInOneLatest = fs.readFileSync('docker-compose.all-in-one.latest.yml', 'utf8');
const composeLatestAi = fs.readFileSync('docker-compose.latest.ai.yml', 'utf8');
const composeAiQa = fs.readFileSync('docker-compose.ai-qa.yml', 'utf8');
const composeFastgpt = fs.readFileSync('docker-compose.fastgpt.yml', 'utf8');
const manualCompose = fs.readFileSync('tests/manual-v1.3.0/docker-compose.yaml', 'utf8');
const caddyfile = fs.readFileSync('docker/caddy/Caddyfile', 'utf8');
const caddyfileHttps = fs.readFileSync('docker/caddy/Caddyfile.https', 'utf8');
const allInOneCaddyfile = fs.readFileSync('docker/all-in-one/Caddyfile', 'utf8');
const allInOneDockerfile = fs.readFileSync('docker/all-in-one.Dockerfile', 'utf8');
const allInOneEntrypoint = fs.readFileSync('docker/all-in-one/entrypoint.sh', 'utf8');
const allInOneHealthcheck = fs.readFileSync('docker/all-in-one/healthcheck.sh', 'utf8');
const serverDockerfile = fs.readFileSync('docker/server.Dockerfile', 'utf8');
const serverEntrypoint = fs.readFileSync('docker/server/entrypoint.sh', 'utf8');
const serverTerminalShell = fs.readFileSync('docker/server/terminal-shell.sh', 'utf8');
const readmeDoc = fs.readFileSync('README.md', 'utf8');
const deployDoc = fs.readFileSync('DEPLOY.md', 'utf8');
const releaseDoc = fs.readFileSync('RELEASE.md', 'utf8');
const agentsDoc = fs.readFileSync('AGENTS.md', 'utf8');
const aiQaDoc = fs.readFileSync('docs/ai-qa-fastgpt.md', 'utf8');
const docsHomeDoc = fs.readFileSync('docs/README.md', 'utf8');
const introDoc = fs.readFileSync('docs/intro.md', 'utf8');
const guideGetStartedDoc = fs.readFileSync('docs/guide/get-started.md', 'utf8');
const guideUpdateDoc = fs.readFileSync('docs/guide/update.md', 'utf8');
const faqReadmeDoc = fs.readFileSync('docs/faq/README.md', 'utf8');
const faqDeployDoc = fs.readFileSync('docs/faq/deploy.md', 'utf8');
const faqUpdateDoc = fs.readFileSync('docs/faq/update.md', 'utf8');
const referenceEnvDoc = fs.readFileSync('docs/reference/env.md', 'utf8');
const referenceDirDoc = fs.readFileSync('docs/reference/dir.md', 'utf8');
const referenceLogDoc = fs.readFileSync('docs/reference/log.md', 'utf8');
const releasesIndexDoc = fs.readFileSync('docs/releases/README.md', 'utf8');
const release158Doc = fs.readFileSync('docs/releases/v1.5.8.md', 'utf8');
const release157Doc = fs.readFileSync('docs/releases/v1.5.7.md', 'utf8');
const release156Doc = fs.readFileSync('docs/releases/v1.5.6.md', 'utf8');
const release155Doc = fs.readFileSync('docs/releases/v1.5.5.md', 'utf8');
const release154Doc = fs.readFileSync('docs/releases/v1.5.4.md', 'utf8');
const release152Doc = fs.readFileSync('docs/releases/v1.5.2.md', 'utf8');
const release151Doc = fs.readFileSync('docs/releases/v1.5.1.md', 'utf8');
const release150Doc = fs.readFileSync('docs/releases/v1.5.0.md', 'utf8');
const release143Doc = fs.readFileSync('docs/releases/v1.4.3.md', 'utf8');
const release142Doc = fs.readFileSync('docs/releases/v1.4.2.md', 'utf8');
const release141Doc = fs.readFileSync('docs/releases/v1.4.1.md', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const releaseEnv = fs.readFileSync('.env.release.example', 'utf8');
const fastgptConfigExample = fs.readFileSync('docker/fastgpt/config.json.example', 'utf8');
const fastgptBootstrapScript = fs.readFileSync(
  'docker/fastgpt/bootstrap-team-free-plan.js',
  'utf8',
);
const cloudflareDoc = fs.readFileSync('docs/cloudflare-cache.md', 'utf8');
const cloudflareRules = JSON.parse(
  fs.readFileSync('docs/cloudflare-cache-rules.example.json', 'utf8'),
);
const cloudflareWorker = fs.readFileSync('docs/cloudflare-worker-cache-normalize.js', 'utf8');
const publicCacheMiddleware = fs.readFileSync(
  'packages/server/src/provider/public-cache/public-cache.middleware.ts',
  'utf8',
);
const websiteProviders = fs.readFileSync('packages/website/app/providers.tsx', 'utf8');
const websitePageviewApi = fs.readFileSync('packages/website/api/pageview.ts', 'utf8');
const require = createRequire(import.meta.url);
const nextConfig = require('../packages/website/next.config.js');

const createCloudflareWorker = () => {
  const factory = new Function(cloudflareWorker.replace(/^export default\s+/, 'return '));
  return factory();
};

const getWorkerRouteGroupSet = (workerSource) => {
  const routeGroups = new Set();

  if (workerSource.includes('url.pathname === "/"')) {
    routeGroups.add('home');
  }
  if (workerSource.includes('url.pathname.startsWith("/post/")')) {
    routeGroups.add('post');
  }
  if (
    workerSource.includes('url.pathname === "/archive"') ||
    workerSource.includes('url.pathname.startsWith("/archive/")')
  ) {
    routeGroups.add('archive');
  }
  if (workerSource.includes('url.pathname.startsWith("/category")')) {
    routeGroups.add('category');
  }
  if (workerSource.includes('url.pathname.startsWith("/tag")')) {
    routeGroups.add('tag');
  }
  if (workerSource.includes('url.pathname === "/timeline"')) {
    routeGroups.add('timeline');
  }
  if (workerSource.includes('url.pathname === "/about"')) {
    routeGroups.add('about');
  }
  if (workerSource.includes('url.pathname === "/link"')) {
    routeGroups.add('link');
  }
  if (workerSource.includes('url.pathname.startsWith("/c/")')) {
    routeGroups.add('custom-page');
  }
  if (
    workerSource.includes('url.pathname === "/moment"') ||
    workerSource.includes('url.pathname.startsWith("/moment/")')
  ) {
    routeGroups.add('moment');
  }
  if (
    workerSource.includes('url.pathname === "/nav"') ||
    workerSource.includes('url.pathname.startsWith("/nav/")')
  ) {
    routeGroups.add('nav');
  }

  return routeGroups;
};

const getRouteGroupSet = (paths) => {
  const routeGroups = new Set();
  for (const path of paths) {
    if (path === '/') {
      routeGroups.add('home');
    }
    if (path.includes('/post/')) {
      routeGroups.add('post');
    }
    if (path.includes('/archive')) {
      routeGroups.add('archive');
    }
    if (path.includes('/category')) {
      routeGroups.add('category');
    }
    if (path.includes('/tag')) {
      routeGroups.add('tag');
    }
    if (path.includes('/timeline')) {
      routeGroups.add('timeline');
    }
    if (path.includes('about')) {
      routeGroups.add('about');
    }
    if (path.includes('link')) {
      routeGroups.add('link');
    }
    if (path.includes('/c/')) {
      routeGroups.add('custom-page');
    }
    if (path.includes('moment')) {
      routeGroups.add('moment');
    }
    if (path.includes('nav')) {
      routeGroups.add('nav');
    }
  }
  return routeGroups;
};

const getHeaderValue = (rule, key) => rule?.headers?.find((header) => header.key === key)?.value;

test('docker compose defines the split runtime services', () => {
  for (const service of [
    'caddy:',
    'server:',
    'website:',
    'admin:',
    'waline:',
    'postgres:',
    'redis:',
  ]) {
    assert.match(compose, new RegExp(`^\\s{2}${service}`, 'm'));
  }

  assert.match(compose, /docker\/caddy\.Dockerfile/);
  assert.match(compose, /docker\/server\.Dockerfile/);
  assert.match(compose, /docker\/website\.Dockerfile/);
  assert.match(compose, /docker\/admin\.Dockerfile/);
});

test('all-in-one compose defines a single non-AI service', () => {
  for (const file of [composeAllInOne, composeAllInOneImage, composeAllInOneLatest]) {
    assert.match(file, /^services:\s*\n\s{2}vanblog:/m);
    assert.doesNotMatch(file, /^\s{2}caddy:/m);
    assert.doesNotMatch(file, /^\s{2}fastgpt-app:/m);
    assert.match(file, /POSTGRES_DB:/);
    assert.match(file, /VANBLOG_REDIS_DIR/);
    assert.match(file, /WALINE_JWT_TOKEN:/);
  }

  assert.match(composeAllInOne, /docker\/all-in-one\.Dockerfile/);
  assert.match(composeAllInOneImage, /vanblog-all-in-one-\$\{VANBLOG_RELEASE_SUFFIX:-latest\}/);
  assert.match(composeAllInOneLatest, /vanblog-all-in-one-latest/);
});

test('all-in-one runtime keeps AI disabled and uses localhost fan-out', () => {
  assert.match(allInOneDockerfile, /VANBLOG_IMAGE_NAME=\"vanblog-all-in-one\"/);
  assert.match(allInOneDockerfile, /COPY docker\/all-in-one\/Caddyfile \/etc\/caddy\/Caddyfile/);
  assert.match(allInOneDockerfile, /COPY docker\/all-in-one\/entrypoint\.sh/);
  assert.match(allInOneDockerfile, /COPY docker\/all-in-one\/healthcheck\.sh/);

  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3000/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3001/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3002/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:8360/);
  assert.doesNotMatch(allInOneCaddyfile, /ai-terminal/);

  assert.match(allInOneEntrypoint, /VANBLOG_AI_TERMINAL_ENABLED=\"false\"/);
  assert.match(allInOneEntrypoint, /127\.0\.0\.1:2019/);
  assert.match(allInOneEntrypoint, /ensure_postgres_database/);
  assert.match(allInOneEntrypoint, /redis-server/);
  assert.match(allInOneEntrypoint, /postgres -D/);

  assert.match(allInOneHealthcheck, /pg_isready -h 127\.0\.0\.1/);
  assert.match(allInOneHealthcheck, /redis-cli -h 127\.0\.0\.1/);
  assert.match(allInOneHealthcheck, /http:\/\/127\.0\.0\.1:3002\/admin\//);
});

test('docker compose wires cross-container control endpoints', () => {
  assert.match(compose, /VANBLOG_CADDY_API_URL:\s+http:\/\/caddy:2019/);
  assert.match(compose, /VANBLOG_WEBSITE_CONTROL_URL:\s+http:\/\/website:3011/);
  assert.match(compose, /VANBLOG_WALINE_CONTROL_URL:\s+http:\/\/waline:8361/);
  assert.match(compose, /VAN_BLOG_DATABASE_URL:\s+\$\{VAN_BLOG_DATABASE_URL:-postgresql:\/\//);
  assert.match(compose, /VAN_BLOG_REDIS_URL:\s+\$\{VAN_BLOG_REDIS_URL:-redis:\/\/redis:6379\}/);
  assert.match(
    compose,
    /VAN_BLOG_WALINE_DATABASE_URL:\s+\$\{VAN_BLOG_WALINE_DATABASE_URL:-postgresql:\/\//,
  );
  assert.match(
    compose,
    /VANBLOG_WEBSITE_ISR_BASE:\s+http:\/\/website:3001\/api\/revalidate\?path=/,
  );
  assert.match(compose, /VAN_BLOG_CLOUDFLARE_API_TOKEN:\s+\$\{VAN_BLOG_CLOUDFLARE_API_TOKEN:-\}/);
  assert.match(compose, /VAN_BLOG_CLOUDFLARE_ZONE_ID:\s+\$\{VAN_BLOG_CLOUDFLARE_ZONE_ID:-\}/);
  assert.match(composeImage, /VANBLOG_CADDY_API_URL:\s+http:\/\/caddy:2019/);
  assert.match(composeImage, /VANBLOG_WEBSITE_CONTROL_URL:\s+http:\/\/website:3011/);
  assert.match(composeImage, /VANBLOG_WALINE_CONTROL_URL:\s+http:\/\/waline:8361/);
  assert.match(
    composeImage,
    /VAN_BLOG_WALINE_DATABASE_URL:\s+\$\{VAN_BLOG_WALINE_DATABASE_URL:-postgresql:\/\//,
  );
  assert.match(
    composeImage,
    /VAN_BLOG_CLOUDFLARE_API_TOKEN:\s+\$\{VAN_BLOG_CLOUDFLARE_API_TOKEN:-\}/,
  );
  assert.match(composeImage, /VAN_BLOG_CLOUDFLARE_ZONE_ID:\s+\$\{VAN_BLOG_CLOUDFLARE_ZONE_ID:-\}/);
  assert.match(compose, /WALINE_JWT_TOKEN:\s+\$\{WALINE_JWT_TOKEN:-\}/);
  assert.match(compose, /JWT_TOKEN:\s+\$\{WALINE_JWT_TOKEN:-\}/);
  assert.match(composeImage, /WALINE_JWT_TOKEN:\s+\$\{WALINE_JWT_TOKEN:-\}/);
  assert.match(composeImage, /JWT_TOKEN:\s+\$\{WALINE_JWT_TOKEN:-\}/);
  assert.match(
    manualCompose,
    /WALINE_JWT_TOKEN:\s+\$\{WALINE_JWT_TOKEN:\?WALINE_JWT_TOKEN is required\}/,
  );
  assert.match(manualCompose, /JWT_TOKEN:\s+\$\{WALINE_JWT_TOKEN:\?WALINE_JWT_TOKEN is required\}/);
  assert.match(compose, /website:[\s\S]*volumes:[\s\S]*VANBLOG_LOG_DIR/);
  assert.match(compose, /waline:[\s\S]*volumes:[\s\S]*VANBLOG_LOG_DIR/);
  assert.match(composeImage, /website:[\s\S]*volumes:[\s\S]*VANBLOG_LOG_DIR/);
  assert.match(composeImage, /waline:[\s\S]*volumes:[\s\S]*VANBLOG_LOG_DIR/);
});

test('docs reflect the v1.5.8 release baseline and optional deployment model', () => {
  assert.equal(packageJson.version, '1.5.8');

  assert.match(readmeDoc, /v1\.5\.8/);
  assert.match(readmeDoc, /kevinchina\/deeplearning/);
  assert.match(readmeDoc, /docker-compose\.ai-qa\.yml/);
  assert.match(readmeDoc, /docker-compose\.fastgpt\.yml/);
  assert.match(readmeDoc, /docker-compose\.yaml/);
  assert.match(readmeDoc, /docker-compose\.all-in-one\.latest\.yml/);
  assert.match(readmeDoc, /docker-compose\.all-in-one\.image\.yml/);
  assert.match(readmeDoc, /vanblog-all-in-one/);
  assert.match(readmeDoc, /\/admin\/ai/);
  assert.match(readmeDoc, /OpenCode 终端/);
  assert.match(readmeDoc, /docs\/ai-qa-fastgpt\.md/);

  assert.match(agentsDoc, /docker-compose\.ai-qa\.yml/);
  assert.match(agentsDoc, /docker-compose\.fastgpt\.yml/);
  assert.match(agentsDoc, /docker-compose\.all-in-one\.image\.yml/);
  assert.match(agentsDoc, /docs\/ai-qa-fastgpt\.md/);
  assert.match(agentsDoc, /\/admin\/ai/);
  assert.match(agentsDoc, /kevinchina\/deeplearning/);

  assert.match(aiQaDoc, /\/admin\/ai/);
  assert.doesNotMatch(aiQaDoc, /\/admin\/site\/ai-qa/);
  assert.match(aiQaDoc, /所有管理员/);
  assert.match(aiQaDoc, /共享/);
  assert.match(aiQaDoc, /OpenCode 终端/);
  assert.match(aiQaDoc, /Dataset ID/);
  assert.match(aiQaDoc, /App ID/);
  assert.match(aiQaDoc, /Query Extension/);
  assert.match(aiQaDoc, /data\/ai-terminal\/home/);
  assert.match(aiQaDoc, /opencode/);
  assert.match(aiQaDoc, /kevinchina\/deeplearning:fastgpt-v4\.14\.10\.2/);
  assert.match(aiQaDoc, /kevinchina\/deeplearning:fastgpt-plugin-v0\.5\.6/);
  assert.match(aiQaDoc, /kevinchina\/deeplearning:aiproxy-v0\.3\.5/);
  assert.match(aiQaDoc, /kevinchina\/deeplearning:fastgpt-code-sandbox-v4\.14\.10/);
  assert.match(aiQaDoc, /mongo:5\.0\.32/);

  assert.match(releasesIndexDoc, /v1\.5\.8/);
  assert.match(release158Doc, /v1\.5\.8/);
  assert.match(release158Doc, /Typora|引用块|行距|字距/);
  assert.match(release158Doc, /graphite|炭黑石墨|phycat-sky|Phycat Sky/);
  assert.match(release158Doc, /docker-compose\.image\.yml/);
  assert.match(releasesIndexDoc, /v1\.5\.7/);
  assert.match(release157Doc, /v1\.5\.7/);
  assert.match(release157Doc, /预览|编辑页|ByteMD/);
  assert.match(release157Doc, /1200|窄屏|堆叠/);
  assert.match(release157Doc, /docker-compose\.image\.yml/);
  assert.match(releasesIndexDoc, /v1\.5\.6/);
  assert.match(release156Doc, /v1\.5\.6/);
  assert.match(release156Doc, /草稿|发布/);
  assert.match(release156Doc, /more|statusCode/);
  assert.match(release156Doc, /docker-compose\.image\.yml/);
  assert.match(releasesIndexDoc, /v1\.5\.5/);
  assert.match(release155Doc, /v1\.5\.5/);
  assert.match(release155Doc, /滚动|同步滚动/);
  assert.match(release155Doc, /ByteMD|DocumentViewer/);
  assert.match(release155Doc, /docker-compose\.image\.yml/);
  assert.match(release154Doc, /v1\.5\.4/);
  assert.match(release154Doc, /Markdown/);
  assert.match(release154Doc, /首屏|FOUC|样式闪烁/);
  assert.match(release154Doc, /docker-compose\.image\.yml/);
  assert.match(releasesIndexDoc, /v1\.5\.2/);
  assert.match(release152Doc, /v1\.5\.2/);
  assert.match(release152Doc, /CodeMirror/);
  assert.match(release152Doc, /背景|background/i);
  assert.match(release152Doc, /docker-compose\.image\.yml/);
  assert.match(release151Doc, /v1\.5\.1/);
  assert.match(release151Doc, /ByteMD/i);
  assert.match(release151Doc, /vanblog_editor_engine/);
  assert.match(release151Doc, /docker-compose\.image\.yml/);
  assert.match(release150Doc, /v1\.5\.0/);
  assert.match(release150Doc, /init\/check/);
  assert.match(release150Doc, /emoji/);
  assert.match(release150Doc, /ISR/);
  assert.match(release150Doc, /docker-compose\.image\.yml/);
  assert.match(release143Doc, /v1\.4\.3/);
  assert.match(release143Doc, /登录已过期/);
  assert.match(release143Doc, /redirect/);
  assert.match(release143Doc, /docker-compose\.image\.yml/);
  assert.match(release142Doc, /v1\.4\.2/);
  assert.match(release142Doc, /OpenCode 终端/);
  assert.match(release142Doc, /docker-compose\.ai-qa\.yml/);
  assert.match(release142Doc, /data\/ai-terminal\/home/);
  assert.match(release142Doc, /pnpm release:publish/);
  assert.match(release141Doc, /v1\.4\.1/);
  assert.match(release141Doc, /\/admin\/ai/);
  assert.match(release141Doc, /docker-compose\.ai-qa\.yml/);
  assert.match(release141Doc, /docker-compose\.fastgpt\.yml/);
  assert.match(release141Doc, /kevinchina\/deeplearning/);
  assert.match(release141Doc, /blogInstanceId/);
  assert.match(release141Doc, /managedV2/);
  assert.match(releaseDoc, /docker-compose\.yaml/);
  assert.match(releaseDoc, /docker-compose\.latest\.ai\.yml/);
  assert.match(releaseDoc, /docker-compose\.all-in-one\.latest\.yml/);
  assert.match(releaseDoc, /docker-compose\.all-in-one\.image\.yml/);
  assert.match(releaseDoc, /release:all-in-one/);
  assert.match(releaseDoc, /kevinchina\/deeplearning:fastgpt-v4\.14\.10\.2/);
  assert.match(releaseDoc, /kevinchina\/deeplearning:fastgpt-plugin-v0\.5\.6/);
  assert.match(releaseDoc, /kevinchina\/deeplearning:aiproxy-v0\.3\.5/);
  assert.match(releaseDoc, /kevinchina\/deeplearning:fastgpt-code-sandbox-v4\.14\.10/);
});

test('guide, faq, intro, and reference docs keep the optional AI deployment story aligned', () => {
  assert.match(docsHomeDoc, /\/ai-qa-fastgpt\.html/);
  assert.match(docsHomeDoc, /waline、postgres、redis 七个服务/);
  assert.match(docsHomeDoc, /\/admin\/ai/);

  assert.match(introDoc, /\/admin\/ai/);
  assert.match(introDoc, /只有显式叠加 AI 相关 compose 文件才会接入 FastGPT/);

  assert.match(guideGetStartedDoc, /docker-compose\.latest\.ai\.yml/);
  assert.match(guideGetStartedDoc, /docker-compose\.image\.yml/);
  assert.match(guideGetStartedDoc, /docker-compose\.all-in-one\.latest\.yml/);
  assert.match(guideGetStartedDoc, /docker-compose\.ai-qa\.yml/);
  assert.match(guideGetStartedDoc, /docker-compose\.fastgpt\.yml/);
  assert.match(guideGetStartedDoc, /\/admin\/ai/);

  assert.match(guideUpdateDoc, /docker-compose\.latest\.ai\.yml/);
  assert.match(guideUpdateDoc, /docker-compose\.all-in-one\.latest\.yml/);
  assert.match(guideUpdateDoc, /docker-compose\.ai-qa\.yml/);
  assert.match(guideUpdateDoc, /docker-compose\.fastgpt\.yml/);
  assert.match(guideUpdateDoc, /不主动修改 `docker-compose\.fastgpt\.yml` 的固定版本矩阵/);

  assert.match(faqReadmeDoc, /ai-qa-fastgpt\.md/);
  assert.match(faqDeployDoc, /docker-compose\.latest\.ai\.yml/);
  assert.match(faqDeployDoc, /docker-compose\.ai-qa\.yml/);
  assert.match(faqDeployDoc, /docker-compose\.fastgpt\.yml/);
  assert.match(faqDeployDoc, /默认不要/);
  assert.match(faqUpdateDoc, /docker-compose\.latest\.ai\.yml/);
  assert.match(faqUpdateDoc, /移除 `docker-compose\.ai-qa\.yml` \/ `docker-compose\.fastgpt\.yml`/);

  assert.match(referenceEnvDoc, /VAN_BLOG_FASTGPT_INTERNAL_URL/);
  assert.match(referenceEnvDoc, /FASTGPT_ROOT_PASSWORD/);
  assert.match(referenceEnvDoc, /VANBLOG_AI_TERMINAL_ENABLED/);
  assert.match(referenceEnvDoc, /FASTGPT_FREE_PLAN_POINTS/);
  assert.match(referenceEnvDoc, /FASTGPT_FREE_PLAN_DURATION_DAYS/);
  assert.match(referenceEnvDoc, /docker-compose\.latest\.ai\.yml/);
  assert.match(referenceDirDoc, /docker-compose\.fastgpt\.yml/);
  assert.match(referenceDirDoc, /\.\/data\/fastgpt\/mongo/);
  assert.match(referenceDirDoc, /\.\/data\/ai-terminal\/home/);
  assert.match(referenceLogDoc, /docker-compose\.ai-qa\.yml/);
  assert.match(referenceLogDoc, /fastgpt-app/);
  assert.match(referenceLogDoc, /fastgpt-bootstrap/);
  assert.match(referenceLogDoc, /Wetty/);
});

test('fastgpt extension stays optional and private to the compose network', () => {
  assert.match(
    composeAiQa,
    /server:[\s\S]*VAN_BLOG_FASTGPT_INTERNAL_URL:\s+\$\{VAN_BLOG_FASTGPT_INTERNAL_URL:-http:\/\/fastgpt-app:3000\}/,
  );
  assert.match(
    composeAiQa,
    /server:[\s\S]*VAN_BLOG_FASTGPT_ROOT_PASSWORD:\s+\$\{FASTGPT_ROOT_PASSWORD:-\}/,
  );
  assert.match(composeAiQa, /server:[\s\S]*VANBLOG_AI_TERMINAL_ENABLED:\s+'true'/);
  assert.match(composeAiQa, /server:[\s\S]*expose:[\s\S]*'7681'/);
  assert.match(composeAiQa, /server:[\s\S]*\.:\/workspace\/vanblog/);
  assert.match(composeAiQa, /server:[\s\S]*\.\/data\/ai-terminal\/home:\/app\/ai-terminal-home/);
  for (const service of [
    'fastgpt-app:',
    'fastgpt-bootstrap:',
    'fastgpt-mongo:',
    'fastgpt-vector:',
    'fastgpt-redis:',
    'fastgpt-minio:',
    'fastgpt-plugin:',
    'fastgpt-aiproxy:',
  ]) {
    assert.match(composeFastgpt, new RegExp(`^\\s{2}${service}`, 'm'));
  }

  assert.match(composeFastgpt, /127\.0\.0\.1:\$\{FASTGPT_HTTP_PORT:-3100\}:3000/);
  assert.match(composeFastgpt, /127\.0\.0\.1:\$\{FASTGPT_MINIO_API_PORT:-9100\}:9000/);
  assert.match(composeFastgpt, /127\.0\.0\.1:\$\{FASTGPT_MINIO_CONSOLE_PORT:-9101\}:9001/);
  assert.match(composeFastgpt, /http:\/\/fastgpt-app:3000/);
  assert.match(composeFastgpt, /kevinchina\/deeplearning:fastgpt-v4\.14\.10\.2/);
  assert.match(composeFastgpt, /kevinchina\/deeplearning:fastgpt-plugin-v0\.5\.6/);
  assert.match(composeFastgpt, /kevinchina\/deeplearning:aiproxy-v0\.3\.5/);
  assert.match(composeFastgpt, /kevinchina\/deeplearning:fastgpt-code-sandbox-v4\.14\.10/);
  assert.match(composeFastgpt, /bootstrap-team-free-plan\.js/);
  assert.match(fastgptBootstrapScript, /team_subscriptions/);
  assert.doesNotMatch(compose, /VAN_BLOG_FASTGPT_INTERNAL_URL/);
  assert.doesNotMatch(composeImage, /VAN_BLOG_FASTGPT_INTERNAL_URL/);
  assert.doesNotMatch(caddyfile, /fastgpt/i);
  assert.doesNotMatch(caddyfileHttps, /fastgpt/i);
});

test('single-file latest ai compose bundles the latest stack with private fastgpt services', () => {
  for (const service of [
    'caddy:',
    'server:',
    'website:',
    'admin:',
    'waline:',
    'postgres:',
    'redis:',
    'fastgpt-app:',
    'fastgpt-bootstrap:',
    'fastgpt-mongo:',
    'fastgpt-vector:',
    'fastgpt-redis:',
    'fastgpt-minio:',
  ]) {
    assert.match(composeLatestAi, new RegExp(`^\\s{2}${service}`, 'm'));
  }

  assert.match(composeLatestAi, /kevinchina\/deeplearning:vanblog-caddy-latest/);
  assert.match(composeLatestAi, /kevinchina\/deeplearning:vanblog-server-latest/);
  assert.match(
    composeLatestAi,
    /VAN_BLOG_FASTGPT_INTERNAL_URL:\s+\$\{VAN_BLOG_FASTGPT_INTERNAL_URL:-http:\/\/fastgpt-app:3000\}/,
  );
  assert.match(
    composeLatestAi,
    /VAN_BLOG_FASTGPT_ROOT_PASSWORD:\s+\$\{FASTGPT_ROOT_PASSWORD:-change-me-now\}/,
  );
  assert.match(composeLatestAi, /VANBLOG_AI_TERMINAL_ENABLED:\s+'true'/);
  assert.match(composeLatestAi, /\.:\/workspace\/vanblog/);
  assert.match(composeLatestAi, /\.\/data\/ai-terminal\/home:\/app\/ai-terminal-home/);
  assert.match(composeLatestAi, /expose:[\s\S]*'7681'/);
  assert.match(composeLatestAi, /127\.0\.0\.1:\$\{FASTGPT_HTTP_PORT:-3100\}:3000/);
  assert.match(composeLatestAi, /kevinchina\/deeplearning:fastgpt-v4\.14\.10\.2/);
  assert.match(composeLatestAi, /kevinchina\/deeplearning:fastgpt-plugin-v0\.5\.6/);
  assert.match(composeLatestAi, /kevinchina\/deeplearning:aiproxy-v0\.3\.5/);
  assert.match(composeLatestAi, /kevinchina\/deeplearning:fastgpt-code-sandbox-v4\.14\.10/);
  assert.match(composeLatestAi, /docker\/fastgpt\/config\.json/);
});

test('waline service is configured to use standalone postgres credentials', () => {
  assert.match(compose, /PG_DB:\s+\$\{VAN_BLOG_WALINE_DB:-waline\}/);
  assert.match(compose, /PG_USER:\s+\$\{POSTGRES_USER:-postgres\}/);
  assert.match(compose, /PG_PASSWORD:\s+\$\{POSTGRES_PASSWORD:-postgres\}/);
  assert.match(composeImage, /PG_DB:\s+\$\{VAN_BLOG_WALINE_DB:-waline\}/);
  assert.match(composeImage, /PG_USER:\s+\$\{POSTGRES_USER:-postgres\}/);
  assert.match(composeImage, /PG_PASSWORD:\s+\$\{POSTGRES_PASSWORD:-postgres\}/);
  assert.match(composeAllInOne, /VAN_BLOG_WALINE_DB:\s+\$\{VAN_BLOG_WALINE_DB:-waline\}/);
  assert.match(composeAllInOne, /POSTGRES_USER:\s+\$\{POSTGRES_USER:-postgres\}/);
  assert.match(composeAllInOne, /POSTGRES_PASSWORD:\s+\$\{POSTGRES_PASSWORD:-postgres\}/);
});

test('release env example and deploy guide document optional Cloudflare purge credentials', () => {
  assert.match(releaseEnv, /# Optional Cloudflare cache purge integration/);
  assert.match(releaseEnv, /# VAN_BLOG_CLOUDFLARE_API_TOKEN=replace-with-cloudflare-api-token/);
  assert.match(releaseEnv, /# VAN_BLOG_CLOUDFLARE_ZONE_ID=replace-with-cloudflare-zone-id/);
  assert.match(deployDoc, /VAN_BLOG_CLOUDFLARE_API_TOKEN/);
  assert.match(deployDoc, /VAN_BLOG_CLOUDFLARE_ZONE_ID/);
  assert.match(deployDoc, /Cloudflare tag\/url purge/);
  assert.match(deployDoc, /只能依赖边缘 TTL 自然过期/);
  assert.match(deployDoc, /只会传给 `server` 容器/);
  assert.match(deployDoc, /siteInfo\.baseUrl/);
  assert.match(deployDoc, /最终对外访问的完整公网地址/);
  assert.match(deployDoc, /Cloudflare URL purge 会跳过/);
  assert.match(releaseDoc, /VAN_BLOG_CLOUDFLARE_API_TOKEN/);
  assert.match(releaseDoc, /VAN_BLOG_CLOUDFLARE_ZONE_ID/);
  assert.match(releaseDoc, /Cloudflare tag\/url purge 不会启用/);
  assert.match(releaseDoc, /siteInfo\.baseUrl/);
  assert.match(releaseDoc, /Cloudflare URL purge 会被跳过/);
  assert.match(
    releaseEnv,
    /VAN_BLOG_WALINE_DATABASE_URL=postgresql:\/\/postgres:postgres@postgres:5432\/waline/,
  );
  assert.match(releaseEnv, /WALINE_JWT_TOKEN=$/m);
  assert.match(deployDoc, /VAN_BLOG_WALINE_DATABASE_URL/);
  assert.match(deployDoc, /VANBLOG_WALINE_CONTROL_URL/);
  assert.match(deployDoc, /首次启动时自动生成一份共享密钥/);
  assert.match(releaseDoc, /waline\.jwt/);
  assert.match(releaseEnv, /VAN_BLOG_FASTGPT_INTERNAL_URL=http:\/\/fastgpt-app:3000/);
  assert.match(releaseEnv, /VANBLOG_DOCKER_REPO=kevinchina\/deeplearning/);
  assert.match(releaseEnv, /VANBLOG_RELEASE_SUFFIX=v1\.4\.1-replace-with-gitsha8/);
  assert.match(releaseEnv, /FASTGPT_ROOT_PASSWORD=replace-with-fastgpt-root-password/);
  assert.match(releaseEnv, /FASTGPT_FREE_PLAN_POINTS=100/);
  assert.match(releaseEnv, /FASTGPT_FREE_PLAN_DURATION_DAYS=30/);
  assert.match(deployDoc, /docker-compose\.ai-qa\.yml/);
  assert.match(deployDoc, /docker-compose\.fastgpt\.yml/);
  assert.match(deployDoc, /docker-compose\.yaml/);
  assert.match(deployDoc, /docs\/ai-qa-fastgpt\.md/);
  assert.match(deployDoc, /fastgpt-bootstrap/);
  assert.match(deployDoc, /不要把 FastGPT 通过 VanBlog 的 Caddy 公开暴露出去/);
  assert.match(deployDoc, /VAN_BLOG_FASTGPT_INTERNAL_URL/);
  assert.match(deployDoc, /FASTGPT_ROOT_PASSWORD/);
  assert.match(deployDoc, /FASTGPT_FREE_PLAN_POINTS/);
  assert.match(deployDoc, /FASTGPT_FREE_PLAN_DURATION_DAYS/);
  assert.match(deployDoc, /\/chat\/completions/);
  assert.match(deployDoc, /\/embeddings/);
  assert.match(deployDoc, /自动创建 Dataset \/ App \/ API Key/);
  assert.match(deployDoc, /team_subscriptions/);
  assert.match(deployDoc, /currentSubLevel/);
  assert.match(deployDoc, /docker-compose\.all-in-one\.latest\.yml/);
  assert.match(deployDoc, /docker-compose\.all-in-one\.image\.yml/);
  assert.match(deployDoc, /all-in-one 首版只覆盖 HTTP 主栈/);
  assert.match(deployDoc, /\/admin\/ai/);
  assert.match(deployDoc, /所有管理员/);
  assert.match(deployDoc, /共享历史/);
  assert.match(deployDoc, /优先参考已同步到 FastGPT 的博客内容/);
  assert.doesNotMatch(deployDoc, /\/admin\/site\/ai-qa/);
  assert.doesNotMatch(deployDoc, /只允许超管/);
  assert.match(releaseDoc, /docker-compose\.ai-qa\.yml/);
  assert.match(releaseDoc, /docker-compose\.fastgpt\.yml/);
  assert.match(releaseDoc, /pnpm release:images.*不会构建或推送 FastGPT 镜像/s);
  assert.match(releaseDoc, /pnpm release:all-in-one/);
  assert.match(releaseDoc, /FASTGPT_ROOT_PASSWORD/);
  assert.match(releaseDoc, /fastgpt-bootstrap/);
  assert.match(releaseDoc, /FASTGPT_FREE_PLAN_POINTS/);
  assert.match(releaseDoc, /FASTGPT_FREE_PLAN_DURATION_DAYS/);
  assert.match(releaseDoc, /currentSubLevel/);
  assert.match(releaseDoc, /自动创建 Dataset \/ App \/ API Key/);
  assert.match(releaseDoc, /\/admin\/ai/);
  assert.match(releaseDoc, /所有管理员/);
  assert.match(releaseDoc, /kevinchina\/deeplearning/);
  assert.match(fastgptConfigExample, /Copy it to docker\/fastgpt\/config\.json/);
});

test('caddy routes requests to the split services', () => {
  assert.match(caddyfile, /http:\/\/ \{/);
  assert.match(caddyfile, /reverse_proxy server:3000/);
  assert.match(caddyfile, /forward_auth server:3000/);
  assert.match(caddyfile, /reverse_proxy server:7681/);
  assert.match(caddyfile, /reverse_proxy website:3001/);
  assert.match(caddyfile, /reverse_proxy admin:3002/);
  assert.match(caddyfile, /reverse_proxy waline:8360/);
  assert.match(caddyfile, /handle \/api\/comment\*/);
  assert.match(caddyfile, /redir @adminNoSlash \/admin\/ 308/);
  assert.match(caddyfile, /redir @adminAiTerminalSlash \/admin\/ai-terminal 308/);
  assert.match(caddyfile, /rewrite \* \/admin\//);
  assert.match(caddyfile, /handle \/admin\*/);
});

test('caddy protects the ai terminal route before the generic admin handler in both configs', () => {
  for (const file of [caddyfile, caddyfileHttps]) {
    const terminalIndex = file.indexOf('handle /admin/ai-terminal*');
    const adminIndex = file.indexOf('handle /admin*');
    assert.ok(terminalIndex > -1, 'missing ai terminal route');
    assert.ok(adminIndex > -1, 'missing generic admin route');
    assert.ok(terminalIndex < adminIndex, 'ai terminal route must precede generic admin route');
    assert.match(file, /forward_auth server:3000 \{[\s\S]*\/api\/admin\/ai-qa\/terminal\/auth/);
  }
});

test('server image bakes in the ai terminal toolchain and supervised startup', () => {
  assert.match(
    serverDockerfile,
    /apk add[\s\S]*bash[\s\S]*git[\s\S]*py3-pip[\s\S]*ripgrep[\s\S]*tmux/,
  );
  assert.match(serverDockerfile, /npm install -g opencode-ai wetty/);
  assert.match(
    serverDockerfile,
    /COPY docker\/server\/terminal-shell\.sh \/app\/server\/terminal-shell\.sh/,
  );
  assert.match(serverDockerfile, /EXPOSE 7681/);
  assert.match(serverEntrypoint, /wetty[\s\S]*--port 7681/);
  assert.match(serverEntrypoint, /--base "\$\{ai_terminal_base\}"/);
  assert.match(serverEntrypoint, /--allow-iframe/);
  assert.match(serverEntrypoint, /wait -n "\$\{server_pid\}" "\$\{wetty_pid\}"/);
  assert.match(
    serverTerminalShell,
    /workspace_dir="\$\{VANBLOG_AI_TERMINAL_WORKSPACE:-\/workspace\/vanblog\}"/,
  );
  assert.match(
    serverTerminalShell,
    /HOME="\$\{VANBLOG_AI_TERMINAL_HOME:-\/app\/ai-terminal-home\}"/,
  );
  assert.match(serverTerminalShell, /exec bash/);
});

test('swagger stays hidden at the caddy layer', () => {
  for (const file of [caddyfile, caddyfileHttps]) {
    assert.match(file, /handle \/swagger\* \{[\s\S]*respond "Not Found" 404[\s\S]*\}/);
  }
});

test('caddy exposes root-level feed and sitemap aliases in both http and https configs', () => {
  for (const file of [caddyfile, caddyfileHttps]) {
    assert.match(
      file,
      /handle \/feed\.json \{[\s\S]*uri replace \/feed\.json \/rss\/feed\.json[\s\S]*reverse_proxy server:3000/,
    );
    assert.match(
      file,
      /handle \/feed\.xml \{[\s\S]*uri replace \/feed\.xml \/rss\/feed\.xml[\s\S]*reverse_proxy server:3000/,
    );
    assert.match(
      file,
      /handle \/atom\.xml \{[\s\S]*uri replace \/atom\.xml \/rss\/atom\.xml[\s\S]*reverse_proxy server:3000/,
    );
    assert.match(
      file,
      /handle \/sitemap\.xml \{[\s\S]*uri replace \/sitemap\.xml \/sitemap\/sitemap\.xml[\s\S]*reverse_proxy server:3000/,
    );
  }
});

test('cloudflare cache samples cover public cache rules and waline bypasses', () => {
  assert.equal(cloudflareRules.version, 1);
  assert.ok(Array.isArray(cloudflareRules.cache_rules));
  const bypassRule = cloudflareRules.cache_rules.find(
    (rule) => rule.name === 'bypass-admin-and-write',
  );
  const searchBypassRule = cloudflareRules.cache_rules.find(
    (rule) => rule.name === 'bypass-public-search-and-admin-nav',
  );
  const publicHtmlRule = cloudflareRules.cache_rules.find(
    (rule) => rule.name === 'cache-public-html',
  );
  const publicJsonRule = cloudflareRules.cache_rules.find(
    (rule) => rule.name === 'cache-public-json-fragments',
  );
  const dynamicHtmlRule = cloudflareRules.cache_rules.find(
    (rule) => rule.name === 'cache-dynamic-public-pages',
  );

  assert.deepEqual(bypassRule.action, { cache: 'bypass' });
  assert.match(JSON.stringify(bypassRule.match.paths), /\/api\/comment\*/);
  assert.match(JSON.stringify(bypassRule.match.paths), /\/comment\*/);
  assert.match(JSON.stringify(bypassRule.match.notes), /Waline/i);
  assert.deepEqual(bypassRule.match.methods, ['POST', 'PUT', 'PATCH', 'DELETE']);

  assert.deepEqual(searchBypassRule.action, { cache: 'bypass' });
  assert.deepEqual(searchBypassRule.match.methods, ['GET', 'HEAD']);
  assert.match(JSON.stringify(searchBypassRule.match.paths), /\/api\/public\/search\*/);
  assert.match(JSON.stringify(searchBypassRule.match.paths), /\/api\/public\/nav\/admin-data/);

  assert.match(JSON.stringify(publicHtmlRule.match.paths), /\/post\/\*/);
  assert.match(JSON.stringify(publicHtmlRule.match.paths), /\/c\/\*/);
  assert.match(JSON.stringify(publicHtmlRule.match.paths), /\/about/);
  assert.match(JSON.stringify(publicHtmlRule.match.paths), /\/link/);
  assert.deepEqual(publicHtmlRule.match.methods, ['GET', 'HEAD']);
  assert.equal(publicHtmlRule.action.edge_ttl, 'respect_origin');

  assert.match(JSON.stringify(publicJsonRule.match.paths), /\/api\/public\/\*/);
  assert.deepEqual(publicJsonRule.match.methods, ['GET', 'HEAD']);
  assert.match(JSON.stringify(publicJsonRule.match.notes), /Only cache anonymous read endpoints/);

  assert.match(JSON.stringify(dynamicHtmlRule.match.paths), /\/moment\*/);
  assert.match(JSON.stringify(dynamicHtmlRule.match.paths), /\/nav\*/);
  assert.deepEqual(dynamicHtmlRule.match.methods, ['GET', 'HEAD']);

  assert.match(JSON.stringify(cloudflareRules.cache_key_hygiene.ignore_query_params), /utm_\*/);
  assert.equal(cloudflareRules.cache_key_hygiene.ignore_anonymous_cookies, true);
  assert.equal(
    cloudflareRules.cache_key_hygiene.public_html_theme_variant.header,
    'x-vanblog-theme',
  );
  assert.equal(cloudflareRules.cache_key_hygiene.public_html_theme_variant.cookie, 'theme');
  assert.match(
    JSON.stringify(cloudflareRules.cache_key_hygiene.public_html_theme_variant.allowed_values),
    /dark/,
  );
  assert.equal(
    cloudflareRules.cache_key_hygiene.public_html_theme_variant.legacy_auto_maps_to,
    'dark',
  );
  assert.match(
    JSON.stringify(cloudflareRules.cache_key_hygiene.preserve_auth_cookies),
    /next-auth\.session-token/,
  );
  assert.match(
    JSON.stringify(cloudflareRules.cache_key_hygiene.preserve_auth_cookies),
    /sessionid/,
  );
  assert.match(JSON.stringify(cloudflareRules), /worker_fallback/);
  assert.match(JSON.stringify(cloudflareRules.optional_enhancements), /Tiered Cache/);
  assert.match(JSON.stringify(cloudflareRules.optional_enhancements), /Respect Strong ETags/);
});

test('cloudflare cache guide documents the intended rule order and bypass constraints', () => {
  const implementedIndex = cloudflareDoc.indexOf('### Implemented in this repo');
  const rolloutIndex = cloudflareDoc.indexOf('### Requires Cloudflare dashboard rollout');
  const notImplementedIndex = cloudflareDoc.indexOf('### Not implemented yet in repo');
  const bypassIndex = cloudflareDoc.indexOf('### 1. Bypass admin and write traffic');
  const publicHtmlIndex = cloudflareDoc.indexOf('### 2. Cache public HTML');
  const searchBypassIndex = cloudflareDoc.indexOf(
    '### 3. Bypass public search and admin nav payloads',
  );
  const publicJsonIndex = cloudflareDoc.indexOf('### 4. Cache public JSON fragments');
  const dynamicIndex = cloudflareDoc.indexOf('### 5. Dynamic public pages');

  assert.ok(implementedIndex >= 0, 'expected repo-implemented status section');
  assert.ok(
    rolloutIndex > implementedIndex,
    'expected dashboard rollout section after repo-implemented section',
  );
  assert.ok(
    notImplementedIndex > rolloutIndex,
    'expected not-yet-implemented section after dashboard rollout section',
  );
  assert.ok(bypassIndex >= 0, 'expected admin/write bypass rule docs');
  assert.ok(publicHtmlIndex > bypassIndex, 'public HTML docs should follow bypass docs');
  assert.ok(
    searchBypassIndex > publicHtmlIndex,
    'search/admin-nav bypass docs should follow public HTML docs',
  );
  assert.ok(
    publicJsonIndex > searchBypassIndex,
    'public JSON docs should follow search bypass docs',
  );
  assert.ok(dynamicIndex > publicJsonIndex, 'dynamic page docs should follow public JSON docs');

  assert.match(cloudflareDoc, /packages\/website\/next\.config\.js/);
  assert.match(
    cloudflareDoc,
    /packages\/server\/src\/provider\/public-cache\/public-cache\.middleware\.ts/,
  );
  assert.match(cloudflareDoc, /packages\/server\/src\/main\.ts/);
  assert.match(cloudflareDoc, /packages\/website\/proxy\.ts/);
  assert.match(cloudflareDoc, /Vary: x-vanblog-theme/);
  assert.match(cloudflareDoc, /x-vanblog-theme/);
  assert.match(cloudflareDoc, /anonymous cacheable public HTML requests/i);
  assert.match(cloudflareDoc, /bypasses auth-like headers and authenticated cookies/i);
  assert.match(cloudflareDoc, /Public article reads are split into shell and fragments/i);
  assert.match(cloudflareDoc, /Browser-side pageview writes are split away from route rendering/i);
  assert.match(cloudflareDoc, /navigator\.sendBeacon\(\)/);
  assert.match(cloudflareDoc, /fetch\(..., \{ keepalive: true \}\)/);
  assert.match(
    cloudflareDoc,
    /public cacheable API responses free of `Vary: Cookie` and `Vary: User-Agent`/,
  );
  assert.match(
    cloudflareDoc,
    /falls back to `no-store` if a public response tries to emit `Set-Cookie`/,
  );
  assert.match(cloudflareDoc, /\/admin\*/);
  assert.match(cloudflareDoc, /\/api\/admin\/\*/);
  assert.match(cloudflareDoc, /\/api\/comment\*/);
  assert.match(cloudflareDoc, /\/comment\*/);
  assert.match(cloudflareDoc, /all non-`GET` and non-`HEAD` requests/);
  assert.match(cloudflareDoc, /\/api\/public\/search\*/);
  assert.match(cloudflareDoc, /\/api\/public\/nav\/admin-data/);
  assert.match(cloudflareDoc, /keep any authenticated request bypassed/i);
  assert.match(
    cloudflareDoc,
    /Ignore anonymous cookies on public pages, but keep a normalized theme variant/i,
  );
  assert.match(
    cloudflareDoc,
    /Public HTML should vary by `x-vanblog-theme`, not by the full `Cookie` header/i,
  );
  assert.match(cloudflareDoc, /normalize legacy `auto` to `dark`/i);
  assert.match(cloudflareDoc, /bypass cache normalization entirely when auth-like cookies/i);
  assert.match(cloudflareDoc, /sessionid/);
  assert.match(
    cloudflareDoc,
    /skips normalization entirely when auth-like headers or authenticated cookies are present/i,
  );
  assert.match(cloudflareDoc, /Waline-related traffic/);
  assert.match(cloudflareDoc, /Enable `Tiered Cache`/);
  assert.match(cloudflareDoc, /Enable `Respect Strong ETags`/);
  assert.match(cloudflareDoc, /Use `Cache Analytics`/);
  assert.match(cloudflareDoc, /Create the Cache Rules below in Cloudflare/i);
  assert.match(cloudflareDoc, /year\/month archives/i);
  assert.match(cloudflareDoc, /legacy `\/page\/\*` routes are redirected away from content pages/i);
  assert.match(
    cloudflareDoc,
    /Viewer\/like writes are not backed by Redis aggregation or queue-based flushing yet/i,
  );
  assert.match(
    cloudflareDoc,
    /does not mean the Cloudflare dashboard has already been configured in production/i,
  );
  assert.match(cloudflareDoc, /must be completed outside this repository/i);
  assert.match(cloudflareDoc, /## Cache-Tag Taxonomy/);
  assert.match(
    cloudflareDoc,
    /`html-public`, `html-post`, `html-listing`, `html-dynamic`, and `home`/,
  );
  assert.match(
    cloudflareDoc,
    /`post:\{id\}`, `post:\{pathname\}`, `tag:\{name\}`, `category:\{name\}`, `timeline:\{year\}`, and `site-stats`/,
  );
  assert.match(
    cloudflareDoc,
    /`category-summary`, `timeline-summary`, `tag-hot`, `tag-list`, `category-list`, and `timeline-list`/,
  );
  assert.match(cloudflareDoc, /`artifact:feed`, `artifact:sitemap`, and `artifact:search-index`/);
  assert.match(cloudflareDoc, /packages\/server\/src\/provider\/isr\/isr\.provider\.ts/);
  assert.match(
    cloudflareDoc,
    /packages\/server\/src\/provider\/cloudflare-cache\/cloudflare-cache\.provider\.ts/,
  );
  assert.match(cloudflareDoc, /siteInfo\.baseUrl/);
  assert.match(cloudflareDoc, /only sends URL purge after it can resolve absolute URLs/i);
  assert.match(cloudflareDoc, /Cloudflare file purge for page and feed URLs will be skipped/i);
  assert.match(
    cloudflareDoc,
    /skips file purge, logs the reason, and leaves tag purge plus TTL expiry as the fallback/i,
  );
  assert.match(
    cloudflareDoc,
    /docker-compose\.yml` and `docker-compose\.image\.yml` now pass `VAN_BLOG_CLOUDFLARE_API_TOKEN` and `VAN_BLOG_CLOUDFLARE_ZONE_ID` through to the `server` container/i,
  );
});

test('cloudflare cache rule samples stay aligned with next public html cache groups', async () => {
  const nextHeaders = await nextConfig.headers();
  const stableRule = nextHeaders.find((rule) => rule.source === '/post/:path*');
  const aboutLinkRule = nextHeaders.find((rule) => rule.source === '/(about|link)');
  const customPageRule = nextHeaders.find((rule) => rule.source === '/c/:path*');
  const listingRules = nextHeaders.filter((rule) =>
    ['/', '/archive', '/archive/:path*', '/category/:path*', '/tag/:path*', '/timeline'].includes(
      rule.source,
    ),
  );
  const dynamicRule = nextHeaders.find((rule) => rule.source === '/(moment|nav)');
  const publicHtmlRule = cloudflareRules.cache_rules.find(
    (rule) => rule.name === 'cache-public-html',
  );
  const dynamicHtmlRule = cloudflareRules.cache_rules.find(
    (rule) => rule.name === 'cache-dynamic-public-pages',
  );

  assert.ok(stableRule, 'expected stable post cache headers in next.config.js');
  assert.ok(aboutLinkRule, 'expected about/link cache headers in next.config.js');
  assert.ok(customPageRule, 'expected custom page cache headers in next.config.js');
  assert.equal(listingRules.length, 6, 'expected listing cache headers in next.config.js');
  assert.ok(dynamicRule, 'expected moment/nav cache headers in next.config.js');

  const nextPublicGroups = getRouteGroupSet([
    stableRule.source,
    aboutLinkRule.source,
    customPageRule.source,
    ...listingRules.map((rule) => rule.source),
  ]);
  const docPublicGroups = getRouteGroupSet(publicHtmlRule.match.paths);
  const nextDynamicGroups = getRouteGroupSet([dynamicRule.source]);
  const docDynamicGroups = getRouteGroupSet(dynamicHtmlRule.match.paths);

  assert.deepEqual(
    [...docPublicGroups].sort(),
    [...nextPublicGroups].sort(),
    'Cloudflare public HTML sample should cover the same stable/listing route groups as next.config.js',
  );
  assert.deepEqual(
    [...docDynamicGroups].sort(),
    [...nextDynamicGroups].sort(),
    'Cloudflare dynamic HTML sample should cover the same high-churn route groups as next.config.js',
  );
});

test('cloudflare cache guide keeps implemented TTL families aligned with next and middleware contracts', async () => {
  const nextHeaders = await nextConfig.headers();
  const stableRule = nextHeaders.find((rule) => rule.source === '/post/:path*');
  const listingRule = nextHeaders.find((rule) => rule.source === '/');
  const dynamicRule = nextHeaders.find((rule) => rule.source === '/(moment|nav)');

  assert.equal(
    getHeaderValue(stableRule, 'Cloudflare-CDN-Cache-Control'),
    'public, s-maxage=604800, stale-while-revalidate=86400',
  );
  assert.equal(
    getHeaderValue(listingRule, 'Cloudflare-CDN-Cache-Control'),
    'public, s-maxage=3600, stale-while-revalidate=86400',
  );
  assert.equal(
    getHeaderValue(dynamicRule, 'Cloudflare-CDN-Cache-Control'),
    'public, s-maxage=300, stale-while-revalidate=600',
  );

  assert.match(
    cloudflareDoc,
    /Stable public HTML .*Cloudflare-CDN-Cache-Control: public, s-maxage=604800, stale-while-revalidate=86400/s,
  );
  assert.match(
    cloudflareDoc,
    /Listing HTML .*Cloudflare-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400/s,
  );
  assert.match(
    cloudflareDoc,
    /Dynamic HTML .*Cloudflare-CDN-Cache-Control: public, s-maxage=300, stale-while-revalidate=600/s,
  );
  assert.match(
    cloudflareDoc,
    /Stable public JSON .*Cache-Control: public, max-age=60, stale-while-revalidate=86400.*Cloudflare-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400/s,
  );
  assert.match(
    cloudflareDoc,
    /Medium-churn public nav JSON .*Cache-Control: public, max-age=60, stale-while-revalidate=900.*Cloudflare-CDN-Cache-Control: public, s-maxage=900, stale-while-revalidate=900/s,
  );
  assert.match(
    cloudflareDoc,
    /High-churn public JSON .*Cache-Control: public, max-age=15, stale-while-revalidate=300.*Cloudflare-CDN-Cache-Control: public, s-maxage=300, stale-while-revalidate=300/s,
  );
  assert.match(
    cloudflareDoc,
    /Public moment JSON .*Cache-Control: public, max-age=30, stale-while-revalidate=300.*Cloudflare-CDN-Cache-Control: public, s-maxage=300, stale-while-revalidate=300/s,
  );

  assert.match(
    publicCacheMiddleware,
    /path\.startsWith\('\/api\/public\/moment'\)[\s\S]*public, max-age=30, stale-while-revalidate=300[\s\S]*public, s-maxage=300, stale-while-revalidate=300/,
  );
  assert.match(
    publicCacheMiddleware,
    /path\.startsWith\('\/api\/public\/nav'\)[\s\S]*public, max-age=60, stale-while-revalidate=900[\s\S]*public, s-maxage=900, stale-while-revalidate=900/,
  );
  assert.match(
    publicCacheMiddleware,
    /path === '\/api\/public\/viewer'[\s\S]*path\.startsWith\('\/api\/public\/article\/viewer\/'\)[\s\S]*path\.endsWith\('\/engagement'\)[\s\S]*path\.endsWith\('\/fragments'\)[\s\S]*path\.startsWith\('\/api\/public\/comment'\)[\s\S]*public, max-age=15, stale-while-revalidate=300[\s\S]*public, s-maxage=300, stale-while-revalidate=300/,
  );
  assert.match(
    publicCacheMiddleware,
    /setEdgeCacheHeaders\([\s\S]*public, max-age=60, stale-while-revalidate=86400[\s\S]*public, s-maxage=3600, stale-while-revalidate=86400/,
  );
  assert.match(
    cloudflareDoc,
    /Public viewer aggregate reads \(`\/api\/public\/viewer`\) also stay on the same short-TTL contract, while the corresponding write path remains a non-cacheable browser-side beacon\/fetch call\./,
  );
  assert.match(
    websiteProviders,
    /import \{ getPageview, recordPageview \} from ['"]\.\.\/api\/pageview['"];/,
  );
  assert.match(
    websiteProviders,
    /createReloadViewer\([\s\S]*getPageview,[\s\S]*recordPageview,[\s\S]*setGlobalState,[\s\S]*\)/,
  );
  assert.match(
    websiteProviders,
    /import \{ usePathname \} from 'next\/navigation';[\s\S]*void reloadViewer\(\);/s,
  );
  assert.match(websitePageviewApi, /fetch\(\s*`?\/api\/public\/viewer`?,\s*\{method: "GET"\}\s*\)/);
  assert.match(
    websitePageviewApi,
    /navigator\.sendBeacon\(url, new Blob\(\[\], \{ type: "text\/plain;charset=UTF-8" \}\)\)/,
  );
  assert.match(
    websitePageviewApi,
    /await fetch\(url, \{[\s\S]*method: "POST",[\s\S]*keepalive: true,[\s\S]*\}\);/,
  );
});

test('static artifact cache contract stays aligned between docs, main bootstrap wiring, and header helper', () => {
  assert.match(
    cloudflareDoc,
    /\/static\/search-index\.json.*Cache-Control: public, max-age=300, stale-while-revalidate=86400.*Cloudflare-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400/s,
  );
  assert.match(
    cloudflareDoc,
    /\/rss\/\*` and `\/sitemap\/\*.*Cache-Control: public, max-age=300, stale-while-revalidate=86400.*Cloudflare-CDN-Cache-Control: public, s-maxage=86400, stale-while-revalidate=86400/s,
  );
  assert.match(
    cloudflareDoc,
    /Content-hashed static assets keep `Cache-Control: public, max-age=31536000, immutable`, while fixed-path assets such as `favicon\.ico` stay on revalidated caching/i,
  );

  assert.match(
    publicCacheMiddleware,
    /Cloudflare-CDN-Cache-Control/,
    'sanity check: shared cache contract still uses Cloudflare-specific headers',
  );

  const staticCacheHelper = fs.readFileSync(
    'packages/server/src/utils/staticCacheHeaders.ts',
    'utf8',
  );
  const serverMain = fs.readFileSync('packages/server/src/main.ts', 'utf8');

  assert.match(
    staticCacheHelper,
    /basename === 'search-index\.json'[\s\S]*public, max-age=300, stale-while-revalidate=86400[\s\S]*public, s-maxage=3600, stale-while-revalidate=86400[\s\S]*artifact:search-index/,
  );
  assert.match(
    staticCacheHelper,
    /kind === 'feed' \|\| kind === 'sitemap' \|\| kind === 'searchIndex'[\s\S]*public, max-age=300, stale-while-revalidate=86400[\s\S]*public, s-maxage=86400, stale-while-revalidate=86400/,
  );
  assert.match(
    staticCacheHelper,
    /hasContentHash\(basename\)[\s\S]*public, max-age=31536000, immutable/,
  );
  assert.match(
    staticCacheHelper,
    /else \{[\s\S]*public, max-age=0, must-revalidate[\s\S]*public, s-maxage=86400, stale-while-revalidate=86400/,
  );
  assert.match(
    serverMain,
    /app\.useStaticAssets\(globalConfig\.staticPath,[\s\S]*prefix: '\/static\/'[\s\S]*setStaticCacheHeaders\('asset', res, filePath\)/,
  );
  assert.match(
    serverMain,
    /app\.useStaticAssets\(path\.join\(globalConfig\.staticPath, 'rss'\),[\s\S]*prefix: '\/rss\/'[\s\S]*setStaticCacheHeaders\('feed', res, filePath\)/,
  );
  assert.match(
    serverMain,
    /app\.useStaticAssets\(path\.join\(globalConfig\.staticPath, 'sitemap'\),[\s\S]*prefix: '\/sitemap\/'[\s\S]*setStaticCacheHeaders\('sitemap', res, filePath\)/,
  );
});

test('cloudflare worker fallback stays aligned with next public html cache groups', async () => {
  const nextHeaders = await nextConfig.headers();
  const stableRule = nextHeaders.find((rule) => rule.source === '/post/:path*');
  const aboutLinkRule = nextHeaders.find((rule) => rule.source === '/(about|link)');
  const customPageRule = nextHeaders.find((rule) => rule.source === '/c/:path*');
  const listingRules = nextHeaders.filter((rule) =>
    ['/', '/archive', '/archive/:path*', '/category/:path*', '/tag/:path*', '/timeline'].includes(
      rule.source,
    ),
  );
  const dynamicRule = nextHeaders.find((rule) => rule.source === '/(moment|nav)');

  const nextPublicGroups = getRouteGroupSet([
    stableRule.source,
    aboutLinkRule.source,
    customPageRule.source,
    ...listingRules.map((rule) => rule.source),
    dynamicRule.source,
  ]);
  const workerGroups = getWorkerRouteGroupSet(cloudflareWorker);

  assert.deepEqual(
    [...workerGroups].sort(),
    [...nextPublicGroups].sort(),
    'Cloudflare worker fallback should cover the same public HTML route groups as next.config.js',
  );
});

test('cloudflare worker sample normalizes marketing params and anonymous cookies', () => {
  assert.match(cloudflareWorker, /utm_/);
  assert.match(cloudflareWorker, /fbclid/);
  assert.match(cloudflareWorker, /gclid/);
  assert.match(cloudflareWorker, /request\.method === "HEAD"/);
  assert.match(cloudflareWorker, /authorization/);
  assert.match(cloudflareWorker, /x-api-key/);
  assert.match(cloudflareWorker, /hasAuthLikeHeader/);
  assert.match(cloudflareWorker, /filteredCookies\.length > 0/);
  assert.match(cloudflareWorker, /return fetch\(request\)/);
  assert.match(cloudflareWorker, /url\.pathname === "\/moment"/);
  assert.match(cloudflareWorker, /url\.pathname === "\/nav"/);
  assert.match(cloudflareWorker, /headers\.delete\("Cookie"\)/);
  assert.match(cloudflareWorker, /headers\.set\("x-vanblog-theme", themeVariant\)/);
  assert.match(cloudflareWorker, /cacheKey:/);
  assert.match(cloudflareWorker, /::theme=\$\{themeVariant\}/);
  assert.match(cloudflareWorker, /theme === "auto"/);
  assert.match(cloudflareWorker, /next-auth\.session-token/);
  assert.match(cloudflareWorker, /sessionid/);
  assert.match(cloudflareWorker, /cacheEverything/);
});

test('cloudflare worker normalizes anonymous public html requests before cache lookup', async () => {
  const worker = createCloudflareWorker();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, init) => {
    calls.push({ request, init });
    return new Response('ok', { status: 200 });
  };

  try {
    const response = await worker.fetch(
      new Request('https://example.com/post/stable-shell?utm_source=x&page=2&fbclid=y', {
        headers: {
          Cookie: 'theme=dark; locale=zh-CN',
        },
      }),
      {},
      {},
    );

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].request.url, 'https://example.com/post/stable-shell?page=2');
    assert.equal(calls[0].request.headers.get('cookie'), null);
    assert.equal(calls[0].request.headers.get('x-vanblog-theme'), 'dark');
    assert.deepEqual(calls[0].init, {
      cf: {
        cacheEverything: true,
        cacheKey: 'https://example.com/post/stable-shell?page=2::theme=dark',
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cloudflare worker also normalizes other cacheable public html groups before cache lookup', async () => {
  const worker = createCloudflareWorker();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, init) => {
    calls.push({ request, init });
    return new Response('ok', { status: 200 });
  };

  try {
    await worker.fetch(new Request('https://example.com/about?utm_source=x'), {}, {});
    await worker.fetch(new Request('https://example.com/link?gclid=y'), {}, {});
    await worker.fetch(new Request('https://example.com/c/cloudflare-cache?fbclid=z'), {}, {});
    await worker.fetch(new Request('https://example.com/moment?utm_medium=email'), {}, {});
    await worker.fetch(new Request('https://example.com/nav?msclkid=abc'), {}, {});

    assert.equal(calls.length, 5);
    assert.equal(calls[0].request.url, 'https://example.com/about');
    assert.equal(calls[1].request.url, 'https://example.com/link');
    assert.equal(calls[2].request.url, 'https://example.com/c/cloudflare-cache');
    assert.equal(calls[3].request.url, 'https://example.com/moment');
    assert.equal(calls[4].request.url, 'https://example.com/nav');
    for (const call of calls) {
      assert.equal(call.request.headers.get('cookie'), null);
      assert.equal(call.request.headers.get('x-vanblog-theme'), null);
      assert.deepEqual(call.init, {
        cf: {
          cacheEverything: true,
          cacheKey: call.request.url,
        },
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cloudflare worker bypasses cache normalization for auth-like headers and cookies', async () => {
  const worker = createCloudflareWorker();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, init) => {
    calls.push({ request, init });
    return new Response('ok', { status: 200 });
  };

  try {
    await worker.fetch(
      new Request('https://example.com/post/stable-shell?utm_source=x', {
        headers: {
          'x-api-key': 'edge-cache-secret',
        },
      }),
      {},
      {},
    );
    await worker.fetch(
      new Request('https://example.com/post/stable-shell?utm_source=x', {
        headers: {
          Cookie: 'token=secret; theme=dark',
        },
      }),
      {},
      {},
    );
    await worker.fetch(
      new Request('https://example.com/post/stable-shell?utm_source=x', {
        headers: {
          Cookie: 'sessionid=secret; theme=dark',
        },
      }),
      {},
      {},
    );

    assert.equal(calls.length, 3);
    assert.equal(calls[0].request.url, 'https://example.com/post/stable-shell?utm_source=x');
    assert.equal(calls[0].init, undefined);
    assert.equal(calls[1].request.url, 'https://example.com/post/stable-shell?utm_source=x');
    assert.equal(calls[1].request.headers.get('cookie'), 'token=secret; theme=dark');
    assert.equal(calls[1].init, undefined);
    assert.equal(calls[2].request.url, 'https://example.com/post/stable-shell?utm_source=x');
    assert.equal(calls[2].request.headers.get('cookie'), 'sessionid=secret; theme=dark');
    assert.equal(calls[2].init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cloudflare worker skips normalization for non-public-html or non-read requests', async () => {
  const worker = createCloudflareWorker();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, init) => {
    calls.push({ request, init });
    return new Response('ok', { status: 200 });
  };

  try {
    await worker.fetch(
      new Request('https://example.com/api/public/article/1?utm_source=x'),
      {},
      {},
    );
    await worker.fetch(
      new Request('https://example.com/post/stable-shell?utm_source=x', {
        method: 'POST',
      }),
      {},
      {},
    );

    assert.equal(calls.length, 2);
    assert.equal(calls[0].request.url, 'https://example.com/api/public/article/1?utm_source=x');
    assert.equal(calls[0].init, undefined);
    assert.equal(calls[1].request.url, 'https://example.com/post/stable-shell?utm_source=x');
    assert.equal(calls[1].request.method, 'POST');
    assert.equal(calls[1].init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cloudflare worker leaves feed, sitemap, and robots aliases outside public-html normalization', async () => {
  const worker = createCloudflareWorker();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, init) => {
    calls.push({ request, init });
    return new Response('ok', { status: 200 });
  };

  try {
    await worker.fetch(new Request('https://example.com/feed.xml?utm_source=x'), {}, {});
    await worker.fetch(new Request('https://example.com/feed.json?fbclid=y'), {}, {});
    await worker.fetch(new Request('https://example.com/atom.xml?gclid=z'), {}, {});
    await worker.fetch(new Request('https://example.com/sitemap.xml?utm_campaign=cache'), {}, {});
    await worker.fetch(new Request('https://example.com/robots.txt?utm_medium=email'), {}, {});

    assert.equal(calls.length, 5);
    assert.equal(calls[0].request.url, 'https://example.com/feed.xml?utm_source=x');
    assert.equal(calls[1].request.url, 'https://example.com/feed.json?fbclid=y');
    assert.equal(calls[2].request.url, 'https://example.com/atom.xml?gclid=z');
    assert.equal(calls[3].request.url, 'https://example.com/sitemap.xml?utm_campaign=cache');
    assert.equal(calls[4].request.url, 'https://example.com/robots.txt?utm_medium=email');
    for (const call of calls) {
      assert.equal(call.init, undefined);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('stateful data services stay private to the compose network', () => {
  for (const service of ['postgres', 'redis']) {
    const section =
      compose.match(
        new RegExp(`\\n  ${service}:\\n([\\s\\S]*?)(?:\\n  [a-z][a-z0-9_-]*:|\\n$)`, 'i'),
      )?.[1] ?? '';
    assert.ok(section.length > 0, `expected to find the ${service} service block`);
    assert.doesNotMatch(section, /\n\s+ports:\s*\n/);
    assert.match(section, /healthcheck:/);
  }
});

test('caddy admin API stays private to the compose network', () => {
  const caddySection =
    compose.match(/\n  caddy:\n([\s\S]*?)(?:\n  [a-z][a-z0-9_-]*:|\n$)/i)?.[1] ?? '';
  assert.ok(caddySection.length > 0, 'expected to find the caddy service block');
  assert.match(caddyfile, /admin 0\.0\.0\.0:2019/);
  assert.doesNotMatch(caddySection, /2019:2019/);
  assert.doesNotMatch(caddySection, /VANBLOG_CADDY_ADMIN_PORT/);
});
