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
