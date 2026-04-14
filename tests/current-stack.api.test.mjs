import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.VANBLOG_TEST_BASE_URL || 'http://127.0.0.1:18080';
const debugSuperToken =
  process.env.VANBLOG_TEST_DEBUG_SUPER_TOKEN || process.env.VAN_BLOG_DEBUG_SUPER_TOKEN || '';

function requireDebugSuperToken() {
  assert.ok(
    debugSuperToken,
    'Missing VANBLOG_TEST_DEBUG_SUPER_TOKEN (or VAN_BLOG_DEBUG_SUPER_TOKEN) for current stack tests.',
  );
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return { response, body };
}

async function getDebugToken() {
  requireDebugSuperToken();

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

async function waitFor(check, { timeoutMs = 90000, intervalMs = 2000, label = 'condition' } = {}) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for ${label}`);
}

test('current 18080 stack serves core public and admin APIs', async () => {
  requireDebugSuperToken();

  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);

  const swagger = await fetch(`${baseUrl}/swagger`);
  assert.equal(swagger.status, 404);

  const waline = await fetch(`${baseUrl}/api/ui/`);
  assert.equal(waline.status, 200);

  const token = await getDebugToken();
  const authHeaders = { token };

  const { response: metaResponse, body: metaBody } = await fetchJson(`${baseUrl}/api/admin/meta`, {
    headers: authHeaders,
  });
  assert.equal(metaResponse.status, 200);
  assert.equal(metaBody?.statusCode, 200);
  assert.equal(metaBody?.data?.user?.id, 0);
});

test(
  'current 18080 stack supports debug-token auth, draft publish, public browse, and cleanup',
  async () => {
    requireDebugSuperToken();

    const token = await getDebugToken();
    const authHeaders = {
      token,
      'content-type': 'application/json',
    };

    const stamp = Date.now().toString(36);
    const articleTitle = `[current-stack] ${stamp}`;
    const pathname = `current-stack-${stamp}`;
    const draftContent = `Current stack regression draft ${stamp}\n\n<!-- more -->\n\nPublished body ${stamp}`;

    let draftId;
    let articleId;

    try {
      const { response: createDraftResponse, body: createDraftBody } = await fetchJson(
        `${baseUrl}/api/admin/draft`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            title: articleTitle,
            content: draftContent,
            category: 'Testing',
            tags: ['current-stack', 'node24'],
          }),
        },
      );
      assert.equal(createDraftResponse.status, 201);
      assert.equal(createDraftBody?.statusCode, 200);
      draftId = createDraftBody?.data?.id;
      assert.ok(Number.isInteger(draftId), 'draft creation did not return a numeric id');

      const { response: draftResponse, body: draftBody } = await fetchJson(
        `${baseUrl}/api/admin/draft/${draftId}`,
        {
          headers: { token },
        },
      );
      assert.equal(draftResponse.status, 200);
      assert.equal(draftBody?.statusCode, 200);
      assert.equal(draftBody?.data?.title, articleTitle);

      const { response: publishResponse, body: publishBody } = await fetchJson(
        `${baseUrl}/api/admin/draft/publish?id=${draftId}`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            pathname,
            hidden: false,
            private: false,
          }),
        },
      );
      assert.equal(publishResponse.status, 201);
      assert.equal(publishBody?.statusCode, 200);
      articleId = publishBody?.data?.id;
      assert.ok(Number.isInteger(articleId), 'draft publish did not return an article id');

      await waitFor(
        async () => {
          const { response, body } = await fetchJson(`${baseUrl}/api/public/article/${pathname}`);
          if (response.status !== 200 || body?.statusCode !== 200) {
            return false;
          }
          return body?.data?.article?.title === articleTitle;
        },
        { label: 'published article detail' },
      );

      await waitFor(
        async () => {
          const { response, body } = await fetchJson(
            `${baseUrl}/api/public/article?page=1&pageSize=20&toListView=true`,
          );
          if (response.status !== 200 || body?.statusCode !== 200) {
            return false;
          }
          return body?.data?.articles?.some((article) => article?.title === articleTitle);
        },
        { label: 'published article in public list' },
      );
    } finally {
      if (articleId !== undefined) {
        const { body } = await fetchJson(`${baseUrl}/api/admin/article/${articleId}`, {
          method: 'DELETE',
          headers: { token },
        });
        assert.equal(body?.statusCode, 200, `article cleanup failed: ${JSON.stringify(body)}`);
      } else if (draftId !== undefined) {
        const { body } = await fetchJson(`${baseUrl}/api/admin/draft/${draftId}`, {
          method: 'DELETE',
          headers: { token },
        });
        assert.equal(body?.statusCode, 200, `draft cleanup failed: ${JSON.stringify(body)}`);
      }
    }
  },
);

test('current 18080 stack supports admin layout config and mindmap CRUD', async () => {
  requireDebugSuperToken();

  const token = await getDebugToken();
  const authHeaders = {
    token,
    'content-type': 'application/json',
  };
  const stamp = Date.now().toString(36);
  let mindMapId;

  try {
    const { response: layoutResponse, body: layoutBody } = await fetchJson(
      `${baseUrl}/api/admin/setting/adminLayout`,
      {
        headers: { token },
      },
    );
    assert.equal(layoutResponse.status, 200);
    assert.equal(layoutBody?.statusCode, 200);
    assert.ok(Array.isArray(layoutBody?.data?.menuItems), 'admin layout menuItems is not an array');
    assert.ok(
      layoutBody?.data?.menuItems?.length > 0,
      'admin layout menuItems is unexpectedly empty',
    );

    const title = `[current-stack-mindmap] ${stamp}`;
    const description = `mindmap smoke ${stamp}`;
    const content = JSON.stringify({
      root: {
        data: { text: '根节点' },
        children: [],
      },
      theme: {
        template: 'avocado',
        config: {},
      },
      layout: 'logicalStructure',
      config: {},
      view: null,
    });

    const { response: createResponse, body: createBody } = await fetchJson(
      `${baseUrl}/api/admin/mindmap`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title,
          description,
          content,
        }),
      },
    );
    assert.equal(createResponse.status, 201);
    assert.equal(createBody?.statusCode, 200);
    mindMapId = createBody?.data?._id;
    assert.ok(mindMapId, 'mindmap creation did not return an id');

    const { response: getResponse, body: getBody } = await fetchJson(
      `${baseUrl}/api/admin/mindmap/${mindMapId}`,
      {
        headers: { token },
      },
    );
    assert.equal(getResponse.status, 200);
    assert.equal(getBody?.statusCode, 200);
    assert.equal(getBody?.data?.title, title);

    const { response: searchResponse, body: searchBody } = await fetchJson(
      `${baseUrl}/api/admin/mindmap/search?value=${encodeURIComponent(title)}`,
      {
        headers: { token },
      },
    );
    assert.equal(searchResponse.status, 200);
    assert.equal(searchBody?.statusCode, 200);
    assert.ok(
      searchBody?.data?.data?.some((item) => item?._id === mindMapId),
      'mindmap search did not return the created item',
    );

    const { response: updateResponse, body: updateBody } = await fetchJson(
      `${baseUrl}/api/admin/mindmap/${mindMapId}`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: `${title}-updated`,
          description: `${description}-updated`,
          content,
        }),
      },
    );
    assert.equal(updateResponse.status, 200);
    assert.equal(updateBody?.statusCode, 200);
    assert.equal(updateBody?.data?.title, `${title}-updated`);

    const { response: listResponse, body: listBody } = await fetchJson(
      `${baseUrl}/api/admin/mindmap?page=1&pageSize=20`,
      {
        headers: { token },
      },
    );
    assert.equal(listResponse.status, 200);
    assert.equal(listBody?.statusCode, 200);
    assert.ok(
      listBody?.data?.mindMaps?.some((item) => item?._id === mindMapId),
      'mindmap list did not return the created item',
    );
  } finally {
    if (mindMapId) {
      const { response, body } = await fetchJson(`${baseUrl}/api/admin/mindmap/${mindMapId}`, {
        method: 'DELETE',
        headers: { token },
      });
      assert.equal(response.status, 200, `mindmap cleanup failed: ${JSON.stringify(body)}`);
      assert.equal(body?.statusCode, 200, `mindmap cleanup failed: ${JSON.stringify(body)}`);
    }
  }
});
