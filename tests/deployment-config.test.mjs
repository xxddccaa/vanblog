import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const read = (path) => fs.readFileSync(path, 'utf8');
const exists = (path) => fs.existsSync(path);

const compose = read('docker-compose.yml');
const composeImage = read('docker-compose.image.yml');
const composeLatest = read('docker-compose.latest.yml');
const composeAllInOne = read('docker-compose.all-in-one.yml');
const composeAllInOneImage = read('docker-compose.all-in-one.image.yml');
const composeAllInOneLatest = read('docker-compose.all-in-one.latest.yml');
const manualCompose = read('tests/manual-v1.3.0/docker-compose.yaml');

const caddyfile = read('docker/caddy/Caddyfile');
const caddyfileHttps = read('docker/caddy/Caddyfile.https');
const allInOneCaddyfile = read('docker/all-in-one/Caddyfile');

const serverDockerfile = read('docker/server.Dockerfile');
const serverDockerignore = read('docker/server.Dockerfile.dockerignore');
const serverEntrypoint = read('docker/server/entrypoint.sh');
const walineDockerfile = read('docker/waline.Dockerfile');
const walineDockerignore = read('docker/waline.Dockerfile.dockerignore');
const websiteEntrypoint = read('docker/website/entrypoint.sh');
const walineEntrypoint = read('docker/waline/entrypoint.sh');
const allInOneDockerfile = read('docker/all-in-one.Dockerfile');
const allInOneEntrypoint = read('docker/all-in-one/entrypoint.sh');
const allInOneHealthcheck = read('docker/all-in-one/healthcheck.sh');

const readmeDoc = read('README.md');
const deployDoc = read('DEPLOY.md');
const releaseDoc = read('RELEASE.md');
const agentsDoc = read('AGENTS.md');
const claudeDoc = read('CLAUDE.md');
const docsHomeDoc = read('docs/README.md');
const introDoc = read('docs/intro.md');
const guideGetStartedDoc = read('docs/guide/get-started.md');
const guideUpdateDoc = read('docs/guide/update.md');
const guideDockerSnippetDoc = read('docs/guide/docker.snippet.md');
const faqReadmeDoc = read('docs/faq/README.md');
const faqDeployDoc = read('docs/faq/deploy.md');
const faqUpdateDoc = read('docs/faq/update.md');
const referenceEnvDoc = read('docs/reference/env.md');
const referenceDirDoc = read('docs/reference/dir.md');
const referenceLogDoc = read('docs/reference/log.md');
const releaseEnv = read('.env.release.example');
const packageJson = JSON.parse(read('package.json'));
const cloudflareDoc = read('docs/cloudflare-cache.md');
const cloudflareRules = JSON.parse(read('docs/cloudflare-cache-rules.example.json'));
const cloudflareWorker = read('docs/cloudflare-worker-cache-normalize.js');
const publicCacheMiddleware = read(
  'packages/server/src/provider/public-cache/public-cache.middleware.ts',
);
const websiteProviders = read('packages/website/app/providers.tsx');
const websitePageviewApi = read('packages/website/api/pageview.ts');
const websiteMarkdownTheme = read('packages/website/utils/markdownTheme.ts');
const adminMarkdownTheme = read('packages/admin/src/utils/markdownTheme.ts');

const require = createRequire(import.meta.url);
const nextConfig = require('../packages/website/next.config.js');

test('host, CI, packages, and Docker builds stay on Node 22', () => {
  assert.equal(read('.nvmrc').trim(), '22.22.2');
  assert.equal(read('.node-version').trim(), '22.22.2');
  assert.equal(packageJson.engines.node, '>=22 <23');
  assert.equal(JSON.parse(read('packages/admin/package.json')).engines.node, '>=22 <23');
  assert.match(read('.github/workflows/ci.yml'), /node-version: 22\.22\.2/);

  for (const path of [
    'Dockerfile',
    'docker/server.Dockerfile',
    'docker/website.Dockerfile',
    'docker/waline.Dockerfile',
    'docker/all-in-one.Dockerfile',
    'packages/admin/Dockerfile',
    'packages/server/Dockerfile',
    'packages/website/Dockerfile',
  ]) {
    const dockerfile = read(path);
    assert.match(dockerfile, /^FROM node:22\.22\.2(?:-alpine)?(?:\s|$)/m);
    assert.doesNotMatch(dockerfile, /^FROM node:24(?:[.\-:]|\s|$)/m);
  }
});

