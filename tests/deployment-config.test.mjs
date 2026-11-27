import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import nodePath from 'node:path';

const require = createRequire(import.meta.url);
const read = (path) => fs.readFileSync(path, 'utf8');
const exists = (path) => fs.existsSync(path);

const compose = read('docker-compose.yml');
const composeImage = read('deploy/docker-compose.image.yml');
const composeLatest = read('deploy/docker-compose.latest.yml');
const composeAllInOne = read('deploy/docker-compose.all-in-one.yml');
const composeAllInOneImage = read('deploy/docker-compose.all-in-one.image.yml');
const composeAllInOneLatest = read('deploy/docker-compose.all-in-one.latest.yml');
const composeHttps = read('deploy/docker-compose.https.yml');
const manualCompose = read('tests/manual-v1.3.0/docker-compose.yaml');

const caddyfile = read('docker/caddy/Caddyfile');
const caddyfileHttps = read('docker/caddy/Caddyfile.https');
const allInOneCaddyfile = read('docker/all-in-one/Caddyfile');
const hostDevCaddyfile = read('tests/host-dev/Caddyfile');

const serverDockerfile = read('docker/server.Dockerfile');
const serverDockerignore = read('docker/server.Dockerfile.dockerignore');
const serverEntrypoint = read('docker/server/entrypoint.sh');
const websiteDockerfile = read('docker/website.Dockerfile');
const websiteDockerignore = read('docker/website.Dockerfile.dockerignore');
const websiteEntrypoint = read('docker/website/entrypoint.sh');
const websiteControlAuth = require('../docker/website/control-auth.cjs');
const releaseImagesScript = read('scripts/release-images.sh');
const releasePublishScript = read('scripts/release-publish.sh');
const auditProductionScript = read('scripts/audit-production.mjs');
const hostDevScripts = [
  'scripts/host-dev-up.sh',
  'scripts/host-dev-env.sh',
  'scripts/host-dev-down.sh',
  'scripts/host-dev-status.sh',
  'scripts/ensure-host-dev-db.mjs',
].map((file) => [file, read(file)]);
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
const releaseEnv = read('deploy/.env.release.example');
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

const nextConfig = require('../packages/website/next.config.js');
const proxyBuildArgs = [
  'HTTP_PROXY=',
  'HTTPS_PROXY=',
  'ALL_PROXY=',
  'http_proxy=',
  'https_proxy=',
  'all_proxy=',
];

const writeExecutable = (file, content) => {
  fs.writeFileSync(file, content, { mode: 0o755 });
};

