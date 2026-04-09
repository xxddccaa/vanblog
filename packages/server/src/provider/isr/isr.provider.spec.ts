import { ISRProvider } from './isr.provider';

describe('ISRProvider', () => {
  const oldEnv = process.env['VANBLOG_WEBSITE_ISR_BASE'];

  afterAll(() => {
    if (oldEnv === undefined) {
      delete process.env['VANBLOG_WEBSITE_ISR_BASE'];
      return;
    }
    process.env['VANBLOG_WEBSITE_ISR_BASE'] = oldEnv;
  });

  it('reads the revalidate base URL from the environment', () => {
    process.env['VANBLOG_WEBSITE_ISR_BASE'] = 'http://website:3001/api/revalidate?path=';

    const provider = new ISRProvider({} as any, {} as any, {} as any, {} as any, {} as any);

    expect(provider.base).toBe('http://website:3001/api/revalidate?path=');
  });

  it('revalidates the current article and list pages without touching neighbor posts', async () => {
    const articleProvider = {
      getByIdOrPathnameWithPreNext: jest.fn().mockResolvedValue({
        article: {
          id: 7,
          pathname: 'stable-post',
          category: 'System Design',
          tags: ['Cloudflare'],
        },
        pre: { id: 6, pathname: 'previous-post' },
        next: { id: 8, pathname: 'next-post' },
      }),
    };
    const searchIndexProvider = {
      generateSearchIndex: jest.fn(),
    };
    const provider = new ISRProvider(
      articleProvider as any,
      {} as any,
      {
        getTagPageUrls: jest.fn().mockResolvedValue(['/tag/Cloudflare/page/2']),
        getCategoryPageUrls: jest.fn().mockResolvedValue(['/category/System Design/page/2']),
        getPageUrls: jest.fn().mockResolvedValue(['/page/2']),
      } as any,
      {} as any,
      searchIndexProvider as any,
    );
    const activeUrl = jest.spyOn(provider, 'activeUrl').mockResolvedValue(undefined);
    const activeUrls = jest.spyOn(provider, 'activeUrls').mockResolvedValue(undefined);

    await provider.activeArticleById(7, 'update');

    expect(activeUrl).toHaveBeenCalledWith('/post/7', true);
    expect(activeUrl).toHaveBeenCalledWith('/post/stable-post', true);
    expect(activeUrl).toHaveBeenCalledWith('/tag/Cloudflare', true);
    expect(activeUrl).toHaveBeenCalledWith('/category/System Design', true);
    expect(activeUrl).not.toHaveBeenCalledWith('/post/6', true);
    expect(activeUrl).not.toHaveBeenCalledWith('/post/8', true);
    expect(activeUrls).toHaveBeenCalledWith(['/tag/Cloudflare/page/2'], false);
    expect(activeUrls).toHaveBeenCalledWith(['/category/System Design/page/2'], false);
    expect(searchIndexProvider.generateSearchIndex).toHaveBeenCalled();
  });
});
