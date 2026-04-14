import { MindMapProvider } from './mindmap.provider';

describe('MindMapProvider', () => {
  it('escapes regex metacharacters in title filters before querying fallback storage', async () => {
    const findChain = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    const mindMapModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockReturnValue(findChain),
    };
    const provider = new MindMapProvider(
      mindMapModel as any,
      {
        queryMindMaps: jest.fn().mockResolvedValue({ total: 0, mindMaps: [] }),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    await provider.getByOption({
      page: 1,
      pageSize: 10,
      title: '(draft+)+$',
    } as any);

    const query = mindMapModel.countDocuments.mock.calls[0][0];
    expect(query.$and[1].title.$regex).toEqual(/\(draft\+\)\+\$/i);
    expect(findChain.select).toHaveBeenCalled();
  });

  it('imports mind maps with targeted PG upserts instead of refreshing the whole table', async () => {
    const mindMapModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      upsertMindMap: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new MindMapProvider(mindMapModel as any, structuredDataService as any);

    await provider.importMindMaps([{ _id: 'map-1', title: 'Map', content: 'body' } as any]);

    expect(mindMapModel.updateOne).toHaveBeenCalledWith(
      { _id: 'map-1' },
      { _id: 'map-1', title: 'Map', content: 'body' },
      { upsert: true },
    );
    expect(structuredDataService.upsertMindMap).toHaveBeenCalledWith({
      _id: 'map-1',
      title: 'Map',
      content: 'body',
    });
  });

  it('returns no mind maps for blank searches without hitting the model fallback', async () => {
    const mindMapModel = {
      find: jest.fn(),
    };
    const provider = new MindMapProvider(
      mindMapModel as any,
      {
        searchMindMaps: jest.fn().mockResolvedValue([]),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    const result = await provider.searchByString('   ');

    expect(result).toEqual([]);
    expect(mindMapModel.find).not.toHaveBeenCalled();
  });

  it('falls back to the record store when structured list queries fail', async () => {
    const findChain = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ _id: 'map-1', title: 'Fallback map' }]),
    };
    const mindMapModel = {
      countDocuments: jest.fn().mockResolvedValue(1),
      find: jest.fn().mockReturnValue(findChain),
    };
    const provider = new MindMapProvider(
      mindMapModel as any,
      {
        queryMindMaps: jest
          .fn()
          .mockRejectedValue(new Error('relation "vanblog_mindmaps" does not exist')),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    const result = await provider.getByOption({ page: 1, pageSize: 10 } as any);

    expect(result.total).toBe(1);
    expect(result.mindMaps).toEqual([{ _id: 'map-1', title: 'Fallback map' }]);
    expect(mindMapModel.countDocuments).toHaveBeenCalled();
    expect(findChain.limit).toHaveBeenCalledWith(10);
  });

  it('does not fail creation when structured sync is temporarily unavailable', async () => {
    const savedMindMap = {
      _id: 'map-1',
      title: 'Map',
      content: 'body',
      toObject: jest.fn().mockReturnValue({
        _id: 'map-1',
        title: 'Map',
        content: 'body',
      }),
    };
    const save = jest.fn().mockResolvedValue(savedMindMap);
    const mindMapModel = jest.fn().mockImplementation(function (this: any, payload: any) {
      Object.assign(this, payload);
      this.save = save;
    });
    const provider = new MindMapProvider(
      mindMapModel as any,
      {
        upsertMindMap: jest.fn().mockRejectedValue(new Error('structured store offline')),
      } as any,
    );

    const result = await provider.create({ title: 'Map', content: 'body' } as any);

    expect(result).toBe(savedMindMap);
    expect(save).toHaveBeenCalled();
  });
});