const noAiPatterns = [
  /\/admin\/ai\b/,
  /docker-compose\.ai-qa\.yml/,
  /docker-compose\.fastgpt\.yml/,
  /docker-compose\.latest\.ai\.yml/,
  /docs\/ai-qa-fastgpt\.md/,
  /guide\/ai-workspace\.html/,
  /\bFastGPT\b/,
  /ai-terminal/,
  /VANBLOG_AI_TERMINAL/,
  /VAN_BLOG_FASTGPT_INTERNAL_URL/,
  /FASTGPT_ROOT_PASSWORD/,
  /fastgpt-bootstrap/,
];

const assertNoAiContent = (content, label) => {
  for (const pattern of noAiPatterns) {
    assert.doesNotMatch(content, pattern, `${label} should not mention ${pattern}`);
  }
};

const createCloudflareWorker = () => {
  const factory = new Function(cloudflareWorker.replace(/^export default\s+/, 'return '));
  return factory();
};

const getWorkerRouteGroupSet = (workerSource) => {
  const routeGroups = new Set();

  if (workerSource.includes('url.pathname === "/"')) routeGroups.add('home');
  if (workerSource.includes('url.pathname.startsWith("/post/")')) routeGroups.add('post');
  if (
    workerSource.includes('url.pathname === "/archive"') ||
    workerSource.includes('url.pathname.startsWith("/archive/")')
  ) {
    routeGroups.add('archive');
  }
  if (workerSource.includes('url.pathname.startsWith("/category")')) routeGroups.add('category');
  if (workerSource.includes('url.pathname.startsWith("/tag")')) routeGroups.add('tag');
  if (workerSource.includes('url.pathname === "/timeline"')) routeGroups.add('timeline');
  if (workerSource.includes('url.pathname === "/about"')) routeGroups.add('about');
  if (workerSource.includes('url.pathname === "/link"')) routeGroups.add('link');
  if (workerSource.includes('url.pathname.startsWith("/c/")')) routeGroups.add('custom-page');
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
    if (path === '/') routeGroups.add('home');
    if (path.includes('/post/')) routeGroups.add('post');
    if (path.includes('/archive')) routeGroups.add('archive');
    if (path.includes('/category')) routeGroups.add('category');
    if (path.includes('/tag')) routeGroups.add('tag');
    if (path.includes('/timeline')) routeGroups.add('timeline');
    if (path.includes('about')) routeGroups.add('about');
    if (path.includes('link')) routeGroups.add('link');
    if (path.includes('/c/')) routeGroups.add('custom-page');
    if (path.includes('moment')) routeGroups.add('moment');
    if (path.includes('nav')) routeGroups.add('nav');
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
  for (const file of [compose, composeImage]) {
    assert.match(file, /VANBLOG_SECRET_DIR:-\.\/secrets}:\s*\/run\/secrets\/vanblog/);
  }
  assert.match(composeLatest, /\.\/secrets:\/run\/secrets\/vanblog/);
  assert.doesNotMatch(compose, /fastgpt/i);
});

