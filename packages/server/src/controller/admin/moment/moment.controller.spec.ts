import { MomentController } from './moment.controller';

describe('MomentController', () => {
  const createController = (overrides: Record<string, any> = {}) => {
    const momentProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, moments: [] }),
      updateById: jest.fn().mockResolvedValue({ id: 5, content: 'updated moment' }),
      deleteById: jest.fn().mockResolvedValue(undefined),
      getById: jest.fn().mockResolvedValue({ id: 5, content: 'moment content' }),
      ...overrides.momentProvider,
    };
    const isrProvider = {
      activeAll: jest.fn(),
      ...overrides.isrProvider,
    };

    return {
      controller: new MomentController(momentProvider as any, isrProvider as any),
      momentProvider,
      isrProvider,
    };
  };

  it('clamps oversized admin moment pagination before querying the provider', async () => {
    const { controller, momentProvider } = createController();

    await controller.getByOption('0' as any, '999' as any);

    expect(momentProvider.getByOption).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
      false,
    );
  });

  it('updates a moment when the route param is a string id', async () => {
    const { controller, momentProvider, isrProvider } = createController();

    const result = await controller.update(
      '5' as any,
      {
        content: 'updated moment',
      } as any,
    );

    expect(result).toEqual({
      statusCode: 200,
      data: { id: 5, content: 'updated moment' },
    });
    expect(momentProvider.updateById).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ content: 'updated moment' }),
    );
    expect(isrProvider.activeAll).toHaveBeenCalledWith('更新动态触发增量渲染！');
  });
});
