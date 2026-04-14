import { MindMapProvider } from './mindmap.provider';

describe('MindMapProvider', () => {
  const createProvider = (overrides: Record<string, any> = {}) => {
    const model = Object.assign(
      function MockMindMapModel(this: any, payload: any) {
        Object.assign(this, payload);
        this.save = jest.fn().mockResolvedValue({
          ...payload,
          _id: 'mongo-id',
          toObject: () => ({ ...payload, _id: 'mongo-id' }),
        });
      },
      {
        findByIdAndUpdate: jest.fn(),
        findById: jest.fn(),
        findOne: jest.fn(),
        updateOne: jest.fn(),
        countDocuments: jest.fn(),
        find: jest.fn(),
      },
      overrides.model,
    );

    const structuredDataService = {
      isInitialized: jest.fn().mockReturnValue(true),
      getMindMapById: jest.fn(),
      upsertMindMap: jest.fn().mockResolvedValue(undefined),
      queryMindMaps: jest.fn(),
      searchMindMaps: jest.fn(),
      listMindMaps: jest.fn(),
      ...overrides.structuredDataService,
    };

    return {
      provider: new MindMapProvider(model as any, structuredDataService as any),
      model,
      structuredDataService,
    };
  };

  it('creates a mind map directly in structured storage when pg mode is active', async () => {
    const { provider, structuredDataService } = createProvider();

    const result = await provider.create({
      title: 'PG mind map',
      content: '{}',
    });

    expect(structuredDataService.upsertMindMap).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: expect.any(String),
        title: 'PG mind map',
        content: '{}',
        viewer: 0,
        deleted: false,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        _id: expect.any(String),
        title: 'PG mind map',
      }),
    );
  });

  it('updates a mind map directly in structured storage when pg mode is active', async () => {
    const existing = {
      _id: 'mindmap-1',
      title: 'Old',
      content: '{}',
      viewer: 2,
      deleted: false,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    };
    const { provider, structuredDataService, model } = createProvider({
      structuredDataService: {
        getMindMapById: jest.fn().mockResolvedValue(existing),
      },
    });

    const result = await provider.updateById('mindmap-1', {
      title: 'New',
    });

    expect(structuredDataService.upsertMindMap).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'mindmap-1',
        title: 'New',
        viewer: 2,
      }),
    );
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        _id: 'mindmap-1',
        title: 'New',
      }),
    );
  });

  it('increments viewer directly in structured storage when pg mode is active', async () => {
    const existing = {
      _id: 'mindmap-2',
      title: 'Views',
      content: '{}',
      viewer: 7,
      deleted: false,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    };
    const { provider, structuredDataService, model } = createProvider({
      structuredDataService: {
        getMindMapById: jest.fn().mockResolvedValue(existing),
      },
    });

    await provider.incrementViewer('mindmap-2');

    expect(structuredDataService.upsertMindMap).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'mindmap-2',
        viewer: 8,
      }),
    );
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
