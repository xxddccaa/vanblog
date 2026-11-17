import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();

vi.mock('@/services/request', () => ({
  default: request,
}));

describe('getArticlesByOption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue({ data: [] });
  });

  it('encodes special characters and forces list view', async () => {
    const { getArticlesByOption } = await import('./api');

    await getArticlesByOption({
      page: 0,
      pageSize: 20,
      hidden: false,
      empty: '',
      nullable: null,
      missing: undefined,
      toListView: false,
      title: 'A&B=C#D 中文/路径',
    });

    const [url, options] = request.mock.calls[0];
    const parsed = new URL(url, 'https://admin.example.com');

    expect(parsed.pathname).toBe('/api/admin/article');
    expect(parsed.searchParams.get('page')).toBe('0');
    expect(parsed.searchParams.get('pageSize')).toBe('20');
    expect(parsed.searchParams.get('hidden')).toBe('false');
    expect(parsed.searchParams.get('empty')).toBe('');
    expect(parsed.searchParams.get('nullable')).toBe('null');
    expect(parsed.searchParams.get('missing')).toBe('undefined');
    expect(parsed.searchParams.get('toListView')).toBe('true');
    expect(parsed.searchParams.getAll('toListView')).toEqual(['true']);
    expect(parsed.searchParams.get('title')).toBe('A&B=C#D 中文/路径');
    expect(url).toContain('A%26B%3DC%23D+%E4%B8%AD%E6%96%87%2F%E8%B7%AF%E5%BE%84');
    expect(options).toEqual({ method: 'GET' });
  });

  it('builds a valid list query for an empty option object', async () => {
    const { getArticlesByOption } = await import('./api');

    await getArticlesByOption({});

    expect(request).toHaveBeenCalledWith('/api/admin/article?toListView=true', {
      method: 'GET',
    });
  });
});

describe('admin comment services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue({ statusCode: 200, data: {} });
  });

  it('calls every admin comment route with the contract method and body', async () => {
    const api = await import('./api');

    await api.getComments({ page: 1, pageSize: 20, status: 'pending' });
    await api.getCommentStats({ skipErrorHandler: true });
    await api.updateComment(5, { status: 'approved' });
    await api.batchUpdateComments([1, 2], 'purge');
    await api.deleteComment(5);
    await api.purgeComment(5);
    await api.replyComment(5, 'thanks');
    await api.getCommentSetting();
    await api.updateCommentSetting({ pageSize: 10 });
    await api.sendCommentTestMail('a@b.co');

    expect(request.mock.calls).toEqual([
      [
        '/api/admin/comment',
        { method: 'GET', params: { page: 1, pageSize: 20, status: 'pending' } },
      ],
      ['/api/admin/comment/stats', { method: 'GET', skipErrorHandler: true }],
      ['/api/admin/comment/5', { method: 'PATCH', data: { status: 'approved' } }],
      ['/api/admin/comment/batch', { method: 'POST', data: { ids: [1, 2], action: 'purge' } }],
      ['/api/admin/comment/5', { method: 'DELETE' }],
      ['/api/admin/comment/5/purge', { method: 'DELETE' }],
      ['/api/admin/comment/5/reply', { method: 'POST', data: { content: 'thanks' } }],
      ['/api/admin/comment/setting', { method: 'GET' }],
      ['/api/admin/comment/setting', { method: 'PUT', data: { pageSize: 10 } }],
      ['/api/admin/comment/notify/test', { method: 'POST', data: { to: 'a@b.co' } }],
    ]);
  });

  it('encodes comment ids in the path', async () => {
    const api = await import('./api');
    await api.deleteComment('1/../setting');
    expect(request).toHaveBeenCalledWith('/api/admin/comment/1%2F..%2Fsetting', {
      method: 'DELETE',
    });
  });
});
