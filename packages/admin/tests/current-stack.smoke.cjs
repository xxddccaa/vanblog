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
  try {
    await page.waitForLoadState('networkidle', { timeout: 4000 });
  } catch (error) {
    await page.waitForTimeout(2500);
  }
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
  assert.ok(
    ['/admin/logo.svg', '/logo.svg'].includes(logoSrc),
    `unexpected admin logo src: ${logoSrc}`,
  );

  const footer = page.locator('[data-testid="admin-sider-footer-actions"]');
  await footer.waitFor({ state: 'visible' });

  const footerLabels = await footer.locator('.ant-menu-title-content').allTextContents();
  assert.deepEqual(
    footerLabels.map((item) => item.trim()).filter(Boolean),
    ['主站', '关于', '亮色', '登出'],
    `unexpected footer menu labels: ${JSON.stringify(footerLabels)}`,
  );

  const themeToggle = footer.getByRole('menuitem', { name: /亮色|暗色/ });
  await themeToggle.waitFor({ state: 'visible' });

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

  assert.notEqual(
    afterTheme.theme,
    beforeTheme.theme,
    'theme toggle did not update localStorage.theme',
  );
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
    buttonText:
      document.querySelector('[data-testid="admin-theme-toggle-label"]')?.textContent || '',
  }));
  assert.equal(darkState.theme, 'dark', 'expected persisted dark theme after reload');
  assert.equal(darkState.htmlTheme, 'dark', 'expected html data-theme to stay dark after reload');
  assert.equal(darkState.buttonText, '暗色', 'theme label did not sync after dark theme reload');

  await page.setViewportSize({ width: 991, height: 900 });
  await page.waitForTimeout(800);
  const collapsedAt991 = await page.evaluate(() =>
    document
      .querySelector('[data-testid="admin-sider-footer-actions"]')
      ?.closest('.ant-pro-sider-footer')
      ?.classList.contains('ant-pro-sider-footer-collapsed'),
  );
  assert.equal(collapsedAt991, false, 'desktop sider should stay expanded at 991px');

  await page.setViewportSize({ width: 767, height: 900 });
  await page.waitForTimeout(800);
  const mobileShellState = await page.evaluate(() => ({
    hasDesktopFooter: Boolean(document.querySelector('[data-testid="admin-sider-footer-actions"]')),
    hasMobileMenuTrigger: Boolean(document.querySelector('[aria-label="menu"]')),
  }));
  assert.equal(
    mobileShellState.hasDesktopFooter,
    false,
    'mobile shell should switch away from the desktop footer layout below 768px',
  );
  assert.equal(
    mobileShellState.hasMobileMenuTrigger,
    true,
    'mobile shell should expose the menu trigger below 768px',
  );

  await page.getByRole('img', { name: 'menu' }).click();
  await page.waitForTimeout(400);

  const mobileFooter = page.locator('[role="dialog"] [data-testid="admin-sider-footer-actions"]');
  await mobileFooter.waitFor({ state: 'visible' });
  const mobileFooterLabels = await mobileFooter
    .locator('.ant-menu-title-content')
    .allTextContents();
  assert.deepEqual(
    mobileFooterLabels.map((item) => item.trim()).filter(Boolean),
    ['主站', '关于', '暗色', '登出'],
    `unexpected mobile footer menu labels: ${JSON.stringify(mobileFooterLabels)}`,
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(800);

  const pageContainerColor = await page
    .locator('.ant-pro-page-container')
    .first()
    .evaluate((element) => getComputedStyle(element).color);
  assert.notEqual(
    pageContainerColor,
    'rgba(0, 0, 0, 0.88)',
    'page container still uses light theme text after dark theme reload',
  );

  const selectedMenuColor = await page
    .locator('.ant-menu-item-selected')
    .first()
    .evaluate((element) => {
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
  assert.notEqual(
    logoTitleColor,
    'rgba(0, 0, 0, 0.88)',
    'dark theme still renders logo title as black',
  );
}

async function findSyntaxHighlightArticleId(token) {
  const { response, body } = await fetchJson(
    `${baseUrl}/api/admin/article?page=1&pageSize=50&toListView=true`,
    {
      headers: { token },
    },
  );
  assert.equal(response.status, 200, `list articles failed: ${JSON.stringify(body)}`);
  assert.equal(body?.statusCode, 200, `list articles failed: ${JSON.stringify(body)}`);

  const articles = body?.data?.articles || [];
  for (const article of articles) {
    if (!article?.id) {
      continue;
    }

    const { response: detailResponse, body: detailBody } = await fetchJson(
      `${baseUrl}/api/admin/article/${article.id}`,
      {
        headers: { token },
      },
    );
    assert.equal(
      detailResponse.status,
      200,
      `get article ${article.id} failed: ${JSON.stringify(detailBody)}`,
    );
    assert.equal(
      detailBody?.statusCode,
      200,
      `get article ${article.id} failed: ${JSON.stringify(detailBody)}`,
    );

    const content = detailBody?.data?.content || '';
    if (/```[a-zA-Z]/.test(content)) {
      return article.id;
    }
  }

  assert.fail(
    'expected at least one article with a fenced language code block for editor smoke test',
  );
}

async function assertDarkEditorSurface(page, token) {
  const articleId = await findSyntaxHighlightArticleId(token);

  await page.evaluate(() => {
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('vanblog_editor_engine', 'milkdown');
  });

  const bodyText = await openAdminRoute(page, `/editor?type=article&id=${articleId}`);
  assert.ok(bodyText.includes('保存'), 'editor page did not render save action');

  const syntaxState = await page.evaluate(() => {
    const htmlTheme = document.documentElement.dataset.theme || '';
    const milkdownEditor = document.querySelector('.vb-milkdown-editor .milkdown .editor');
    const byteMDEditor = document.querySelector('.CodeMirror');
    const editor = milkdownEditor || byteMDEditor;
    const editorBaseColor = editor ? getComputedStyle(editor).color : '';
    const editorBackground = editor ? getComputedStyle(editor).backgroundColor : '';
    const editorType = milkdownEditor ? 'milkdown' : byteMDEditor ? 'bytemd' : 'missing';
    const editorTokenColors =
      editorType === 'bytemd'
        ? Array.from(document.querySelectorAll('.CodeMirror span[class*="cm-"]'))
            .map((element) => ({
              classes: element.className,
              color: getComputedStyle(element).color,
            }))
            .filter((token) => token.color && token.color !== editorBaseColor)
        : [];

    const previewBody =
      document.querySelector('.vb-milkdown-editor__pane--preview .markdown-body') ||
      document.querySelector('.bytemd-preview .markdown-body');
    const previewBaseColor = previewBody ? getComputedStyle(previewBody).color : '';
    const previewTokenColors = Array.from(
      document.querySelectorAll(
        '.vb-milkdown-editor__pane--preview [class*="hljs-"], .bytemd-preview [class*="hljs-"]',
      ),
    )
      .map((element) => ({
        classes: element.className,
        color: getComputedStyle(element).color,
      }))
      .filter((token) => token.color && token.color !== previewBaseColor);

    return {
      htmlTheme,
      editorType,
      editorBaseColor,
      editorBackground,
      previewBaseColor,
      editorHighlightedTokenCount: editorTokenColors.length,
      previewHighlightedTokenCount: previewTokenColors.length,
      editorTokenSample: editorTokenColors.slice(0, 5),
      previewTokenSample: previewTokenColors.slice(0, 5),
    };
  });

  assert.equal(syntaxState.htmlTheme, 'dark', 'editor page did not stay in dark theme');
  assert.notEqual(
    syntaxState.editorType,
    'missing',
    'editor page did not render any editor surface',
  );
  assert.ok(syntaxState.editorBaseColor, 'editor surface did not expose a readable text color');
  assert.notEqual(
    syntaxState.editorBaseColor,
    'rgba(0, 0, 0, 0.88)',
    `dark editor text still uses light-theme black: ${JSON.stringify(syntaxState)}`,
  );
  assert.ok(syntaxState.editorBackground, 'editor surface did not expose a background color');
  if (syntaxState.editorType === 'bytemd') {
    assert.ok(
      syntaxState.editorHighlightedTokenCount > 0,
      `dark ByteMD tokens collapsed to base color ${syntaxState.editorBaseColor}: ${JSON.stringify(
        syntaxState.editorTokenSample,
      )}`,
    );
  }
  assert.ok(
    syntaxState.previewHighlightedTokenCount > 0,
    `dark preview tokens collapsed to base color ${syntaxState.previewBaseColor}: ${JSON.stringify(
      syntaxState.previewTokenSample,
    )}`,
  );
}

async function assertNarrowByteMdPreviewVisible(page, token) {
  const articleId = await findSyntaxHighlightArticleId(token);

  await page.setViewportSize({ width: 1100, height: 900 });
  await page.evaluate(() => {
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('vanblog_editor_engine', 'bytemd');
  });

  const bodyText = await openAdminRoute(page, `/editor?type=article&id=${articleId}`);
  assert.ok(bodyText.includes('保存'), 'ByteMD editor page did not render save action');

  const previewState = await page.evaluate(() => {
    const root = document.querySelector('.bytemd');
    const preview = document.querySelector('.bytemd-preview');
    const previewBody =
      document.querySelector('.bytemd-preview .document-viewer .markdown-body') ||
      document.querySelector('.bytemd-preview .markdown-body');
    const editor = document.querySelector('.bytemd-editor');
    const rootRect = root ? root.getBoundingClientRect() : null;
    const previewRect = preview ? preview.getBoundingClientRect() : null;
    const editorRect = editor ? editor.getBoundingClientRect() : null;
    const previewStyle = preview ? getComputedStyle(preview) : null;

    return {
      rootWidth: rootRect ? rootRect.width : 0,
      previewDisplay: previewStyle ? previewStyle.display : '',
      previewWidth: previewRect ? previewRect.width : 0,
      previewHeight: previewRect ? previewRect.height : 0,
      previewTextLength: previewBody ? (previewBody.textContent || '').trim().length : 0,
      stacked:
        Boolean(previewRect && editorRect) &&
        previewRect.top >= editorRect.bottom - 1 &&
        Math.abs(previewRect.left - editorRect.left) <= 1,
    };
  });

  assert.notEqual(
    previewState.previewDisplay,
    'none',
    `ByteMD preview was hidden: ${JSON.stringify(previewState)}`,
  );
  assert.ok(
    previewState.previewWidth > 0,
    `ByteMD preview width collapsed: ${JSON.stringify(previewState)}`,
  );
  assert.ok(
    previewState.previewHeight > 0,
    `ByteMD preview height collapsed: ${JSON.stringify(previewState)}`,
  );
  assert.ok(
    previewState.previewTextLength > 20,
    `ByteMD preview did not render markdown content: ${JSON.stringify(previewState)}`,
  );
  assert.equal(
    previewState.stacked,
    true,
    `ByteMD narrow layout did not stack editor and preview panes: ${JSON.stringify(previewState)}`,
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(800);
}

async function assertMobileAdminSurfaces(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);

  const articleBody = await openAdminRoute(page, '/article');
  assert.ok(
    articleBody.includes('搜索标题'),
    'mobile article page did not switch to mobile search surface',
  );
  assert.ok(articleBody.includes('筛选'), 'mobile article page did not render filter action');

  const articleLayout = await page.evaluate(() => {
    const toolbar = document.querySelector('.admin-mobile-toolbar-card');
    return {
      bodyWidth: document.body.getBoundingClientRect().width,
      toolbarWidth: toolbar ? toolbar.getBoundingClientRect().width : 0,
      hasMobileShell: document.body.classList.contains('admin-mobile-shell'),
    };
  });
  assert.equal(
    articleLayout.hasMobileShell,
    true,
    'mobile shell class not applied on article page',
  );
  assert.ok(
    articleLayout.toolbarWidth >= articleLayout.bodyWidth - 28,
    `mobile toolbar stayed too narrow: ${JSON.stringify(articleLayout)}`,
  );

  const documentBody = await openAdminRoute(page, '/document');
  assert.ok(documentBody.includes('文档树'), 'mobile document page did not render drawer trigger');

  const settingBody = await openAdminRoute(page, '/site/setting');
  assert.ok(
    settingBody.includes('站点'),
    'mobile system settings tabs did not render compact labels',
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(800);
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
    await assertMobileAdminSurfaces(page);
    await assertDarkEditorSurface(page, token);
    await assertNarrowByteMdPreviewVisible(page, token);
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
      assert.ok(
        editorBody.includes('保存 (Ctrl+S)') && editorBody.includes('编辑信息'),
        'mindmap editor did not render expected controls',
      );
      assert.equal(
        editorBody.includes('加载思维导图数据失败'),
        false,
        'mindmap editor still failed to load a valid record',
      );

      const mindMapFrame = page.locator('iframe[src*="/admin/mindmap/index.html"]').first();
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
    assert.ok(
      commentFrameBox && commentFrameBox.height >= 700,
      'comment iframe height is too short',
    );

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
      `image manager still requests missing image files: ${JSON.stringify(
        failedResponses,
        null,
        2,
      )}`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
