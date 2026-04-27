import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const projectName = `vanblog-all-in-one-${Date.now().toString(36)}`;
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
  } catch (_error) {
    throw new Error(`Failed to parse JSON from ${url}: ${raw.slice(0, 500)}`);
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}

function extractAdminAssetUrls(html) {
  return [...html.matchAll(/(?:href|src)="(\/admin\/[^\"]+\.(?:css|js))"/g)].map((match) => match[1]);
}

function createComposeEnv(httpPort) {
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
    EMAIL: 'test@example.com',
    ...dirs,
  };
}

function cleanupTempRoot() {
  if (!fs.existsSync(tempRoot)) {
    return;
  }

  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    return;
  } catch (error) {
    if (!['EACCES', 'EPERM'].includes(error?.code)) {
      throw error;
    }
  }

  const parentDir = path.dirname(tempRoot);
  const dirName = path.basename(tempRoot);
  const result = spawnSync(
    'docker',
    ['run', '--rm', '-v', `${parentDir}:/cleanup`, 'redis:7-alpine', 'sh', '-c', `rm -rf "/cleanup/${dirName}"`],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 2 * 60 * 1000,
    },
  );

  if ((result.status ?? 1) !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Failed to remove temp compose data ${tempRoot}\n${details}`);
  }
}

async function encryptForFrontend(username, password) {
  const lower = username.toLowerCase();
  const sha256 = (input) => createHash('sha256').update(input).digest('hex');
  return sha256(lower + sha256(sha256(sha256(sha256(password))) + sha256(lower)));
}

async function waitForHealthyStack(composeEnv) {
  await waitFor(async () => {
    const result = runCommand(['-f', 'docker-compose.all-in-one.yml', 'ps', '--format', 'json'], {
      env: composeEnv,
      allowFailure: true,
    });
    if ((result.status ?? 1) !== 0 || !result.stdout.trim()) {
      return false;
    }

    const services = parseComposePsOutput(result.stdout);
    const stack = services.find((service) => service.Service === 'vanblog');
    return stack?.Health === 'healthy';
  }, {
    timeoutMs: 15 * 60 * 1000,
    intervalMs: 5000,
    label: 'all-in-one stack health check',
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

test('all-in-one image supports init, login, draft publish, and frontend browsing', { timeout: 20 * 60 * 1000 }, async () => {
  const httpPort = await getFreePort();
  const composeEnv = createComposeEnv(httpPort);
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const keepAlive = setInterval(() => {}, 1000);
  const articlePathname = `aio-${Date.now().toString(36)}`;
  const articleTitle = `All-in-one flow ${articlePathname}`;
  const draftContent = `This article proves the all-in-one compose stack works for ${articlePathname}.`;
  const publishedBody = 'The all-in-one body should appear on the frontend page after publish.';
  const username = 'admin';
  const password = 'VanBlogTest123!';
  const encryptedPassword = await encryptForFrontend(username, password);

  try {
    // Force a fresh image build so Dockerfile package changes are validated instead of
    // silently reusing a cached all-in-one runtime layer from an earlier test run.
    runCommand(['-f', 'docker-compose.all-in-one.yml', 'build', '--no-cache', 'vanblog'], {
      env: composeEnv,
      timeoutMs: 20 * 60 * 1000,
    });

    runCommand(['-f', 'docker-compose.all-in-one.yml', 'up', '-d'], {
      env: composeEnv,
      timeoutMs: 20 * 60 * 1000,
    });

    await waitForHealthyStack(composeEnv);

    const swagger = await waitFor(async () => {
      try {
        const response = await fetchText(`${baseUrl}/swagger`);
        return response.status === 404 ? response : false;
      } catch {
        return false;
      }
    }, {
      timeoutMs: 90 * 1000,
      intervalMs: 3000,
      label: 'swagger ui to stay private at the public entrypoint',
    });
    assert.equal(swagger.status, 404);

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
    const adminAssetUrls = extractAdminAssetUrls(adminHome.text);
    assert.ok(adminAssetUrls.length >= 2, 'Admin HTML should reference built CSS/JS assets');
    for (const assetUrl of adminAssetUrls) {
      const assetResponse = await fetchText(`${baseUrl}${assetUrl}`);
      assert.equal(assetResponse.status, 200, `Expected ${assetUrl} to be served by Caddy`);
    }

    const initResponse = await fetchJson(`${baseUrl}/api/admin/init`, {
      method: 'POST',
      body: JSON.stringify({
        user: {
          username,
          password: encryptedPassword,
          nickname: 'All-in-one Admin',
        },
        siteInfo: {
          author: 'All-in-one Admin',
          authorDesc: 'Automated all-in-one test author',
          authorLogo: `${baseUrl}/static/img/author.png`,
          favicon: `${baseUrl}/static/img/favicon.png`,
          siteName: 'All-in-one Test Blog',
          siteDesc: 'A blog initialized by all-in-one automated tests',
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
        tags: ['all-in-one', 'e2e'],
      }),
    });
    assert.equal(createDraftResponse.status, 201);
    assert.equal(createDraftResponse.body?.statusCode, 200);
    const draftId = createDraftResponse.body?.data?.id;
    assert.ok(Number.isInteger(draftId), 'Draft creation should return a numeric id');

    const publishResponse = await fetchJson(`${baseUrl}/api/admin/draft/publish?id=${draftId}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pathname: articlePathname, hidden: false, private: false }),
    });
    assert.equal(publishResponse.status, 201);
    assert.equal(publishResponse.body?.statusCode, 200);

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

    await waitForHtml(baseUrl, '/', articleTitle);
    await waitForHtml(baseUrl, `/post/${articlePathname}`, articleTitle);
    await waitForHtml(baseUrl, `/post/${articlePathname}`, draftContent);
    await waitForHtml(baseUrl, `/post/${articlePathname}`, publishedBody);

    const psResult = runCommand(['-f', 'docker-compose.all-in-one.yml', 'ps', '--format', 'json'], {
      env: composeEnv,
    });
    const services = parseComposePsOutput(psResult.stdout);
    assert.equal(services.length, 1, 'All-in-one compose should only start one service');
    assert.equal(services[0]?.Service, 'vanblog');
    const publishers = services[0]?.Publishers || [];
    assert.equal(
      publishers.some((publisher) => publisher.TargetPort !== 80 && publisher.PublishedPort > 0),
      false,
      'Only the HTTP entrypoint should be published to the host',
    );
  } finally {
    clearInterval(keepAlive);
    runCommand(['-f', 'docker-compose.all-in-one.yml', 'down', '-v', '--remove-orphans'], {
      env: composeEnv,
      allowFailure: true,
      timeoutMs: 2 * 60 * 1000,
    });

    if (process.env.KEEP_BLOG_E2E !== 'true') {
      cleanupTempRoot();
    }
  }
});
