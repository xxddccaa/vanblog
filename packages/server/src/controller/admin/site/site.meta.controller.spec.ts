import { SiteMetaController } from './site.meta.controller';

describe('SiteMetaController', () => {
  const createController = () => {
    const metaProvider = {
      getSiteInfo: jest.fn().mockResolvedValue({ siteName: 'VanBlog' }),
      updateSiteInfo: jest.fn().mockResolvedValue({ siteName: 'Edge Cache Blog' }),
    };
    const isrProvider = {
      activeAll: jest.fn().mockResolvedValue(undefined),
    };
    const walineProvider = {
      restart: jest.fn().mockResolvedValue(undefined),
    };
    const websiteProvider = {
      restart: jest.fn().mockResolvedValue(undefined),
    };
    const pipelineProvider = {
      dispatchEvent: jest.fn(),
    };
    const privateSiteProvider = {
      handleSiteInfoUpdated: jest.fn().mockResolvedValue(undefined),
    };

    const controller = new SiteMetaController(
      metaProvider as any,
      isrProvider as any,
      walineProvider as any,
      websiteProvider as any,
      pipelineProvider as any,
      privateSiteProvider as any,
    );

    return {
      controller,
      metaProvider,
      isrProvider,
      walineProvider,
      websiteProvider,
      pipelineProvider,
      privateSiteProvider,
    };
  };

  it('returns current site info', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.get();

    expect(metaProvider.getSiteInfo).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      statusCode: 200,
      data: { siteName: 'VanBlog' },
    });
  });

  it('refreshes public site state after updating site info', async () => {
    const {
      controller,
      metaProvider,
      isrProvider,
      walineProvider,
      websiteProvider,
      pipelineProvider,
    } = createController();

    const updateDto = {
      siteName: 'Edge Cache Blog',
      baseUrl: 'https://example.com',
      enableComment: 'true',
    };

    const result = await controller.update(updateDto as any);

    expect(metaProvider.updateSiteInfo).toHaveBeenCalledWith(updateDto);
    expect(pipelineProvider.dispatchEvent).toHaveBeenCalledWith('updateSiteInfo', updateDto);
    expect(isrProvider.activeAll).toHaveBeenCalledWith('更新站点配置触发增量渲染！');
    expect(walineProvider.restart).toHaveBeenCalledWith('更新站点，');
    expect(websiteProvider.restart).toHaveBeenCalledWith('更新站点信息');
    expect(result).toEqual({
      statusCode: 200,
      data: { siteName: 'Edge Cache Blog' },
    });
  });

  it('tells the private site gate about the previous and new privateSite value', async () => {
    const { controller, metaProvider, privateSiteProvider } = createController();
    metaProvider.getSiteInfo.mockResolvedValueOnce({ siteName: 'VanBlog', privateSite: 'false' });

    await controller.update({ privateSite: 'true' } as any);

    expect(privateSiteProvider.handleSiteInfoUpdated).toHaveBeenCalledWith('false', 'true');
  });
});
