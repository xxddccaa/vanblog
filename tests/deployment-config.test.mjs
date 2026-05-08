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
const serverEntrypoint = read('docker/server/entrypoint.sh');
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
  }

  assert.match(composeAllInOne, /docker\/all-in-one\.Dockerfile/);
  assert.match(composeAllInOneImage, /vanblog-all-in-one-\$\{VANBLOG_RELEASE_SUFFIX:-latest\}/);
  assert.match(composeAllInOneLatest, /vanblog-all-in-one-latest/);
});

test('all-in-one runtime uses localhost fan-out and no AI terminal flags', () => {
  assert.match(allInOneDockerfile, /VANBLOG_IMAGE_NAME="vanblog-all-in-one"/);
  assert.match(allInOneDockerfile, /COPY docker\/all-in-one\/Caddyfile \/etc\/caddy\/Caddyfile/);
  assert.match(allInOneDockerfile, /COPY docker\/all-in-one\/entrypoint\.sh/);
  assert.match(allInOneDockerfile, /COPY docker\/all-in-one\/healthcheck\.sh/);
  assert.doesNotMatch(allInOneDockerfile, /terminal-shell/);

  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3000/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3001/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3002/);
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:8360/);
  assert.doesNotMatch(allInOneCaddyfile, /ai-terminal/);

  assert.match(allInOneEntrypoint, /127\.0\.0\.1:2019/);
  assert.match(allInOneEntrypoint, /ensure_postgres_database/);
  assert.match(allInOneEntrypoint, /redis-server/);
  assert.match(allInOneEntrypoint, /postgres -D/);
  assert.doesNotMatch(allInOneEntrypoint, /VANBLOG_AI_TERMINAL_ENABLED/);

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
  assert.match(compose, /VANBLOG_WEBSITE_ISR_BASE:\s+http:\/\/website:3001\/api\/revalidate\?path=/);
  assert.match(compose, /VAN_BLOG_CLOUDFLARE_API_TOKEN:\s+\$\{VAN_BLOG_CLOUDFLARE_API_TOKEN:-\}/);
  assert.match(compose, /VAN_BLOG_CLOUDFLARE_ZONE_ID:\s+\$\{VAN_BLOG_CLOUDFLARE_ZONE_ID:-\}/);

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
});

test('Caddy only exposes blog, admin, api, and comment routes', () => {
  for (const file of [caddyfile, caddyfileHttps]) {
    assert.match(file, /redir @adminNoSlash \/admin\/ 308/);
    assert.match(file, /handle \/admin\*/);
    assert.match(file, /handle \/api\/\*/);
    assert.match(file, /reverse_proxy website:3001/);
    assert.match(file, /reverse_proxy waline:8360/);
    assert.doesNotMatch(file, /ai-terminal/);
    assert.doesNotMatch(file, /\/api\/admin\/ai-qa\/terminal\/auth/);
    assert.doesNotMatch(file, /server:7681/);
  }
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
  assert.equal(packageJson.version, '1.6.0');
  assert.match(releaseEnv, /VANBLOG_DOCKER_REPO=kevinchina\/deeplearning/);
  assert.match(releaseEnv, /VANBLOG_RELEASE_SUFFIX=v1\.6\.0-replace-with-gitsha8/);
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
