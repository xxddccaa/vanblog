import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPostCommentTarget,
  CommentApiError,
  createComment,
  describeCommentError,
  fetchCommentCounts,
  fetchCommentIdentity,
  fetchComments,
  fetchLikedCommentIds,
  formatRetryAfter,
  isCommentTargetKey,
  isCommentUnavailableError,
  NETWORK_ERROR_MESSAGE,
  toggleCommentLike,
  uploadCommentImage,
} from '../api/comments';

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const ok = (data: unknown) => jsonResponse(200, { statusCode: 200, data });

describe('comment api client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return { url: String(url), init: (init || {}) as RequestInit };
  };

  it('lists comments relative to the current origin with same-origin credentials', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], total: 0, count: 0, page: 2, pageSize: 10 }));

    const page = await fetchComments('post:12', { page: 2, sort: 'hot' });

    const { url, init } = lastCall();
    expect(url.startsWith('/api/public/comment?')).toBe(true);
    const params = new URL(url, 'http://localhost').searchParams;
    expect(params.get('target')).toBe('post:12');
    expect(params.get('page')).toBe('2');
    expect(params.get('sort')).toBe('hot');
    expect(init.credentials).toBe('same-origin');
    expect(init.method).toBe('GET');
    expect(page.page).toBe(2);
  });

  it('defaults to the first page sorted by latest', async () => {
    fetchMock.mockResolvedValue(ok({ items: [] }));
    await fetchComments('page:link');
    const params = new URL(lastCall().url, 'http://localhost').searchParams;
    expect(params.get('target')).toBe('page:link');
    expect(params.get('page')).toBe('1');
    expect(params.get('sort')).toBe('latest');
  });

  it('requests counts for valid unique target keys only', async () => {
    fetchMock.mockResolvedValue(ok({ 'post:1': 3, 'page:about': 1 }));

    const counts = await fetchCommentCounts([
      'post:1',
      'post:1',
      'page:about',
      'page:moment' as any,
      'post:abc' as any,
    ]);

    const { url } = lastCall();
    expect(url.startsWith('/api/public/comment/count?')).toBe(true);
    expect(new URL(url, 'http://localhost').searchParams.get('targets')).toBe('post:1,page:about');
    expect(counts['post:1']).toBe(3);
  });

  it('skips the count request when no target is valid', async () => {
    expect(await fetchCommentCounts([])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never caches identity and liked lookups', async () => {
    fetchMock.mockResolvedValueOnce(ok({ admin: true, nick: 'Owner' }));
    expect(await fetchCommentIdentity()).toEqual({ admin: true, nick: 'Owner' });
    expect(lastCall().url).toBe('/api/public/comment/identity');
    expect(lastCall().init.cache).toBe('no-store');
    expect(lastCall().init.credentials).toBe('same-origin');

    fetchMock.mockResolvedValueOnce(ok({ ids: [2, 3] }));
    expect(await fetchLikedCommentIds([3, 2, 2, -1, 1.5])).toEqual([2, 3]);
    const { url, init } = lastCall();
    expect(new URL(url, 'http://localhost').pathname).toBe('/api/public/comment/liked');
    expect(new URL(url, 'http://localhost').searchParams.get('ids')).toBe('3,2');
    expect(init.cache).toBe('no-store');
  });

  it('does not ask for liked ids when there are no comments', async () => {
    expect(await fetchLikedCommentIds([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts comments as JSON', async () => {
    fetchMock.mockResolvedValue(ok({ comment: { id: 9 }, status: 'pending' }));

    const result = await createComment({
      target: 'post:12',
      parentId: 3,
      nick: 'Alice',
      mail: 'alice@example.com',
      link: '',
      content: 'Hello',
      website: '',
    });

    const { url, init } = lastCall();
    expect(url).toBe('/api/public/comment');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({
      target: 'post:12',
      parentId: 3,
      nick: 'Alice',
      mail: 'alice@example.com',
      link: '',
      content: 'Hello',
      website: '',
    });
    expect(result.status).toBe('pending');
  });

  it('toggles likes with an empty JSON body', async () => {
    fetchMock.mockResolvedValue(ok({ liked: true, likes: 4 }));

    expect(await toggleCommentLike(5)).toEqual({ liked: true, likes: 4 });
    const { url, init } = lastCall();
    expect(url).toBe('/api/public/comment/5/like');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('uploads images as multipart with file and target', async () => {
    fetchMock.mockResolvedValue(
      ok({ url: '/static/img/comment/abc.webp', markdown: '![](/static/img/comment/abc.webp)' }),
    );
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' });

    const result = await uploadCommentImage(file, 'post:7');

    const { url, init } = lastCall();
    expect(url).toBe('/api/public/comment/image');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('target')).toBe('post:7');
    expect((form.get('file') as File).name).toBe('shot.png');
    // The browser must add the multipart boundary itself.
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(result.markdown).toBe('![](/static/img/comment/abc.webp)');
  });

  it('maps error codes to localized messages', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { statusCode: 409, message: 'Duplicate', code: 'COMMENT_DUPLICATE' }),
    );

    const error = await createComment({ target: 'post:1', content: 'x' }).catch((caught) => caught);
    expect(error).toBeInstanceOf(CommentApiError);
    expect(error.code).toBe('COMMENT_DUPLICATE');
    expect(error.status).toBe(409);
    expect(error.message).toBe('请勿重复提交相同的评论');
    expect(describeCommentError(error)).toBe('请勿重复提交相同的评论');
  });

  it('includes the wait time of a 429 response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, {
        statusCode: 429,
        message: 'Too Many Requests',
        code: 'COMMENT_RATE_LIMITED',
        retryAfterSeconds: 120,
      }),
    );

    const error = await createComment({ target: 'post:1', content: 'x' }).catch((caught) => caught);
    expect(error.code).toBe('COMMENT_RATE_LIMITED');
    expect(error.retryAfterSeconds).toBe(120);
    expect(error.message).toBe('操作太频繁，请 2 分钟后再试');
  });

  it('falls back to the Retry-After header for a bare 429', async () => {
    fetchMock.mockResolvedValue(
      new Response('busy', { status: 429, headers: { 'Retry-After': '30' } }),
    );

    const error = await toggleCommentLike(1).catch((caught) => caught);
    expect(error.code).toBeNull();
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.message).toBe('操作太频繁，请 30 秒后再试');
  });

  it('maps unknown failures by status and never surfaces server text', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, { statusCode: 500, message: 'Internal <b>boom</b>' }),
    );
    const serverError = await fetchComments('post:1').catch((caught) => caught);
    expect(serverError.message).toBe('服务器开小差了，请稍后再试');

    fetchMock.mockResolvedValue(jsonResponse(200, { statusCode: 404, message: 'Not Found' }));
    const enveloped = await fetchComments('post:1').catch((caught) => caught);
    expect(enveloped.status).toBe(404);
    expect(isCommentUnavailableError(enveloped)).toBe(true);
  });

  it('treats disabled comments and unavailable targets as unavailable', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { statusCode: 403, message: 'Forbidden', code: 'COMMENT_DISABLED' }),
    );
    const disabled = await fetchComments('post:1').catch((caught) => caught);
    expect(disabled.message).toBe('评论功能已关闭');
    expect(isCommentUnavailableError(disabled)).toBe(true);

    fetchMock.mockResolvedValue(
      jsonResponse(404, { statusCode: 404, message: 'x', code: 'COMMENT_TARGET_UNAVAILABLE' }),
    );
    const missing = await fetchComments('post:1').catch((caught) => caught);
    expect(missing.message).toBe('当前页面暂不开放评论');
    expect(isCommentUnavailableError(missing)).toBe(true);
  });

  it('reports network failures without leaking the raw error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await fetchComments('post:1').catch((caught) => caught);
    expect(error).toBeInstanceOf(CommentApiError);
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('rethrows aborts untouched so callers can ignore them', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    fetchMock.mockRejectedValue(abort);
    await expect(fetchComments('post:1')).rejects.toBe(abort);
  });
});

describe('comment targets', () => {
  it('builds post targets from numeric article ids only', () => {
    expect(buildPostCommentTarget(12)).toBe('post:12');
    expect(buildPostCommentTarget('34')).toBe('post:34');
    expect(buildPostCommentTarget('hello-world')).toBeNull();
    expect(buildPostCommentTarget(0)).toBeNull();
    expect(buildPostCommentTarget(-1)).toBeNull();
  });

  it('accepts only contract target keys', () => {
    expect(isCommentTargetKey('post:1')).toBe(true);
    expect(isCommentTargetKey('page:link')).toBe(true);
    expect(isCommentTargetKey('page:about')).toBe(true);
    expect(isCommentTargetKey('page:moment')).toBe(false);
    expect(isCommentTargetKey('post:01')).toBe(false);
    expect(isCommentTargetKey('post:/hello')).toBe(false);
    expect(isCommentTargetKey(undefined)).toBe(false);
  });

  it('formats retry delays', () => {
    expect(formatRetryAfter(5)).toBe('5 秒');
    expect(formatRetryAfter(61)).toBe('2 分钟');
    expect(formatRetryAfter(7200)).toBe('2 小时');
  });
});
