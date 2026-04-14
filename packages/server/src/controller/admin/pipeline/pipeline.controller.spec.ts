import { PipelineController } from './pipeline.controller';

describe('PipelineController', () => {
  const createController = (overrides: Record<string, any> = {}) => {
    const pipelineProvider = {
      getPipelineById: jest.fn().mockResolvedValue({ id: 3, name: 'pipe' }),
      updatePipelineById: jest.fn().mockResolvedValue({ id: 3, name: 'updated pipe' }),
      deletePipelineById: jest.fn().mockResolvedValue({ acknowledged: true }),
      triggerById: jest.fn().mockResolvedValue({ ok: true }),
      getAll: jest.fn().mockResolvedValue([]),
      createPipeline: jest.fn().mockResolvedValue({ id: 3 }),
      ...overrides.pipelineProvider,
    };

    return {
      controller: new PipelineController(pipelineProvider as any),
      pipelineProvider,
    };
  };

  it('updates a pipeline when the route param is a string id', async () => {
    const { controller, pipelineProvider } = createController();

    const result = await controller.updatePipelineById('3', {
      name: 'updated pipe',
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: { id: 3, name: 'updated pipe' },
    });
    expect(pipelineProvider.updatePipelineById).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ name: 'updated pipe' }),
    );
  });

  it('rejects invalid pipeline ids before touching the provider', async () => {
    const { controller, pipelineProvider } = createController();

    const result = await controller.getPipelineById('abc');

    expect(result).toEqual({
      statusCode: 400,
      message: '流水线 ID 无效',
    });
    expect(pipelineProvider.getPipelineById).not.toHaveBeenCalled();
  });
});
