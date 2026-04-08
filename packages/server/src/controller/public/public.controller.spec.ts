import { PublicController } from './public.controller';

describe('PublicController', () => {
  const createController = () => {
    const metaProvider = {
      addViewer: jest.fn().mockResolvedValue({ total: 1 }),
    };

    const controller = new PublicController(
      {} as any,
      {} as any,
      {} as any,
      metaProvider as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { controller, metaProvider };
  };

  it('skips viewer updates when referer is missing', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.addViewer(true, false, {
      headers: {},
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: null,
    });
    expect(metaProvider.addViewer).not.toHaveBeenCalled();
  });

  it('skips viewer updates when referer is invalid', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.addViewer(true, false, {
      headers: {
        referer: 'not-a-valid-url',
      },
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: null,
    });
    expect(metaProvider.addViewer).not.toHaveBeenCalled();
  });

  it('records the decoded referer pathname when referer is valid', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.addViewer(true, false, {
      headers: {
        referer: 'https://blog.example.com/post/test%20article',
      },
    } as any);

    expect(metaProvider.addViewer).toHaveBeenCalledWith(true, '/post/test article', false);
    expect(result).toEqual({
      statusCode: 200,
      data: { total: 1 },
    });
  });
});