test('all-in-one compose defines a single non-AI service', () => {
  for (const file of [composeAllInOne, composeAllInOneImage, composeAllInOneLatest]) {
    assert.match(file, /^services:\s*\n\s{2}vanblog:/m);
    assert.doesNotMatch(file, /^\s{2}caddy:/m);
    assert.doesNotMatch(file, /^\s{2}fastgpt-app:/m);
    assert.match(file, /POSTGRES_DB:/);
    assert.match(file, /VANBLOG_REDIS_DIR/);
    assert.match(file, /WALINE_JWT_TOKEN:/);
    assert.match(file, /VANBLOG_SECRET_DIR:-\.\/secrets}:\s*\/run\/secrets\/vanblog/);
  }

  assert.match(composeAllInOne, /docker\/all-in-one\.Dockerfile/);
  assert.match(composeAllInOneImage, /vanblog-all-in-one-\$\{VANBLOG_RELEASE_SUFFIX:-latest\}/);
  assert.match(composeAllInOneLatest, /vanblog-all-in-one-latest/);
  assert.match(composeAllInOneLatest, /POSTGRES_SHARED_BUFFERS:\s+\$\{POSTGRES_SHARED_BUFFERS:-8GB\}/);
  assert.match(composeAllInOneLatest, /POSTGRES_EFFECTIVE_CACHE_SIZE:\s+\$\{POSTGRES_EFFECTIVE_CACHE_SIZE:-24GB\}/);
  assert.match(composeAllInOneLatest, /REDIS_SAVE_POLICY:\s+\$\{REDIS_SAVE_POLICY:-900 1 300 10 60 10000\}/);
  assert.match(composeAllInOneLatest, /REDIS_MAXMEMORY:\s+\$\{REDIS_MAXMEMORY:-4gb\}/);
});

test('all-in-one runtime uses localhost fan-out and no AI terminal flags', () => {
  assert.match(allInOneDockerfile, /VANBLOG_IMAGE_NAME="vanblog-all-in-one"/);
  assert.match(allInOneDockerfile, /COPY docker\/all-in-one\/Caddyfile \/etc\/caddy\/Caddyfile/);
  assert.match(allInOneDockerfile, /COPY docker\/all-in-one\/entrypoint\.sh/);
  assert.match(allInOneDockerfile, /COPY docker\/all-in-one\/healthcheck\.sh/);
  assert.match(allInOneDockerfile, /ENV POSTGRES_SHARED_BUFFERS=8GB/);
  assert.match(allInOneDockerfile, /ENV POSTGRES_EFFECTIVE_CACHE_SIZE=24GB/);
  assert.match(allInOneDockerfile, /ENV REDIS_SAVE_POLICY="900 1 300 10 60 10000"/);
  assert.match(allInOneDockerfile, /ENV REDIS_MAXMEMORY=4gb/);
  assert.match(allInOneDockerfile, /ENV VAN_BLOG_SERVER_URL="http:\/\/127\.0\.0\.1:3000"/);
  assert.doesNotMatch(allInOneDockerfile, /terminal-shell/);

  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3000/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3001/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3002/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:8360/);
  assert.doesNotMatch(allInOneCaddyfile, /ai-terminal/);

  assert.match(allInOneEntrypoint, /127\.0\.0\.1:2019/);
  assert.match(allInOneEntrypoint, /ensure_postgres_database/);
  assert.match(allInOneEntrypoint, /ensure_postgres_password/);
  assert.match(allInOneEntrypoint, /redis-server/);
  assert.match(allInOneEntrypoint, /postgres -D/);
  assert.match(allInOneEntrypoint, /write_postgres_runtime_config/);
  assert.match(allInOneEntrypoint, /shared_buffers =/);
  assert.match(allInOneEntrypoint, /work_mem =/);
  assert.match(allInOneEntrypoint, /write_redis_runtime_config/);
  assert.match(allInOneEntrypoint, /initialize_runtime_secrets/);
  assert.match(allInOneEntrypoint, /requirepass \$\{REDIS_PASSWORD\}/);
  assert.match(allInOneDockerfile, /adduser -S -D -H -u 10001/);
  assert.doesNotMatch(allInOneDockerfile, /ENV POSTGRES_PASSWORD=postgres/);
  assert.match(allInOneEntrypoint, /maxmemory-policy/);
  assert.doesNotMatch(allInOneEntrypoint, /VANBLOG_AI_TERMINAL_ENABLED/);
  assert.match(
    serverEntrypoint,
    /su-exec vanblog:vanblog bash "\$\(readlink -f "\$0"\)"/,
  );
  for (const entrypoint of [websiteEntrypoint, walineEntrypoint]) {
    assert.match(entrypoint, /su-exec vanblog:vanblog sh "\$\(readlink -f "\$0"\)"/);
  }

  assert.match(allInOneHealthcheck, /pg_isready -h 127\.0\.0\.1/);
  assert.match(allInOneHealthcheck, /redis-cli -h 127\.0\.0\.1/);
  assert.match(allInOneHealthcheck, /http:\/\/127\.0\.0\.1:3002\/admin\//);
});