const runReleaseScript = (script, args, env) => {
  const result = spawnSync('/bin/bash', [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

  assert.equal(
    result.status,
    0,
    `${script} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
};

test('host, CI, packages, and Docker builds stay on Node 22', () => {
  assert.equal(read('.nvmrc').trim(), '22.22.2');
  assert.equal(packageJson.engines.node, '>=22 <23');
  assert.equal(JSON.parse(read('packages/admin/package.json')).engines.node, '>=22 <23');
  assert.match(read('.github/workflows/ci.yml'), /node-version: 22\.22\.2/);

  for (const path of [
    'docker/server.Dockerfile',
    'docker/website.Dockerfile',
    'docker/all-in-one.Dockerfile',
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
    'postgres:',
    'redis:',
  ]) {
    assert.match(compose, new RegExp(`^\\s{2}${service}`, 'm'));
  }
  assert.doesNotMatch(compose, /^\s{2}waline:/m);

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
    assert.match(
      file,
      /VANBLOG_SHARED_SECRET: \$\{VANBLOG_SHARED_SECRET:-\$\{WALINE_JWT_TOKEN:-\}\}/,
    );
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
  assert.doesNotMatch(allInOneCaddyfile, /8360/);
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
  assert.match(websiteEntrypoint, /su-exec vanblog:vanblog sh "\$\(readlink -f "\$0"\)"/);

  assert.match(allInOneHealthcheck, /pg_isready -h 127\.0\.0\.1/);
  assert.match(allInOneHealthcheck, /redis-cli -h 127\.0\.0\.1/);
  assert.match(allInOneHealthcheck, /http:\/\/127\.0\.0\.1:3002\/admin\//);
});

test('all-in-one image keeps dependency installation ahead of source copies', () => {
  const installIndex = allInOneDockerfile.indexOf('pnpm install --frozen-lockfile');
  const sourceCopyIndex = allInOneDockerfile.indexOf('COPY . ./');
  const buildIndex = allInOneDockerfile.indexOf('pnpm --filter @vanblog/server build');

  assert.ok(installIndex >= 0, 'all-in-one image should install frozen dependencies');
  assert.ok(sourceCopyIndex > installIndex, 'source files should be copied after dependency install');
  assert.ok(buildIndex > sourceCopyIndex, 'application builds should run after the source copy');

  const dependencySection = allInOneDockerfile.slice(0, installIndex);
  for (const manifest of [
    'package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json',
    'patches ./patches',
    'packages/server/package.json ./packages/server/',
    'packages/website/package.json ./packages/website/',
    'packages/admin/package.json ./packages/admin/',
    'packages/cli/package.json ./packages/cli/',
  ]) {
    assert.match(
      dependencySection,
      new RegExp(`COPY ${manifest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `${manifest} should be copied before dependency installation`,
    );
  }

  assert.doesNotMatch(
    dependencySection,
    /COPY \. \.\//,
    'application source should not invalidate the dependency layer',
  );
  assert.match(allInOneDockerfile, /FROM dependencies AS source\s+COPY \. \.\//);
  assert.match(allInOneDockerfile, /FROM source AS builder/);
  assert.match(
    allInOneDockerfile,
    /RUN --mount=type=cache,id=pnpm-store,target=\/root\/\.local\/share\/pnpm\/store\s+\\\s+pnpm install --frozen-lockfile/,
  );
});

test('all-in-one website build never reaches a service on the build host', () => {
  // BUILD_PROXY releases build with --network host, where localhost:3000 can be
  // an unrelated service; the default build-time server URL would hit it.
  assert.match(
    allInOneDockerfile,
    /VAN_BLOG_SERVER_URL=http:\/\/127\.0\.0\.1:1 pnpm build:website/,
  );
  assert.doesNotMatch(allInOneDockerfile, /&& pnpm build:website/);
});

test('release builds only clear proxy build args when explicitly enabled', () => {
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'vanblog-release-build-'));
  const dockerLog = nodePath.join(tempDir, 'docker.log');
  writeExecutable(
    nodePath.join(tempDir, 'docker'),
    `#!/bin/bash
printf '%s' "$1" >> "$DOCKER_LOG"
for arg in "\${@:2}"; do
  printf '\\t%s' "$arg" >> "$DOCKER_LOG"
done
printf '\\n' >> "$DOCKER_LOG"
`,
  );

  const variants = [
    {
      script: 'scripts/release-images.sh',
      clear: true,
      push: false,
      expectedCalls: 4,
      commandPrefix: 'build\t',
    },
    {
      script: 'scripts/release-images.sh',
      clear: false,
      push: true,
      expectedCalls: 4,
      commandPrefix: 'buildx\tbuild\t',
    },
    {
      script: 'scripts/release-all-in-one.sh',
      clear: false,
      push: false,
      expectedCalls: 1,
      commandPrefix: 'build\t',
    },
    {
      script: 'scripts/release-all-in-one.sh',
      clear: true,
      push: true,
      expectedCalls: 1,
      commandPrefix: 'buildx\tbuild\t',
    },
  ];

  try {
    for (const variant of variants) {
      fs.writeFileSync(dockerLog, '');
      runReleaseScript(
        variant.script,
        [
          '--version',
          'v9.9.9',
          '--image-id',
          'deadbeef',
          '--repo',
          'example/vanblog',
          '--skip-tests',
          '--skip-builds',
          ...(variant.push ? ['--push'] : []),
        ],
        {
          PATH: `${tempDir}:${process.env.PATH}`,
          DOCKER_LOG: dockerLog,
          CLEAR_BUILD_PROXIES: String(variant.clear),
        },
      );

      const calls = read(dockerLog).trim().split('\n');
      assert.equal(calls.length, variant.expectedCalls);
      for (const call of calls) {
        assert.ok(call.startsWith(variant.commandPrefix), call);
        for (const proxyArg of proxyBuildArgs) {
          const expected = `\t--build-arg\t${proxyArg}`;
          if (variant.clear) {
            assert.ok(call.includes(expected), `${call} should include ${proxyArg}`);
          } else {
            assert.ok(!call.includes(expected), `${call} should not include ${proxyArg}`);
          }
        }
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('release builds can route through a host proxy with host networking', () => {
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'vanblog-release-proxy-'));
  const dockerLog = nodePath.join(tempDir, 'docker.log');
  writeExecutable(
    nodePath.join(tempDir, 'docker'),
    `#!/bin/bash
printf '%s' "$1" >> "$DOCKER_LOG"
for arg in "\${@:2}"; do
  printf '\\t%s' "$arg" >> "$DOCKER_LOG"
done
printf '\\n' >> "$DOCKER_LOG"
`,
  );
  const proxy = 'http://127.0.0.1:10826';
  const args = [
    '--version',
    'v9.9.9',
    '--image-id',
    'deadbeef',
    '--repo',
    'example/vanblog',
    '--skip-tests',
    '--skip-builds',
    '--push',
  ];

  try {
    for (const [script, expectedCalls] of [
      ['scripts/release-images.sh', 4],
      ['scripts/release-all-in-one.sh', 1],
    ]) {
      fs.writeFileSync(dockerLog, '');
      runReleaseScript(script, args, {
        PATH: `${tempDir}:${process.env.PATH}`,
        DOCKER_LOG: dockerLog,
        BUILD_PROXY: proxy,
        CLEAR_BUILD_PROXIES: 'false',
      });
      const calls = read(dockerLog).trim().split('\n');
      assert.equal(calls.length, expectedCalls);
      for (const call of calls) {
        assert.ok(call.includes('\t--network\thost'), call);
        for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) {
          assert.ok(call.includes(`\t--build-arg\t${name}=${proxy}`), `${call} should set ${name}`);
        }
        assert.ok(call.includes('\t--build-arg\tNO_PROXY=localhost,127.0.0.1'), call);
      }

      // Using the host proxy and clearing proxies at the same time is a mistake.
      const conflict = spawnSync('/bin/bash', [script, ...args], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${tempDir}:${process.env.PATH}`,
          DOCKER_LOG: dockerLog,
          BUILD_PROXY: proxy,
          CLEAR_BUILD_PROXIES: 'true',
        },
      });
      assert.notEqual(conflict.status, 0, `${script} should reject BUILD_PROXY with CLEAR_BUILD_PROXIES`);
      assert.match(conflict.stderr, /cannot be used together/);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  assert.match(releaseDoc, /BUILD_PROXY=http:\/\/127\.0\.0\.1:10826 pnpm release:publish --version vX\.Y\.Z/);
  assert.match(
    releaseDoc,
    /BUILD_PROXY=http:\/\/127\.0\.0\.1:10826 pnpm release:all-in-one:publish --version vX\.Y\.Z/,
  );
});

test('publish wrappers preserve the proxy-clearing environment for build scripts', () => {
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'vanblog-release-publish-'));
  const wrapperLog = nodePath.join(tempDir, 'wrapper.log');
  writeExecutable(
    nodePath.join(tempDir, 'bash'),
    `#!/bin/bash
printf '%s\\t%s\\n' "\${CLEAR_BUILD_PROXIES-unset}" "$*" >> "$WRAPPER_LOG"
`,
  );
  writeExecutable(
    nodePath.join(tempDir, 'docker'),
    `#!/bin/bash
if [[ "$1" == "image" && "$2" == "inspect" ]]; then
  if [[ "$*" == *org.opencontainers.image.version* ]]; then
    printf 'v9.9.9\\n'
  elif [[ "$*" == *io.vanblog.image.id* ]]; then
    printf 'deadbeef\\n'
  fi
fi
`,
  );

  try {
    for (const [wrapper, child] of [
      ['scripts/release-publish.sh', 'scripts/release-images.sh'],
      ['scripts/release-all-in-one-publish.sh', 'scripts/release-all-in-one.sh'],
    ]) {
      fs.writeFileSync(wrapperLog, '');
      runReleaseScript(
        wrapper,
        [
          '--version',
          'v9.9.9',
          '--image-id',
          'deadbeef',
          '--repo',
          'example/vanblog',
          '--skip-tests',
          '--skip-builds',
        ],
        {
          PATH: `${tempDir}:${process.env.PATH}`,
          WRAPPER_LOG: wrapperLog,
          CLEAR_BUILD_PROXIES: 'true',
        },
      );

      const invocation = read(wrapperLog).trim();
      assert.match(invocation, /^true\t/);
      assert.ok(invocation.includes(child), invocation);
      assert.ok(invocation.includes('--push'), invocation);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  assert.match(releaseDoc, /CLEAR_BUILD_PROXIES=true/);
  assert.match(releaseDoc, /ALPINE_MIRROR_HOST=mirrors\.aliyun\.com/);
  assert.match(releaseDoc, /pnpm release:publish --version vX\.Y\.Z/);
  assert.match(releaseDoc, /pnpm release:all-in-one:publish --version vX\.Y\.Z/);
  assert.doesNotMatch(releaseDoc, /pnpm release:[^\n]+ -- --version/);
});

test('every Alpine apk stage honors ALPINE_MIRROR_HOST so proxy-cleared release builds cannot stall', () => {
  // Release builds run with CLEAR_BUILD_PROXIES=true, so a stage that still pulls from
  // dl-cdn.alpinelinux.org has no proxy and can hang for an hour (v1.9.0 server runner).
  const mirrorSwitch =
    /^RUN if \[ -n "\$ALPINE_MIRROR_HOST" \]; then sed -i "s\/dl-cdn\.alpinelinux\.org\/\$\{ALPINE_MIRROR_HOST\}\/g" \/etc\/apk\/repositories; fi\s+&& apk add /;
  const checkedStages = [];

  for (const name of fs.readdirSync('docker').filter((file) => file.endsWith('.Dockerfile'))) {
    const stages = read(nodePath.join('docker', name)).split(/^FROM\s+/m).slice(1);
    for (const stage of stages) {
      const stageName = stage.match(/^\S+(?:\s+AS\s+(\S+))?/i)?.[1] ?? 'final';
      const label = `${name} ${stageName}`;
      const instructions = stage.replace(/\\\n\s*/g, ' ').split('\n');
      for (const instruction of instructions.filter((line) => /^RUN\b.*\bapk add\b/.test(line))) {
        assert.match(stage, /^ARG ALPINE_MIRROR_HOST=""$/m, `${label} must declare ARG ALPINE_MIRROR_HOST`);
        assert.match(instruction, mirrorSwitch, `${label} must switch the Alpine mirror before apk add`);
        checkedStages.push(label);
      }
    }
  }

  assert.ok(checkedStages.includes('server.Dockerfile base'), checkedStages.join(', '));
  assert.ok(checkedStages.includes('server.Dockerfile runner'), checkedStages.join(', '));
  assert.ok(checkedStages.includes('all-in-one.Dockerfile runner'), checkedStages.join(', '));
});

test('docker compose wires cross-container control endpoints', () => {
  assert.match(compose, /VANBLOG_CADDY_API_URL:\s+http:\/\/caddy:2019/);
  assert.match(compose, /VANBLOG_WEBSITE_CONTROL_URL:\s+http:\/\/website:3011/);
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
    // The Kroki diagram renderer was removed; no compose file may bring it back.
    assert.doesNotMatch(file, /kroki/i);
    assert.doesNotMatch(file, /localhost:8000\/health/);
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

test('split server image includes the patched production dependency graph', () => {
  assert.match(serverDockerfile, /COPY patches \.\/patches/);
  assert.match(serverDockerignore, /!patches\/\*\*/);
  assert.match(
    serverDockerfile,
    /delete manifest\.pnpm\?\.patchedDependencies;[\s\S]*pnpm deploy --legacy/,
  );
});

test('Caddy only exposes blog, admin, and api routes', () => {
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
  }
  assert.match(allInOneCaddyfile, /reverse_proxy 127\.0\.0\.1:3001/);
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
    ['deploy/.env.release.example', releaseEnv],
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
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.match(releaseEnv, /VANBLOG_DOCKER_REPO=kevinchina\/deeplearning/);
  assert.equal(
    releaseEnv.match(/^VANBLOG_RELEASE_SUFFIX=(.+)$/m)?.[1],
    `v${packageJson.version}-replace-with-gitsha8`,
  );
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

test('split services bypass injected proxies for internal traffic', () => {
  const internalServices = 'localhost,127.0.0.1,server,website,admin,postgres,redis';
  for (const [file, minimumMatches] of [
    [compose, 1],
    [composeImage, 3],
    [composeLatest, 3],
  ]) {
    const upperMatches = file.match(new RegExp(`NO_PROXY: ${internalServices}`, 'g')) || [];
    const lowerMatches = file.match(new RegExp(`no_proxy: ${internalServices}`, 'g')) || [];
    assert.ok(upperMatches.length >= minimumMatches);
    assert.ok(lowerMatches.length >= minimumMatches);
  }
});

test('compose healthchecks bypass injected HTTP proxies', () => {
  // All-in-one files use the in-image healthcheck script and have no wget
  // healthcheck of their own; the split files must have at least one.
  for (const [file, minimumHealthchecks] of [
    [compose, 1],
    [composeImage, 1],
    [composeLatest, 1],
    [composeAllInOne, 0],
    [composeAllInOneImage, 0],
    [composeAllInOneLatest, 0],
  ]) {
    const localhostHealthchecks = file.match(/wget[^\n]+(?:127\.0\.0\.1|localhost)[^\n]+/g) || [];
    assert.ok(localhostHealthchecks.length >= minimumHealthchecks);
    for (const healthcheck of localhostHealthchecks) {
      assert.match(healthcheck, /(?:wget -Y off |wget['"], ['"]-Y['"], ['"]off['"])/);
    }
  }
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

test('caddy access logs never record admin credentials', () => {
  for (const file of [caddyfile, caddyfileHttps, allInOneCaddyfile]) {
    assert.doesNotMatch(file, /^\s*format json\s*$/m);
    assert.match(file, /format filter \{/);
    assert.match(file, /request>headers>Token delete/);
    assert.match(file, /request>headers>X-Debug-Super-Token delete/);
    assert.match(file, /request>uri query \{\s*delete token\s*\}/);
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
  assert.match(releaseEnv, /REDIS_LOGLEVEL/);
});


const allComposeFiles = [
  ['docker-compose.yml', compose],
  ['deploy/docker-compose.image.yml', composeImage],
  ['deploy/docker-compose.latest.yml', composeLatest],
  ['deploy/docker-compose.all-in-one.yml', composeAllInOne],
  ['deploy/docker-compose.all-in-one.image.yml', composeAllInOneImage],
  ['deploy/docker-compose.all-in-one.latest.yml', composeAllInOneLatest],
  ['deploy/docker-compose.https.yml', composeHttps],
];

const allCaddyConfigs = [
  ['docker/caddy/Caddyfile', caddyfile],
  ['docker/caddy/Caddyfile.https', caddyfileHttps],
  ['docker/all-in-one/Caddyfile', allInOneCaddyfile],
  ['tests/host-dev/Caddyfile', hostDevCaddyfile],
];

// The only Waline name allowed to survive is the legacy fallback of the shared secret.
const withoutLegacySecretFallback = (content) =>
  content.replace(/\$\{WALINE_JWT_TOKEN:-[^}]*\}/g, '');

const readReleaseServices = (script) => {
  const match = script.match(/^SERVICES=\(([^)]*)\)$/m);
  assert.ok(match, 'release script should declare SERVICES');
  return match[1].trim().split(/\s+/);
};

test('no compose file defines a Waline service or Waline env', () => {
  for (const [label, content] of allComposeFiles) {
    assert.doesNotMatch(content, /^\s{2}waline:/m, `${label} should not define a waline service`);
    assert.doesNotMatch(content, /VAN_BLOG_WALINE_|VANBLOG_WALINE_|WALINE_CONTROL_/, label);
    assert.doesNotMatch(content, /\b(?:8360|8361)\b/, label);
    assert.doesNotMatch(withoutLegacySecretFallback(content), /waline/i, label);
  }
});

test('no Caddy config routes to Waline any more', () => {
  for (const [label, content] of allCaddyConfigs) {
    assert.doesNotMatch(content, /8360|8361/, `${label} should not proxy to Waline`);
    assert.doesNotMatch(content, /waline/i, label);
    assert.doesNotMatch(
      content,
      /handle \/(?:api\/)?(?:ui|user|token|db|comment|oauth)\*?\s*\{/,
      label,
    );
    assert.doesNotMatch(content, /"\/(?:api\/)?(?:ui|user|token|db|comment|oauth)\*?"/, label);
  }
  // /api/comment* and friends now fall through to the server, everything else to the website.
  assert.match(caddyfile, /handle \/api\/\* \{\s*reverse_proxy server:3000/);
  assert.match(caddyfileHttps, /handle \/api\/\* \{\s*reverse_proxy server:3000/);
  assert.match(allInOneCaddyfile, /handle \/api\/\* \{\s*reverse_proxy 127\.0\.0\.1:3000/);
});

test('Waline images, package, patch, and scripts are removed', () => {
  for (const path of [
    'docker/waline.Dockerfile',
    'docker/waline.Dockerfile.dockerignore',
    'docker/waline',
    'docker/shared/ensure-waline-jwt.cjs',
    'packages/waline',
    'patches/@waline__vercel@1.41.4.patch',
    'scripts/fix-waline-adapter.js',
    'scripts/fix-waline-dashboard.js',
    'scripts/host-waline-runner.cjs',
    'scripts/reset-waline.sh',
  ]) {
    assert.equal(exists(path), false, `${path} should be removed`);
  }
});

test('legacy single-image Dockerfiles, Caddy templates, and upstream scripts are removed', () => {
  for (const path of [
    'Dockerfile',
    'entrypoint.sh',
    'CaddyfileTemplate',
    'CaddyfileTemplateLocal',
    'caddyTemplate.json',
    'packages/admin/Dockerfile',
    'packages/server/Dockerfile',
    'packages/website/Dockerfile',
    'scripts/start.js',
    'scripts/docker.sh',
    'scripts/vanblog.sh',
    'scripts/dev.js',
    'scripts/check.js',
    'scripts/kill-all.sh',
    'scripts/releaseDoc.js',
    'scripts/releaseNote.js',
    'scripts/sync-aliyuncs.sh',
    'scripts/webhook.js',
    '.dockerignore',
    'packages/admin/.dockerignore',
    'packages/server/.dockerignore',
    'packages/website/.dockerignore',
    '.eslintignore',
    '.node-version',
    '.versionrc.js',
    'tsconfig.base.json',
    'docker-compose.image.yml',
    'docker-compose.latest.yml',
    'docker-compose.https.yml',
    'docker-compose.all-in-one.yml',
    'docker-compose.all-in-one.image.yml',
    'docker-compose.all-in-one.latest.yml',
    '.env.release.example',
  ]) {
    assert.equal(exists(path), false, `${path} should be removed`);
  }
});

test('remaining runtime configs do not reference Waline', () => {
  assert.deepEqual(Object.keys(packageJson.pnpm.patchedDependencies), ['headroom.js@0.12.0']);
  for (const [label, content] of [
    ['docker/all-in-one.Dockerfile', allInOneDockerfile],
    ['docker/all-in-one/entrypoint.sh', allInOneEntrypoint],
    ['docker/all-in-one/healthcheck.sh', allInOneHealthcheck],
    ['docker/server.Dockerfile', serverDockerfile],
    ['docker/server.Dockerfile.dockerignore', serverDockerignore],
    ['docker/website.Dockerfile', websiteDockerfile],
    ['docker/website.Dockerfile.dockerignore', websiteDockerignore],
    ['scripts/audit-production.mjs', auditProductionScript],
    ['scripts/release-images.sh', releaseImagesScript],
    ['scripts/release-publish.sh', releasePublishScript],
    ['.prettierignore', read('.prettierignore')],
  ]) {
    assert.doesNotMatch(content, /waline|8360|8361/i, `${label} should not reference Waline`);
  }
  for (const [label, content] of hostDevScripts) {
    // host-dev still reads the pre-rename WALINE_JWT_TOKEN as a fallback.
    assert.doesNotMatch(content.replace(/\bWALINE_JWT_TOKEN\b/g, ''), /waline|8360|8361/i, label);
  }
});

test('all-in-one entrypoint no longer starts Waline or creates its database', () => {
  assert.doesNotMatch(allInOneEntrypoint, /waline_pid|WALINE_DB|PG_HOST|PG_DB|PG_PASSWORD/);
  assert.match(allInOneEntrypoint, /ensure_postgres_database "\$\{POSTGRES_DB\}"/);
  assert.equal(allInOneEntrypoint.match(/^ensure_postgres_database /gm)?.length, 1);
  assert.doesNotMatch(allInOneEntrypoint, /DROP DATABASE/i);
  const waitBlock = allInOneEntrypoint.slice(allInOneEntrypoint.lastIndexOf('wait -n'));
  for (const pid of [
    'postgres_pid',
    'redis_pid',
    'server_pid',
    'website_pid',
    'admin_pid',
    'caddy_pid',
  ]) {
    assert.match(waitBlock, new RegExp(`\\$\\{${pid}\\}`), `wait -n should watch ${pid}`);
  }
});

test('release scripts publish exactly the four core images', () => {
  for (const script of [releaseImagesScript, releasePublishScript]) {
    assert.deepEqual(readReleaseServices(script), ['caddy', 'server', 'website', 'admin']);
  }
  assert.match(releaseImagesScript, /"\$service" =~ \^\(server\|website\)\$/);
  for (const service of readReleaseServices(releaseImagesScript)) {
    assert.ok(exists(`docker/${service}.Dockerfile`), `docker/${service}.Dockerfile should exist`);
  }
});

test('cwebp stays installed in the server and all-in-one runtime images', () => {
  const runnerStage = (dockerfile) => dockerfile.slice(dockerfile.lastIndexOf('AS runner'));
  for (const [label, dockerfile] of [
    ['docker/server.Dockerfile', serverDockerfile],
    ['docker/all-in-one.Dockerfile', allInOneDockerfile],
  ]) {
    assert.match(runnerStage(dockerfile), /apk add[^\n]*\blibwebp-tools\b/, label);
  }
});

test('the shared secret is wired as VANBLOG_SHARED_SECRET with the legacy fallback', () => {
  for (const [label, content] of [
    ['docker-compose.yml', compose],
    ['deploy/docker-compose.image.yml', composeImage],
  ]) {
    assert.equal(
      content.match(
        /VANBLOG_SHARED_SECRET: \$\{VANBLOG_SHARED_SECRET:-\$\{WALINE_JWT_TOKEN:-[^}]*\}\}/g,
      )?.length,
      2,
      `${label} should pass the shared secret to server and website`,
    );
  }
  // The split dev stack keeps its old website default so an unchanged .env resolves the same.
  assert.match(
    compose,
    /VANBLOG_SHARED_SECRET: \$\{VANBLOG_SHARED_SECRET:-\$\{WALINE_JWT_TOKEN:-vanblog-change-me\}\}/,
  );
  // latest.yml never read WALINE_JWT_TOKEN from .env; it keeps relying on the persisted file.
  assert.equal(composeLatest.match(/VANBLOG_SHARED_SECRET: ""/g)?.length, 2);
  for (const content of [compose, composeImage, composeLatest]) {
    assert.doesNotMatch(content, /^\s+WALINE_JWT_TOKEN:/m);
  }

  for (const entrypoint of [serverEntrypoint, websiteEntrypoint]) {
    assert.match(
      entrypoint,
      /node \/app\/ensure-shared-secret\.cjs VANBLOG_SHARED_SECRET WALINE_JWT_TOKEN\)"/,
    );
    assert.match(entrypoint, /export VANBLOG_SHARED_SECRET="\$\{SHARED_SECRET\}"/);
  }
  // The backup key keeps its path and generator, and never adopts the legacy shared secret.
  assert.match(
    serverEntrypoint,
    /VANBLOG_SHARED_SECRET_FILE="\$\{VANBLOG_BACKUP_ENCRYPTION_KEY_FILE:-\/run\/secrets\/vanblog\/backup-encryption\.key\}" \\\s+VANBLOG_SHARED_SECRET_LEGACY_FILE="" \\\s+node \/app\/ensure-shared-secret\.cjs VANBLOG_BACKUP_ENCRYPTION_KEY/,
  );

  for (const [label, content] of [
    ['docker/server.Dockerfile', serverDockerfile],
    ['docker/website.Dockerfile', websiteDockerfile],
    ['docker/all-in-one.Dockerfile', allInOneDockerfile],
  ]) {
    assert.match(
      content,
      /COPY docker\/shared\/ensure-shared-secret\.cjs \/app\/ensure-shared-secret\.cjs/,
      label,
    );
  }
  for (const ignore of [serverDockerignore, websiteDockerignore]) {
    assert.match(ignore, /^!docker\/shared\/ensure-shared-secret\.cjs$/m);
  }
  assert.match(releaseEnv, /^VANBLOG_SHARED_SECRET=$/m);
  assert.doesNotMatch(releaseEnv, /^WALINE_JWT_TOKEN=/m);

  const env = {
    VANBLOG_WEBSITE_CONTROL_TOKEN: '',
    VANBLOG_ISR_TOKEN: '',
  };
  assert.equal(
    websiteControlAuth.getExpectedControlToken({
      ...env,
      VANBLOG_SHARED_SECRET: 'shared-secret',
      WALINE_JWT_TOKEN: 'legacy-secret',
    }),
    'shared-secret',
  );
  assert.equal(
    websiteControlAuth.getExpectedControlToken({ ...env, WALINE_JWT_TOKEN: 'legacy-secret' }),
    'legacy-secret',
  );
});

const runEnsureSharedSecret = (envKeys, env) => {
  const result = spawnSync(
    process.execPath,
    ['docker/shared/ensure-shared-secret.cjs', ...envKeys],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        VANBLOG_SHARED_SECRET_WAIT_MS: '2000',
        VANBLOG_SHARED_SECRET_POLL_MS: '20',
        ...env,
      },
    },
  );
  assert.equal(result.status, 0, `ensure-shared-secret failed: ${result.stderr}`);
  return result.stdout;
};

test('ensure-shared-secret keeps an upgraded deployment on its existing secret', async () => {
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'vanblog-shared-secret-'));
  const secretFile = nodePath.join(tempDir, 'vanblog-shared.secret');
  const legacyFile = nodePath.join(tempDir, 'waline.jwt');
  const legacySecret = 'a'.repeat(64);
  const keys = ['VANBLOG_SHARED_SECRET', 'WALINE_JWT_TOKEN'];
  try {
    fs.writeFileSync(legacyFile, `${legacySecret}\n`, { mode: 0o600 });
    const base = {
      VANBLOG_SHARED_SECRET_FILE: secretFile,
      VANBLOG_SHARED_SECRET_LEGACY_FILE: legacyFile,
    };

    // Missing new file + existing legacy file: adopt the legacy value, leave the legacy file alone.
    assert.equal(runEnsureSharedSecret(keys, base), legacySecret);
    assert.equal(read(secretFile).trim(), legacySecret);
    assert.equal(fs.statSync(secretFile).mode & 0o777, 0o600);
    assert.equal(read(legacyFile).trim(), legacySecret);

    // Weak placeholders never override the persisted secret.
    assert.equal(
      runEnsureSharedSecret(keys, {
        ...base,
        VANBLOG_SHARED_SECRET: '',
        WALINE_JWT_TOKEN: 'vanblog-change-me',
      }),
      legacySecret,
    );

    // The pre-rename env name still works as an explicit value, the new name wins over it.
    const legacyEnvSecret = 'b'.repeat(40);
    const newEnvSecret = 'c'.repeat(40);
    assert.equal(
      runEnsureSharedSecret(keys, { ...base, WALINE_JWT_TOKEN: legacyEnvSecret }),
      legacyEnvSecret,
    );
    assert.equal(
      runEnsureSharedSecret(keys, {
        ...base,
        VANBLOG_SHARED_SECRET: newEnvSecret,
        WALINE_JWT_TOKEN: legacyEnvSecret,
      }),
      newEnvSecret,
    );
    assert.equal(read(secretFile).trim(), newEnvSecret);

    // The pre-rename file override is still honoured.
    const legacyOverride = nodePath.join(tempDir, 'custom.jwt');
    fs.writeFileSync(legacyOverride, `${'d'.repeat(48)}\n`);
    assert.equal(
      runEnsureSharedSecret(keys, { VANBLOG_WALINE_JWT_FILE: legacyOverride }),
      'd'.repeat(48),
    );

    // Fresh install: a random secret is generated once and reused; concurrent starts agree.
    const freshFile = nodePath.join(tempDir, 'fresh', 'vanblog-shared.secret');
    const fresh = { VANBLOG_SHARED_SECRET_FILE: freshFile, VANBLOG_SHARED_SECRET_LEGACY_FILE: '' };
    const generated = await Promise.all(
      [0, 1, 2].map(
        () =>
          new Promise((resolve, reject) => {
            const child = spawn(
              process.execPath,
              ['docker/shared/ensure-shared-secret.cjs', ...keys],
              {
                cwd: process.cwd(),
                env: { PATH: process.env.PATH, ...fresh },
              },
            );
            let stdout = '';
            child.stdout.on('data', (chunk) => {
              stdout += chunk;
            });
            child.on('error', reject);
            child.on('close', (code) =>
              code === 0 ? resolve(stdout) : reject(new Error(`exit ${code}`)),
            );
          }),
      ),
    );
    assert.match(generated[0], /^[0-9a-f]{64}$/);
    assert.deepEqual(new Set(generated).size, 1);
    assert.equal(runEnsureSharedSecret(keys, fresh), generated[0]);
    assert.notEqual(generated[0], legacySecret);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ensure-shared-secret never turns the legacy shared secret into the backup key', () => {
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'vanblog-backup-key-'));
  try {
    const backupKeyFile = nodePath.join(tempDir, 'backup-encryption.key');
    const legacyFile = nodePath.join(tempDir, 'waline.jwt');
    fs.writeFileSync(legacyFile, `${'e'.repeat(64)}\n`);
    // Mirrors the server entrypoint invocation for the backup key.
    const backupKey = runEnsureSharedSecret(['VANBLOG_BACKUP_ENCRYPTION_KEY'], {
      VANBLOG_SHARED_SECRET_FILE: backupKeyFile,
      VANBLOG_SHARED_SECRET_LEGACY_FILE: '',
      WALINE_JWT_TOKEN: 'f'.repeat(64),
    });
    assert.match(backupKey, /^[0-9a-f]{64}$/);
    assert.notEqual(backupKey, 'e'.repeat(64));
    assert.notEqual(backupKey, 'f'.repeat(64));
    assert.equal(read(backupKeyFile).trim(), backupKey);
    assert.equal(
      runEnsureSharedSecret(['VANBLOG_BACKUP_ENCRYPTION_KEY'], {
        VANBLOG_SHARED_SECRET_FILE: backupKeyFile,
        VANBLOG_SHARED_SECRET_LEGACY_FILE: '',
      }),
      backupKey,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
