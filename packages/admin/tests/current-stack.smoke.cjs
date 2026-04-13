const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');

const baseUrl = process.env.VANBLOG_TEST_BASE_URL || 'http://127.0.0.1:18080';
const debugSuperToken =
  process.env.VANBLOG_TEST_DEBUG_SUPER_TOKEN || process.env.VAN_BLOG_DEBUG_SUPER_TOKEN || '';

function getChromeExecutablePath() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return { response, body };
}

async function getDebugToken() {
  assert.ok(
    debugSuperToken,
    'Missing VANBLOG_TEST_DEBUG_SUPER_TOKEN (or VAN_BLOG_DEBUG_SUPER_TOKEN) for current stack admin smoke test.',
  );

  const { response, body } = await fetchJson(`${baseUrl}/api/admin/auth/debug-token`, {
    headers: {
      'x-debug-super-token': debugSuperToken,
    },
  });

  assert.equal(response.status, 200, `debug-token failed: ${JSON.stringify(body)}`);
  assert.equal(body?.statusCode, 200, `debug-token failed: ${JSON.stringify(body)}`);
  assert.ok(body?.data?.token, 'debug-token did not return an auth token');
  return body.data.token;
}

async function createTempMindMap(token) {
  const stamp = Date.now().toString(36);
  const { response, body } = await fetchJson(`${baseUrl}/api/admin/mindmap`, {
    method: 'POST',
    headers: {
      token,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      title: `[current-stack-mindmap] ${stamp}`,
      description: 'mindmap smoke',
      content: JSON.stringify({
        root: {
          data: {
            text: '根节点',
          },
          children: [],
        },
        theme: {
          template: 'avocado',
          config: {},
        },
        layout: 'logicalStructure',
        config: {},
        view: null,
      }),
    }),
  });

  assert.equal(response.status, 201, `create mindmap failed: ${JSON.stringify(body)}`);
  assert.equal(body?.statusCode, 200, `create mindmap failed: ${JSON.stringify(body)}`);
  assert.ok(body?.data?._id, 'create mindmap did not return an id');
  return body.data._id;
}

async function deleteTempMindMap(token, id) {
  if (!id) {
    return;
  }

  const { response, body } = await fetchJson(`${baseUrl}/api/admin/mindmap/${id}`, {
    method: 'DELETE',
    headers: {
      token,
    },
  });

  assert.equal(response.status, 200, `delete mindmap failed: ${JSON.stringify(body)}`);
  assert.equal(body?.statusCode, 200, `delete mindmap failed: ${JSON.stringify(body)}`);
}

async function assertNoErrorBoundary(page, route) {
  const bodyText = await page.locator('body').innerText();
  assert.ok(!bodyText.includes('Something went wrong.'), `${route} hit error boundary`);
  assert.ok(
    !bodyText.includes('Cannot read properties of undefined'),
    `${route} still has undefined access errors`,
  );
  return bodyText;
}

