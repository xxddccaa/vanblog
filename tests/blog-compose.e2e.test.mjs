import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const projectName = `vanblog-e2e-${Date.now().toString(36)}`;
const tempRoot = path.join(repoRoot, 'tests', '.tmp', projectName);
const dockerComposeCommand = detectDockerComposeCommand();

function detectDockerComposeCommand() {
  const plugin = spawnSync('docker', ['compose', 'version'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (!plugin.error && (plugin.status ?? 1) === 0) {
    return { command: 'docker', baseArgs: ['compose'] };
  }

  const legacy = spawnSync('docker-compose', ['version'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (!legacy.error && (legacy.status ?? 1) === 0) {
    return { command: 'docker-compose', baseArgs: [] };
  }

  throw new Error('Neither docker-compose nor docker compose is available in PATH');
}

function runCommand(args, options = {}) {
  const composeArgs = args.includes('-p') ? args : ['-p', projectName, ...args];
  const fullArgs = [...dockerComposeCommand.baseArgs, ...composeArgs];
  const result = spawnSync(dockerComposeCommand.command, fullArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: options.env,
    timeout: options.timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });

  if ((result.status ?? 1) !== 0 && !options.allowFailure) {
    const command = [dockerComposeCommand.command, ...fullArgs].join(' ');
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    const reason = result.error ? `\n${result.error.message}` : '';
    throw new Error(
      `${command} failed with exit code ${result.status ?? 'unknown'}\n${details}${reason}`,
    );
  }

  return result;
}

function parseComposePsOutput(raw) {
  const text = raw.trim();
  if (!text) {
    return [];
  }

  if (text.startsWith('[')) {
    return JSON.parse(text);
  }

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a free port')));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitFor(fn, { timeoutMs, intervalMs = 2000, label }) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (lastError) {
    throw new Error(`${label} timed out: ${lastError.message}`);
  }
  throw new Error(`${label} timed out`);
}

async function fetchText(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
    });
  } catch (error) {
    throw new Error(`Request failed for ${url}: ${error.message}`);
  }
  return {
    status: response.status,
    text: await response.text(),
    headers: response.headers,
  };
}

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(`Request failed for ${url}: ${error.message}`);
  }

  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${url}: ${raw.slice(0, 500)}`);
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}

function ensureFileExists(filePath, message) {
  assert.ok(fs.existsSync(filePath), message);
}

function extractAdminAssetUrls(html) {
  return [...html.matchAll(/(?:href|src)="(\/admin\/[^"]+\.(?:css|js))"/g)].map((match) => match[1]);
}

function createComposeEnv(httpPort, httpsPort) {
  fs.mkdirSync(tempRoot, { recursive: true });

  const dirs = {
    VANBLOG_LOG_DIR: path.join(tempRoot, 'log'),
    VANBLOG_STATIC_DIR: path.join(tempRoot, 'static'),
    VANBLOG_POSTGRES_DIR: path.join(tempRoot, 'postgres'),
    VANBLOG_REDIS_DIR: path.join(tempRoot, 'redis'),
    VANBLOG_CADDY_CONFIG_DIR: path.join(tempRoot, 'caddy-config'),
    VANBLOG_CADDY_DATA_DIR: path.join(tempRoot, 'caddy-data'),
    VANBLOG_ALIYUNPAN_CONFIG_DIR: path.join(tempRoot, 'aliyunpan-config'),
  };

  Object.values(dirs).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

  return {
    ...process.env,
    COMPOSE_PROJECT_NAME: projectName,
    VANBLOG_HTTP_PORT: String(httpPort),
    VANBLOG_HTTPS_PORT: String(httpsPort),
    EMAIL: 'test@example.com',
    ...dirs,
  };
}

async function encryptForFrontend(username, password) {
  const lower = username.toLowerCase();
  const sha256 = (input) => createHash('sha256').update(input).digest('hex');
  return sha256(lower + sha256(sha256(sha256(sha256(password))) + sha256(lower)));
}

async function waitForHealthyStack(composeEnv) {
  await waitFor(async () => {
    const result = runCommand(['-f', 'docker-compose.yml', 'ps', '--format', 'json'], {
      env: composeEnv,
      allowFailure: true,
    });
    if ((result.status ?? 1) !== 0 || !result.stdout.trim()) {
      return false;
    }

    const services = parseComposePsOutput(result.stdout);
    const byService = Object.fromEntries(services.map((service) => [service.Service, service]));
    const requiredHealthy = ['postgres', 'redis', 'server', 'website', 'admin', 'waline'];
    if (!requiredHealthy.every((name) => byService[name]?.Health === 'healthy')) {
      return false;
    }
    return byService.caddy?.State === 'running';
  }, {
    timeoutMs: 8 * 60 * 1000,
    intervalMs: 5000,
    label: 'compose stack health check',
  });
}

async function waitForHtml(baseUrl, pathname, expectedText) {
  await waitFor(async () => {
    const response = await fetchText(`${baseUrl}${pathname}`);
    if (response.status !== 200) {
      return false;
    }
    return response.text.includes(expectedText);
  }, {
    timeoutMs: 90 * 1000,
    intervalMs: 3000,
    label: `page ${pathname} to contain ${expectedText}`,
  });
}

test('split stack supports init, login, draft publish, and frontend browsing', { timeout: 15 * 60 * 1000 }, async () => {
  ensureFileExists(
    path.join(repoRoot, 'packages', 'website', '.next', 'standalone', 'packages', 'website', 'server.js'),
    'Missing website standalone build output. Run `pnpm build:website` before this test.',
  );
  ensureFileExists(
    path.join(repoRoot, 'packages', 'website', '.next', 'static'),
    'Missing website static build output. Run `pnpm build:website` before this test.',
  );
  ensureFileExists(
    path.join(repoRoot, 'packages', 'admin', 'dist', 'index.html'),
    'Missing admin build output. Run `pnpm build:admin` before this test.',
  );

  const [httpPort, httpsPort] = await Promise.all([getFreePort(), getFreePort()]);
  const composeEnv = createComposeEnv(httpPort, httpsPort);
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  // Keep one ref'ed timer alive so Node's test runner does not tear down the event loop
  // while the compose stack is still starting or fetch retries are pending.
  const keepAlive = setInterval(() => {}, 1000);
  const articlePathname = `flow-${Date.now().toString(36)}`;
  const articleTitle = `Compose flow ${articlePathname}`;
  const draftContent = `This article proves the split compose stack works for ${articlePathname}.`;
  const publishedBody = 'The body should appear on the frontend page after publish.';
  const username = 'admin';
  const password = 'VanBlogTest123!';
  const encryptedPassword = await encryptForFrontend(username, password);

  try {
    runCommand(['-f', 'docker-compose.yml', 'up', '-d', '--build'], {
      env: composeEnv,
      timeoutMs: 12 * 60 * 1000,
    });

    await waitForHealthyStack(composeEnv);

    const swagger = await waitFor(async () => {
      try {
        const response = await fetchText(`${baseUrl}/swagger`);
        return response.status === 200 ? response : false;
      } catch {
        return false;
      }
    }, {
      timeoutMs: 90 * 1000,
      intervalMs: 3000,
      label: 'swagger ui to be reachable',
    });
    assert.match(swagger.text, /Swagger UI/i);

    const walineAdmin = await waitFor(async () => {
      try {
        const response = await fetchText(`${baseUrl}/api/ui/`);
        return response.status === 200 ? response : false;
      } catch {
        return false;
      }
    }, {
      timeoutMs: 90 * 1000,
      intervalMs: 3000,
      label: 'waline admin to be reachable',
    });
    assert.match(walineAdmin.text, /Waline Management System/i);

    const adminRedirect = await fetchText(`${baseUrl}/admin`, {
      redirect: 'manual',
    });
    assert.equal(adminRedirect.status, 308);
    assert.equal(adminRedirect.headers.get('location'), '/admin/');

    const adminHome = await fetchText(`${baseUrl}/admin/`);
    assert.equal(adminHome.status, 200);
    assert.match(adminHome.text, /VanBlog|<html/i);
    assert.match(adminHome.text, /href="\/admin\/umi\.[^"]+\.css"/);
    assert.match(adminHome.text, /src="\/admin\/umi\.[^"]+\.js"/);
    const adminAssetUrls = extractAdminAssetUrls(adminHome.text);
    assert.ok(adminAssetUrls.length >= 2, 'Admin HTML should reference built CSS/JS assets');
    for (const assetUrl of adminAssetUrls) {
      const assetResponse = await fetchText(`${baseUrl}${assetUrl}`);
      assert.equal(assetResponse.status, 200, `Expected ${assetUrl} to be served by Caddy`);
    }

    const adminLogin = await waitFor(async () => {
      try {
        const response = await fetchText(`${baseUrl}/admin/user/login`, {
          redirect: 'manual',
        });
        if (response.status === 200) {
          return response;
        }
        const location = response.headers.get('location');
        if (!location) {
          return false;
        }
        const redirected = await fetchText(new URL(location, baseUrl).toString());
        return redirected.status === 200 ? redirected : false;
      } catch {
        return false;
      }
    }, {
      timeoutMs: 60 * 1000,
      intervalMs: 2000,
      label: 'admin login page to be reachable',
    });
    assert.match(adminLogin.text, /<div id="root"><\/div>/);

    const adminRestore = await waitFor(async () => {
      try {
        const response = await fetchText(`${baseUrl}/admin/user/restore`, {
          redirect: 'manual',
        });
        if (response.status === 200) {
          return response;
        }
        const location = response.headers.get('location');
        if (!location) {
          return false;
        }
        const redirected = await fetchText(new URL(location, baseUrl).toString());
        return redirected.status === 200 ? redirected : false;
      } catch {
        return false;
      }
    }, {
      timeoutMs: 60 * 1000,
      intervalMs: 2000,
      label: 'admin restore page to be reachable',
    });
    assert.match(adminRestore.text, /<div id="root"><\/div>/);

    for (const pathname of ['/admin/logo.svg', '/admin/background.svg']) {
      const response = await fetchText(`${baseUrl}${pathname}`);
      assert.equal(response.status, 200, `Expected ${pathname} to be reachable`);
    }

    const initResponse = await fetchJson(`${baseUrl}/api/admin/init`, {
      method: 'POST',
      body: JSON.stringify({
        user: {
          username,
          password: encryptedPassword,
          nickname: 'Test Admin',
        },
        siteInfo: {
          author: 'Test Admin',
          authorDesc: 'Automated compose test author',
          authorLogo: `${baseUrl}/static/img/author.png`,
          favicon: `${baseUrl}/static/img/favicon.png`,
          siteName: 'Compose Test Blog',
          siteDesc: 'A blog initialized by automated tests',
          baseUrl,
          showAdminButton: 'true',
          showDonateInfo: 'false',
          showCopyRight: 'true',
          showDonateButton: 'false',
          showDonateInAbout: 'false',
          allowOpenHiddenPostByUrl: 'false',
          defaultTheme: 'light',
          enableCustomizing: 'true',
          showRSS: 'true',
          openArticleLinksInNewWindow: 'false',
          enableComment: 'false',
          showSubMenu: 'false',
          homePageSize: 5,
        },
      }),
    });
    assert.equal(initResponse.status, 201);
    assert.equal(initResponse.body?.statusCode, 200);

    const loginResponse = await fetchJson(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password: encryptedPassword }),
    });
    assert.equal(loginResponse.status, 201);
    assert.equal(loginResponse.body?.statusCode, 200);
    const token = loginResponse.body?.data?.token;
    assert.ok(token, 'Login should return a token');

    const authHeaders = { token };

    const createDraftResponse = await fetchJson(`${baseUrl}/api/admin/draft`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: articleTitle,
        content: `${draftContent}\n\n<!-- more -->\n\n${publishedBody}`,
        category: 'Testing',
        tags: ['compose', 'e2e'],
      }),
    });
    assert.equal(createDraftResponse.status, 201);
    assert.equal(createDraftResponse.body?.statusCode, 200);
    const draftId = createDraftResponse.body?.data?.id;
    assert.ok(Number.isInteger(draftId), 'Draft creation should return a numeric id');

    const storedDraftResponse = await fetchJson(`${baseUrl}/api/admin/draft/${draftId}`, {
      headers: authHeaders,
    });
    assert.equal(storedDraftResponse.status, 200);
    assert.equal(storedDraftResponse.body?.data?.title, articleTitle);
    assert.match(storedDraftResponse.body?.data?.content || '', /split compose stack works/);

    const publicBeforePublish = await fetchJson(`${baseUrl}/api/public/article?page=1&pageSize=10&toListView=true`);
    assert.equal(publicBeforePublish.status, 200);
    assert.equal(
      publicBeforePublish.body?.data?.articles?.some((article) => article.title === articleTitle),
      false,
      'Drafts must not leak into the public article list before publish',
    );

    const publishResponse = await fetchJson(`${baseUrl}/api/admin/draft/publish?id=${draftId}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pathname: articlePathname, hidden: false, private: false }),
    });
    assert.equal(publishResponse.status, 201);
    assert.equal(publishResponse.body?.statusCode, 200);
    const articleId = publishResponse.body?.data?.id;
    assert.ok(Number.isInteger(articleId), 'Publishing should create a numeric article id');

    await waitFor(async () => {
      const response = await fetchJson(`${baseUrl}/api/public/article/${articlePathname}`);
      if (response.status !== 200 || response.body?.statusCode !== 200) {
        return false;
      }
      return response.body?.data?.article?.title === articleTitle;
    }, {
      timeoutMs: 60 * 1000,
      intervalMs: 2000,
      label: 'public article API to expose the published article',
    });

    const publicArticle = await fetchJson(`${baseUrl}/api/public/article/${articlePathname}`);
    assert.equal(publicArticle.status, 200);
    assert.equal(publicArticle.body?.data?.article?.title, articleTitle);
    assert.equal(publicArticle.body?.data?.article?.pathname, articlePathname);
    assert.match(publicArticle.body?.data?.article?.content || '', /frontend page after publish/);
    const publishedCreatedAt = new Date(publicArticle.body?.data?.article?.createdAt || Date.now());
    const archiveYear = String(publishedCreatedAt.getFullYear());
    const archiveMonth = String(publishedCreatedAt.getMonth() + 1).padStart(2, '0');

    const engagementResponse = await fetchJson(`${baseUrl}/api/public/article/${articlePathname}/engagement`);
    assert.equal(engagementResponse.status, 200);
    assert.equal(engagementResponse.body?.statusCode, 200);
    assert.equal(engagementResponse.body?.data?.commentCount, 0);

    const publicList = await fetchJson(`${baseUrl}/api/public/article?page=1&pageSize=10&toListView=true`);
    assert.equal(publicList.status, 200);
    assert.equal(
      publicList.body?.data?.articles?.some((article) => article.pathname === articlePathname),
      true,
      'Published article should appear in the public article list',
    );

    const viewerWithoutReferer = await fetchJson(`${baseUrl}/api/public/viewer`, {
      method: 'POST',
    });
    assert.equal(viewerWithoutReferer.status, 201);
    assert.equal(viewerWithoutReferer.body?.statusCode, 200);

    const viewerWithBadReferer = await fetchJson(`${baseUrl}/api/public/viewer`, {
      method: 'POST',
      headers: {
        referer: 'not-a-valid-url',
      },
    });
    assert.equal(viewerWithBadReferer.status, 201);
    assert.equal(viewerWithBadReferer.body?.statusCode, 200);

    await waitForHtml(baseUrl, '/', articleTitle);
    await waitForHtml(baseUrl, '/tag', 'compose');
    await waitForHtml(baseUrl, '/tag/compose', '查看年份目录');
    await waitForHtml(baseUrl, `/tag/compose/archive/${archiveYear}/${archiveMonth}`, articleTitle);
    await waitForHtml(baseUrl, '/category', '分类');
    await waitForHtml(baseUrl, '/category/Testing', '查看年份目录');
    await waitForHtml(baseUrl, `/category/Testing/archive/${archiveYear}/${archiveMonth}`, articleTitle);
    await waitForHtml(baseUrl, `/post/${articlePathname}`, articleTitle);
    await waitForHtml(baseUrl, `/post/${articlePathname}`, draftContent);
    await waitForHtml(baseUrl, `/post/${articlePathname}`, publishedBody);

    const psResult = runCommand(['-f', 'docker-compose.yml', 'ps', '--format', 'json'], {
      env: composeEnv,
    });
    const services = parseComposePsOutput(psResult.stdout);
    const postgresService = services.find((service) => service.Service === 'postgres');
    assert.ok(postgresService, 'PostgreSQL service should exist in the compose stack');
    assert.equal(
      postgresService.Publishers?.every((publisher) => publisher.PublishedPort === 0),
      true,
      'PostgreSQL should stay internal-only and must not publish a host port',
    );

    const redisService = services.find((service) => service.Service === 'redis');
    assert.ok(redisService, 'Redis service should exist in the compose stack');
    assert.equal(
      redisService.Publishers?.every((publisher) => publisher.PublishedPort === 0),
      true,
      'Redis should stay internal-only and must not publish a host port',
    );

    const caddyService = services.find((service) => service.Service === 'caddy');
    assert.ok(caddyService, 'Caddy service should exist in the compose stack');
    assert.equal(
      caddyService.Publishers?.some(
        (publisher) => publisher.TargetPort === 2019 && publisher.PublishedPort > 0,
      ),
      false,
      'Caddy admin API must stay internal-only and must not publish a host port',
    );
  } finally {
    clearInterval(keepAlive);
    runCommand(['-f', 'docker-compose.yml', 'down', '-v', '--remove-orphans'], {
      env: composeEnv,
      allowFailure: true,
      timeoutMs: 2 * 60 * 1000,
    });

    if (process.env.KEEP_BLOG_E2E !== 'true') {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
});