test('docker compose wires cross-container control endpoints', () => {
  assert.match(compose, /VANBLOG_CADDY_API_URL:\s+http:\/\/caddy:2019/);
  assert.match(compose, /VANBLOG_WEBSITE_CONTROL_URL:\s+http:\/\/website:3011/);
  assert.match(compose, /VANBLOG_WALINE_CONTROL_URL:\s+http:\/\/waline:8361/);
  assert.match(compose, /VAN_BLOG_DATABASE_URL:\s+\$\{VAN_BLOG_DATABASE_URL:-postgresql:\/\//);
  assert.match(
    compose,
    /VAN_BLOG_REDIS_URL:\s+\$\{VAN_BLOG_REDIS_URL:-redis:\/\/:\$\{REDIS_PASSWORD:\?/,
  );
  assert.match(compose, /VANBLOG_WEBSITE_ISR_BASE:\s+http:\/\/website:3001\/api\/revalidate\?path=/);
  assert.match(compose, /VAN_BLOG_CLOUDFLARE_API_TOKEN:\s+\$\{VAN_BLOG_CLOUDFLARE_API_TOKEN:-\}/);
  assert.match(compose, /VAN_BLOG_CLOUDFLARE_ZONE_ID:\s+\$\{VAN_BLOG_CLOUDFLARE_ZONE_ID:-\}/);
  for (const file of [compose, composeImage, composeLatest]) {
    assert.match(file, /POSTGRES_PASSWORD:\s+\$\{POSTGRES_PASSWORD:\?/);
    assert.match(file, /REDIS_PASSWORD:\s+\$\{REDIS_PASSWORD:\?/);
    assert.match(file, /--requirepass/);
    assert.match(file, /REDISCLI_AUTH/);
    assert.doesNotMatch(file, /POSTGRES_PASSWORD:\s+postgres(?:\s|$)/);
  }
  for (const file of [
    compose,
    composeImage,
    composeLatest,
    composeAllInOne,
    composeAllInOneImage,
    composeAllInOneLatest,
  ]) {
    assert.match(
      file,
      /wget['",\s-]+q['",\s-]+O['",\s/]+dev\/null['",\s]+http:\/\/localhost:8000\/health/,
    );
    assert.doesNotMatch(file, /wget['",\s-]+spider[^\\n]*localhost:8000\/health/);
  }

  assert.doesNotMatch(compose, /VAN_BLOG_FASTGPT_INTERNAL_URL/);
  assert.doesNotMatch(composeImage, /VAN_BLOG_FASTGPT_INTERNAL_URL/);
  assert.doesNotMatch(composeLatest, /VAN_BLOG_FASTGPT_INTERNAL_URL/);
});

test('AI-specific compose and docs files are removed', () => {
  for (const path of [
    'docker-compose.ai-qa.yml',
    'docker-compose.fastgpt.yml',
    'docker-compose.latest.ai.yml',
    'docs/ai-qa-fastgpt.md',
    'docs/guide/ai-workspace.md',
    'docker/server/terminal-shell.sh',
    'docker/fastgpt/config.json',
    'docker/fastgpt/config.json.example',
    'docker/fastgpt/bootstrap-team-free-plan.js',
  ]) {
    assert.equal(exists(path), false, `${path} should be removed`);
  }
});

test('server runtime no longer bundles AI terminal dependencies', () => {
  assert.doesNotMatch(serverDockerfile, /opencode-ai/);
  assert.doesNotMatch(serverDockerfile, /wetty/);
  assert.doesNotMatch(serverDockerfile, /terminal-shell/);
  assert.doesNotMatch(serverDockerfile, /EXPOSE 7681/);

  assert.match(serverEntrypoint, /node dist\/src\/main\.js/);
  assert.doesNotMatch(serverEntrypoint, /wetty/);
  assert.doesNotMatch(serverEntrypoint, /ai_terminal_/);
  assert.doesNotMatch(serverEntrypoint, /VANBLOG_AI_TERMINAL/);
  assert.match(serverDockerfile, /FROM node:22\.22\.2-alpine AS runner/);
  assert.match(serverDockerfile, /adduser -S -D -H -u 10001/);
  assert.match(serverEntrypoint, /exec su-exec vanblog:vanblog/);
  assert.match(
    serverEntrypoint,
    /\/run\/secrets\/vanblog\/backup-encryption\.key/,
  );
  assert.doesNotMatch(
    serverEntrypoint,
    /VANBLOG_BACKUP_ENCRYPTION_KEY:-\$\{WALINE_SHARED_JWT\}/,
  );
  assert.doesNotMatch(
    serverDockerfile.slice(serverDockerfile.indexOf('FROM node:22.22.2-alpine AS runner')),
    /apk add[^\n]*(?:git|python3|make|g\+\+|ripgrep|tmux)/,
  );
  for (const file of [compose, composeImage, composeLatest]) {
    assert.match(file, /security_opt:\s*\n\s+- no-new-privileges:true/);
    assert.match(file, /cap_drop:\s*\n\s+- ALL/);
    assert.match(file, /cap_add:\s*\n\s+- CHOWN\s*\n\s+- DAC_OVERRIDE\s*\n\s+- SETGID\s*\n\s+- SETUID/);
    assert.match(file, /pids_limit: 256/);
    assert.match(file, /:\/home\/vanblog\/\.config\/aliyunpan/);
  }
});

test('split server and Waline images include the patched production dependency graph', () => {
  assert.match(serverDockerfile, /COPY patches \.\/patches/);
  assert.match(serverDockerignore, /!patches\/\*\*/);
  assert.match(walineDockerfile, /COPY patches \.\/patches/);
  assert.match(walineDockerignore, /!package\.json/);
  assert.match(walineDockerignore, /!pnpm-lock\.yaml/);
  assert.match(walineDockerignore, /!pnpm-workspace\.yaml/);
  assert.match(walineDockerignore, /!patches\/\*\*/);
  assert.match(walineDockerignore, /!scripts\/fix-waline-adapter\.js/);
  assert.match(
    walineDockerfile,
    /pnpm install --filter @vanblog\/waline\.\.\. --prod --ignore-scripts --frozen-lockfile/,
  );
  assert.match(
    serverDockerfile,
    /delete manifest\.pnpm\?\.patchedDependencies;[\s\S]*pnpm deploy --legacy/,
  );
  assert.match(walineDockerfile, /COPY --from=builder \/app\/node_modules \/app\/node_modules/);
  assert.match(
    walineDockerfile,
    /COPY --from=builder \/app\/packages\/waline \/app\/packages\/waline/,
  );
  assert.match(walineDockerfile, /ln -s \/app\/packages\/waline \/app\/waline/);
  assert.match(
    walineDockerfile,
    /chown -R vanblog:vanblog \/app\/waline\/node_modules\/@waline\/vercel\/runtime/,
  );
});

test('Caddy only exposes blog, admin, api, and comment routes', () => {
  for (const file of [caddyfile, caddyfileHttps, allInOneCaddyfile]) {
    assert.match(file, /redir @adminNoSlash \/admin\/ 308/);
    assert.match(file, /handle \/admin\*/);
    assert.match(file, /handle \/api\/\*/);
    assert.doesNotMatch(file, /ai-terminal/);
    assert.doesNotMatch(file, /\/api\/admin\/ai-qa\/terminal\/auth/);
    assert.doesNotMatch(file, /server:7681/);
    assert.match(file, /handle \/swagger\* \{\s*respond "Not Found" 404/s);
    assert.match(file, /X-Content-Type-Options "nosniff"/);
    assert.match(file, /X-Frame-Options "SAMEORIGIN"/);
    assert.match(file, /\?Content-Security-Policy "default-src 'self'; script-src 'self';/);
    assert.doesNotMatch(file, /script-src[^;"]*'unsafe-inline'/);
  }
  for (const file of [caddyfile, caddyfileHttps]) {
    assert.match(file, /reverse_proxy website:3001/);
    assert.match(file, /reverse_proxy waline:8360/);
  }
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3001/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:8360/);
});

test('manual compose fixture stays on the split runtime topology', () => {
  for (const service of ['caddy:', 'server:', 'website:', 'admin:', 'waline:', 'postgres:', 'redis:']) {
    assert.match(manualCompose, new RegExp(`^\\s{2}${service}`, 'm'));
  }
  assert.doesNotMatch(manualCompose, /fastgpt/i);
});

test('current top-level docs no longer mention removed admin AI workspace', () => {
  for (const [label, content] of [
    ['README.md', readmeDoc],
    ['DEPLOY.md', deployDoc],
    ['RELEASE.md', releaseDoc],
    ['AGENTS.md', agentsDoc],
    ['CLAUDE.md', claudeDoc],
    ['docs/README.md', docsHomeDoc],
    ['docs/intro.md', introDoc],
    ['docs/guide/get-started.md', guideGetStartedDoc],
    ['docs/guide/update.md', guideUpdateDoc],
    ['docs/guide/docker.snippet.md', guideDockerSnippetDoc],
    ['docs/faq/README.md', faqReadmeDoc],
    ['docs/faq/deploy.md', faqDeployDoc],
    ['docs/faq/update.md', faqUpdateDoc],
    ['docs/reference/env.md', referenceEnvDoc],
    ['docs/reference/dir.md', referenceDirDoc],
    ['docs/reference/log.md', referenceLogDoc],
    ['.env.release.example', releaseEnv],
  ]) {
    assertNoAiContent(content, label);
  }
});

test('docs still describe supported deployment paths', () => {
  assert.match(readmeDoc, /docker-compose\.latest\.yml/);
  assert.match(readmeDoc, /docker-compose\.image\.yml/);
  assert.match(readmeDoc, /docker-compose\.all-in-one\.latest\.yml/);

  assert.match(deployDoc, /docker-compose\.latest\.yml/);
  assert.match(deployDoc, /docker-compose\.image\.yml/);
  assert.match(deployDoc, /docker-compose\.all-in-one\.latest\.yml/);
  assert.match(deployDoc, /docker run -d/);
  assert.match(guideGetStartedDoc, /docker run -d/);

  assert.match(releaseDoc, /docker-compose\.latest\.yml/);
  assert.match(releaseDoc, /docker-compose\.image\.yml/);
  assert.match(releaseDoc, /vanblog-all-in-one/);
});

test('Cloudflare worker routes and docs stay aligned with website routing', () => {
  const workerRouteGroups = getWorkerRouteGroupSet(cloudflareWorker);
  const docRouteGroups = getRouteGroupSet(
    cloudflareRules.cache_rules.flatMap((rule) => rule.match?.paths || []),
  );

  assert.deepEqual([...workerRouteGroups].sort(), [...docRouteGroups].sort());

  assert.match(cloudflareDoc, /Cloudflare/);
  assert.match(publicCacheMiddleware, /cacheTag/);
  assert.match(websiteProviders, /getPageview/);
  assert.match(websitePageviewApi, /recordPageview/);
  assert.match(websiteMarkdownTheme, /withMarkdownThemeAssetVersion/);
  assert.match(adminMarkdownTheme, /withMarkdownThemeAssetVersion/);
  assert.equal(typeof createCloudflareWorker, 'function');
});

test('Next.js config still supports the expected asset and image behavior', () => {
  assert.equal(typeof nextConfig, 'object');
  assert.equal(nextConfig.output, 'standalone');
  assert.equal(nextConfig.basePath, undefined);
  assert.equal(typeof nextConfig.images, 'object');
  assert.equal(typeof nextConfig.headers, 'function');
});

test('package version and release env example stay consistent', () => {
  assert.equal(packageJson.version, '1.8.1');
  assert.match(releaseEnv, /VANBLOG_DOCKER_REPO=kevinchina\/deeplearning/);
  assert.match(releaseEnv, /VANBLOG_RELEASE_SUFFIX=v1\.8\.1-replace-with-gitsha8/);
  assert.doesNotMatch(releaseEnv, /FASTGPT_ROOT_PASSWORD/);
});

test('deployment docs still point to admin and init entrypoints', () => {
  assert.match(readmeDoc, /\/admin/);
  assert.match(readmeDoc, /\/admin\/init/);
  assert.match(deployDoc, /\/admin\/init/);
  assert.match(guideGetStartedDoc, /\/admin\/init/);
  assert.doesNotMatch(readmeDoc, /\/admin\/ai/);
  assert.doesNotMatch(deployDoc, /\/admin\/ai/);
  assert.doesNotMatch(guideGetStartedDoc, /\/admin\/ai/);
});

test('all compose files cap docker logs with json-file rotation', () => {
  const composes = [
    compose,
    composeImage,
    composeLatest,
    composeAllInOne,
    composeAllInOneImage,
    composeAllInOneLatest,
  ];
  for (const file of composes) {
    assert.match(file, /x-logging:\s*&default-logging/);
    assert.match(file, /driver:\s*json-file/);
    assert.match(file, /max-size:\s*"10m"/);
    assert.match(file, /max-file:\s*"3"/);
    assert.match(file, /logging:\s*\*default-logging/);
  }
});

test('all-in-one overrides waline api url to localhost (fixes ENOTFOUND + comment count)', () => {
  for (const file of [composeAllInOne, composeAllInOneImage, composeAllInOneLatest]) {
    assert.match(file, /VAN_BLOG_WALINE_API_URL:\s*\$\{VAN_BLOG_WALINE_API_URL:-http:\/\/127\.0\.0\.1:8360\}/);
  }
  assert.match(allInOneEntrypoint, /VAN_BLOG_WALINE_API_URL/);
});

test('caddy access logs skip internal healthchecks and roll', () => {
  for (const file of [caddyfile, caddyfileHttps, allInOneCaddyfile]) {
    assert.match(file, /log_skip @vanblog_healthcheck/);
    assert.match(file, /header User-Agent Wget\*/);
    assert.match(file, /roll_size 5MiB/);
    assert.match(file, /roll_keep 3/);
    // 不能误伤 caddy.log（后台 Caddy 日志页读取源）
    assert.match(file, /output file \/var\/log\/caddy\.log/);
  }
});

test('redis noise is reduced to warning level', () => {
  assert.match(allInOneEntrypoint, /REDIS_LOGLEVEL="\$\{REDIS_LOGLEVEL:-warning\}"/);
  assert.match(allInOneEntrypoint, /loglevel \$\{REDIS_LOGLEVEL\}/);
  for (const file of [compose, composeImage, composeLatest]) {
    assert.match(file, /--loglevel['",\s]+warning/);
  }
});

test('release env documents the new log-governance knobs', () => {
  assert.match(releaseEnv, /VAN_BLOG_LOG_LEVEL/);
  assert.match(releaseEnv, /VAN_BLOG_WALINE_API_URL/);
  assert.match(releaseEnv, /REDIS_LOGLEVEL/);
});