async function openAdminRoute(page, route) {
  await page.goto(`${baseUrl}/admin${route}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1500);
  return assertNoErrorBoundary(page, route);
}

async function clickTab(page, tabText, queryKey = 'tab') {
  const tab = page.getByRole('tab', { name: tabText });
  if ((await tab.count()) > 0) {
    await tab.first().click();
  } else {
    await page.locator('.ant-tabs-tab').filter({ hasText: tabText }).first().click();
  }

  await page.waitForTimeout(1000);
  const nextUrl = new URL(page.url());
  assert.equal(nextUrl.searchParams.has(queryKey), true, `missing ${queryKey} after switching tab`);
  assert.equal(
    nextUrl.pathname.includes('/admin/admin/'),
    false,
    `route duplicated admin basename after switching tab: ${nextUrl.pathname}`,
  );
  await assertNoErrorBoundary(page, page.url());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await assertNoErrorBoundary(page, `${page.url()} after reload`);
}

async function assertAdminShell(page) {
  const logo = page.locator('[data-testid="admin-sider-logo"] img');
  await logo.waitFor({ state: 'visible' });
  const logoSrc = await logo.getAttribute('src');
  assert.equal(logoSrc, '/admin/logo.svg', `unexpected admin logo src: ${logoSrc}`);

  const logoutButtons = page.getByTestId('admin-logout-button');
  assert.equal(await logoutButtons.count(), 1, 'expected exactly one logout button in sider footer');

  const themeToggle = page.getByTestId('admin-theme-toggle');
  await themeToggle.waitFor({ state: 'visible' });
  const inFooter = await themeToggle.evaluate(
    (element) => !!element.closest('[data-testid="admin-sider-footer-actions"]'),
  );
  assert.equal(inFooter, true, 'theme toggle is not rendered in the left sider footer');
  const logoutInFooter = await logoutButtons
    .first()
    .evaluate((element) => !!element.closest('[data-testid="admin-sider-footer-actions"]'));
  assert.equal(logoutInFooter, true, 'logout button is not rendered in the left sider footer');

  const beforeTheme = await page.evaluate(() => ({
    theme: window.localStorage.getItem('theme'),
    htmlTheme: document.documentElement.dataset.theme || '',
    bodyTheme: document.body.dataset.theme || '',
  }));

  await themeToggle.click();
  await page.waitForTimeout(500);

  const afterTheme = await page.evaluate(() => ({
    theme: window.localStorage.getItem('theme'),
    htmlTheme: document.documentElement.dataset.theme || '',
    bodyTheme: document.body.dataset.theme || '',
  }));

  assert.notEqual(afterTheme.theme, beforeTheme.theme, 'theme toggle did not update localStorage.theme');
  assert.ok(afterTheme.htmlTheme, 'theme toggle did not set html data-theme');
  assert.equal(afterTheme.htmlTheme, afterTheme.bodyTheme, 'html/body theme markers diverged');

  await page.evaluate(() => {
    window.localStorage.setItem('theme', 'dark');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const darkState = await page.evaluate(() => ({
    theme: window.localStorage.getItem('theme'),
    htmlTheme: document.documentElement.dataset.theme || '',
    buttonText: document.querySelector('[data-testid="admin-theme-toggle"]')?.textContent || '',
  }));
  assert.equal(darkState.theme, 'dark', 'expected persisted dark theme after reload');
  assert.equal(darkState.htmlTheme, 'dark', 'expected html data-theme to stay dark after reload');
  assert.equal(darkState.buttonText, '暗色模式', 'theme label did not sync after dark theme reload');

  const pageContainerColor = await page
    .locator('.ant-pro-page-container')
    .first()
    .evaluate((element) => getComputedStyle(element).color);
  assert.notEqual(
    pageContainerColor,
    'rgba(0, 0, 0, 0.88)',
    'page container still uses light theme text after dark theme reload',
  );

  const selectedMenuColor = await page.locator('.ant-menu-item-selected').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return style.color;
  });
  assert.notEqual(
    selectedMenuColor,
    'rgba(0, 0, 0, 0.95)',
    'dark theme still renders selected menu item text as black',
  );

  const logoTitleColor = await page
    .locator('[data-testid="admin-sider-logo"] h1')
    .evaluate((element) => getComputedStyle(element).color);
  assert.notEqual(logoTitleColor, 'rgba(0, 0, 0, 0.88)', 'dark theme still renders logo title as black');
}

async function main() {
  const token = await getDebugToken();
  const executablePath = getChromeExecutablePath();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  const context = await browser.newContext();
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];

  context.addInitScript((value) => {
    window.localStorage.setItem('token', value);
  }, token);

  const page = await context.newPage();
  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({
        status: response.status(),
        url: response.url(),
      });
    }
  });

  try {
    const articleBody = await openAdminRoute(page, '/article');
    assert.ok(articleBody.includes('文章管理'), 'article page did not render');
    await assertAdminShell(page);
    await page.waitForTimeout(2500);
    const walinePrewarmState = await page.evaluate(() =>
      window.sessionStorage.getItem('vanblog.admin.waline-prewarmed'),
    );
    assert.ok(walinePrewarmState, 'waline prewarm did not run after entering admin shell');

    const cases = [
      { route: '/welcome', title: '分析概览', tabTexts: ['👥 访客统计', '📝 文章分析'] },
      { route: '/mindmap', title: '思维导图管理', tabTexts: [] },
      { route: '/nav', title: '导航管理', tabTexts: ['分类管理'] },
      { route: '/static/img', title: '图片管理', tabTexts: [] },
      { route: '/site/data', title: '数据管理', tabTexts: ['标签管理'] },
      { route: '/site/setting', title: '系统设置', tabTexts: ['客制化'] },
      { route: '/site/log', title: '日志管理', tabTexts: ['流水线日志'] },
    ];

    for (const entry of cases) {
      const bodyText = await openAdminRoute(page, entry.route);
      assert.ok(bodyText.includes(entry.title), `${entry.route} did not render expected title`);
      for (const tabText of entry.tabTexts) {
        await clickTab(page, tabText);
      }
    }

    const staticMindMapShell = await fetch(`${baseUrl}/admin/mindmap/index.html`).then((response) =>
      response.text(),
    );
    assert.ok(
      staticMindMapShell.includes('window.externalPublicPath'),
      'mindmap shell is missing static editor bootstrap code',
    );
    assert.equal(
      staticMindMapShell.includes('/admin/umi.'),
      false,
      'mindmap shell still falls back to admin SPA index.html',
    );

    let tempMindMapId;
    try {
      tempMindMapId = await createTempMindMap(token);
      const editorBody = await openAdminRoute(page, `/mindmap/editor?id=${tempMindMapId}`);
      assert.ok(editorBody.includes('思维导图编辑器'), 'mindmap editor did not render');
      assert.equal(
        editorBody.includes('加载思维导图数据失败'),
        false,
        'mindmap editor still failed to load a valid record',
      );

      const mindMapFrame = page.locator('iframe').first();
      await mindMapFrame.waitFor({ state: 'visible', timeout: 15000 });
      const frameSrc = await mindMapFrame.getAttribute('src');
      assert.ok(
        frameSrc?.includes('/admin/mindmap/index.html'),
        `unexpected mindmap iframe src: ${frameSrc}`,
      );
    } finally {
      await deleteTempMindMap(token, tempMindMapId);
    }

    const commentBody = await openAdminRoute(page, '/site/comment');
    assert.ok(commentBody.includes('评论管理'), '/site/comment did not render expected title');
    const commentFrame = page.locator('iframe[title="waline 后台"]');
    await commentFrame.waitFor({ state: 'visible', timeout: 15000 });
    const commentFrameBox = await commentFrame.boundingBox();
    assert.ok(commentFrameBox && commentFrameBox.height >= 700, 'comment iframe height is too short');

    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('\n')}`);
    assert.equal(
      consoleErrors.some((entry) => entry.includes('Cannot read properties of undefined')),
      false,
      `console errors still include undefined access: ${consoleErrors.join('\n')}`,
    );
    assert.equal(
      failedResponses.some(
        (entry) =>
          entry.status === 404 &&
          entry.url.includes('/static/img/') &&
          entry.url.includes('.image.webp'),
      ),
      false,
      `image manager still requests missing image files: ${JSON.stringify(failedResponses, null, 2)}`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
