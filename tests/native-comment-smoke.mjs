// Shared smoke checks for the native comment system, used by the compose e2e flows.
// The contract lives in packages/server/src/types/comment.dto.ts.
import assert from 'node:assert/strict';

const COMMENT_TARGET = 'page:link';
const PRIVATE_COMMENT_FIELDS = ['mail', 'ip', 'ua'];

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
    });
  } catch (error) {
    throw new Error(`Request failed for ${url}: ${error.message}`);
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, text, body, headers: response.headers };
}

const postComment = (baseUrl, origin, payload) =>
  request(`${baseUrl}/api/public/comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      Referer: `${origin}/link`,
    },
    body: JSON.stringify(payload),
  });

/**
 * Asserts that the former Waline routes no longer reach Waline: `/api/*` falls
 * through to the server and the top-level paths fall through to the website.
 */
export async function assertWalineRoutesRemoved(baseUrl) {
  for (const pathname of ['/api/ui/', '/ui/']) {
    const response = await request(`${baseUrl}${pathname}`, { redirect: 'manual' });
    assert.doesNotMatch(
      response.text,
      /Waline Management System/i,
      `${pathname} must not serve the Waline admin UI any more (status ${response.status})`,
    );
  }

  // Waline answered its comment API with an `{ errno, errmsg, data }` envelope.
  for (const pathname of ['/api/comment?type=count&url=%2F', '/comment?type=count&url=%2F']) {
    const response = await request(`${baseUrl}${pathname}`, { redirect: 'manual' });
    assert.equal(
      response.body !== null && typeof response.body === 'object' && 'errno' in response.body,
      false,
      `${pathname} must not be answered by Waline any more (status ${response.status})`,
    );
  }

  const legacyUi = await request(`${baseUrl}/api/ui/`);
  assert.equal(legacyUi.status, 404, '/api/ui/ should now be an unknown server route');
}

/**
 * Posts a visitor comment on the friend-links page and reads it back.
 * Requires `enableComment: 'true'` in site info and default comment settings.
 */
export async function assertNativeCommentFlow(baseUrl, waitFor) {
  const marker = `native-comment-${Date.now().toString(36)}`;
  const content = `Native comment smoke ${marker}`;

  const crossSite = await postComment(baseUrl, 'https://cross-site.example', {
    target: COMMENT_TARGET,
    nick: 'Cross Site',
    content: `${content} (cross-site)`,
    website: '',
  });
  assert.ok(
    crossSite.status >= 400,
    `cross-site comment POST must be rejected, got ${crossSite.status}: ${crossSite.text.slice(
      0,
      300,
    )}`,
  );
  assert.equal(crossSite.body?.code, 'COMMENT_CROSS_SITE');

  const created = await postComment(baseUrl, baseUrl, {
    target: COMMENT_TARGET,
    nick: 'E2E Visitor',
    mail: 'visitor@example.com',
    content,
    website: '',
  });
  assert.ok(
    created.status === 200 || created.status === 201,
    `comment POST failed with ${created.status}: ${created.text.slice(0, 500)}`,
  );
  assert.equal(created.body?.statusCode, 200);
  assert.equal(created.body?.data?.status, 'approved');
  const createdComment = created.body?.data?.comment;
  assert.ok(Number.isInteger(createdComment?.id), 'created comment should have a numeric id');
  assert.equal(createdComment?.target, COMMENT_TARGET);
  assert.equal(createdComment?.content, content);
  for (const field of PRIVATE_COMMENT_FIELDS) {
    assert.equal(field in (createdComment || {}), false, `public comment must not expose ${field}`);
  }

  const listed = await waitFor(
    async () => {
      const response = await request(
        `${baseUrl}/api/public/comment?target=${encodeURIComponent(
          COMMENT_TARGET,
        )}&page=1&sort=latest`,
      );
      if (response.status !== 200 || response.body?.statusCode !== 200) {
        return false;
      }
      const match = response.body?.data?.items?.find((item) => item.id === createdComment.id);
      return match ? { page: response.body.data, comment: match } : false;
    },
    {
      timeoutMs: 90 * 1000,
      intervalMs: 3000,
      label: 'native comment to appear in the public comment list',
    },
  );
  assert.equal(listed.comment.content, content);
  assert.equal(listed.comment.nick, 'E2E Visitor');
  assert.ok(listed.page.count >= 1);
  for (const field of PRIVATE_COMMENT_FIELDS) {
    assert.equal(field in listed.comment, false, `listed comment must not expose ${field}`);
  }
  assert.doesNotMatch(JSON.stringify(listed.page), /visitor@example\.com/);
}
