import { DraftController } from './draft.controller';

describe('DraftController', () => {
  const createController = (overrides: Record<string, any> = {}) => {
    const draftProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, drafts: [] }),
      updateById: jest
        .fn()
        .mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }),
      findById: jest.fn().mockResolvedValue({ id: 80, title: 'draft title' }),
      deleteById: jest.fn().mockResolvedValue({ acknowledged: true }),
      ...overrides.draftProvider,
    };
    const pipelineProvider = {
      dispatchEvent: jest.fn().mockResolvedValue([]),
      ...overrides.pipelineProvider,
    };
    const searchIndexProvider = {
      generateSearchIndex: jest.fn(),
      ...overrides.searchIndexProvider,
    };

    return {
      controller: new DraftController(
        draftProvider as any,
        {} as any,
        { activeAll: jest.fn() } as any,
        pipelineProvider as any,
        {} as any,
        {} as any,
        searchIndexProvider as any,
      ),
      draftProvider,
      pipelineProvider,
      searchIndexProvider,
    };
  };

  it('clamps oversized admin draft pagination before querying the provider', async () => {
    const { controller, draftProvider } = createController();

    await controller.getByOption('0' as any, '999' as any, false as any);

    expect(draftProvider.getByOption).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
    );
  });

  it('updates a draft when the route param is a string id', async () => {
    const { controller, draftProvider, pipelineProvider, searchIndexProvider } = createController();

    const result = await controller.update(
      '80' as any,
      {
        content: 'updated content',
      } as any,
    );

    expect(result).toEqual({
      statusCode: 200,
      data: { acknowledged: true, matchedCount: 1, modifiedCount: 1 },
    });
    expect(draftProvider.updateById).toHaveBeenCalledWith(
      80,
      expect.objectContaining({ content: 'updated content' }),
    );
    expect(draftProvider.findById).toHaveBeenCalledWith(80);
    expect(pipelineProvider.dispatchEvent).toHaveBeenCalledWith(
      'afterUpdateDraft',
      expect.objectContaining({ id: 80 }),
    );
    expect(searchIndexProvider.generateSearchIndex).toHaveBeenCalledWith(
      '更新草稿触发搜索索引同步',
      500,
    );
  });
});
