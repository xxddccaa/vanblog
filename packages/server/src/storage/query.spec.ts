import { StorageQuery } from './query';

const wrapDocument = (value: any) => ({ wrapped: true, ...value });

describe('StorageQuery', () => {
  it('pushes exact filtering, sorting and pagination into PostgreSQL', async () => {
    const store = {
      getRecords: jest.fn().mockResolvedValue([
        { recordId: '2', payload: { _id: '2', id: 2, status: 'active' } },
      ]),
      getAll: jest.fn(),
      countRecords: jest.fn(),
    };
    const query = new StorageQuery(
      store as any,
      'items',
      { status: 'active' },
      wrapDocument,
      'many',
    )
      .sort({ id: 1 })
      .skip(1)
      .limit(1)
      .lean();

    await expect(query.exec()).resolves.toEqual([
      { _id: '2', id: 2, status: 'active' },
    ]);
    expect(store.getRecords).toHaveBeenCalledWith(
      'items',
      expect.objectContaining({ exact: true, hasCandidate: true }),
      expect.objectContaining({
        skip: 1,
        limit: 1,
        sortPlan: expect.objectContaining({ exact: true }),
      }),
    );
    expect(store.getAll).not.toHaveBeenCalled();
  });

  it('uses a partial AND candidate without pushing skip or limit', async () => {
    const store = {
      getRecords: jest.fn().mockResolvedValue([
        { recordId: '1', payload: { _id: '1', id: 1, status: 'active', name: 'keep-a' } },
        { recordId: '2', payload: { _id: '2', id: 2, status: 'active', name: 'drop' } },
        { recordId: '3', payload: { _id: '3', id: 3, status: 'active', name: 'keep-b' } },
      ]),
      getAll: jest.fn(),
      countRecords: jest.fn(),
    };
    const query = new StorageQuery(
      store as any,
      'items',
      {
        $and: [{ status: 'active' }, { name: { $regex: '^keep' } }],
      },
      wrapDocument,
      'many',
    )
      .sort({ id: 1 })
      .skip(1)
      .limit(1)
      .lean();

    await expect(query.exec()).resolves.toEqual([
      { _id: '3', id: 3, status: 'active', name: 'keep-b' },
    ]);
    expect(store.getRecords).toHaveBeenCalledWith(
      'items',
      expect.objectContaining({ exact: false, hasCandidate: true }),
      expect.objectContaining({ skip: undefined, limit: undefined }),
    );
  });

  it('uses the full fallback for an OR with an unsupported branch', async () => {
    const store = {
      getRecords: jest.fn(),
      getAll: jest.fn().mockResolvedValue([
        { _id: '1', status: 'inactive', name: 'keep-me' },
      ]),
      countRecords: jest.fn(),
    };
    const query = new StorageQuery(
      store as any,
      'items',
      {
        $or: [{ status: 'active' }, { name: { $regex: '^keep' } }],
      },
      wrapDocument,
      'many',
    ).lean();

    await expect(query.exec()).resolves.toEqual([
      { _id: '1', status: 'inactive', name: 'keep-me' },
    ]);
    expect(store.getAll).toHaveBeenCalledWith('items');
    expect(store.getRecords).not.toHaveBeenCalled();
  });

  it('uses SQL count only for exact filters', async () => {
    const exactStore = {
      countRecords: jest.fn().mockResolvedValue(4),
      getRecords: jest.fn(),
      getAll: jest.fn(),
    };
    const partialStore = {
      countRecords: jest.fn(),
      getRecords: jest.fn().mockResolvedValue([
        { recordId: '1', payload: { status: 'active', name: 'keep' } },
        { recordId: '2', payload: { status: 'active', name: 'drop' } },
      ]),
      getAll: jest.fn(),
    };

    await expect(
      new StorageQuery(
        exactStore as any,
        'items',
        { status: 'active' },
        wrapDocument,
        'count',
      ).exec(),
    ).resolves.toBe(4);
    await expect(
      new StorageQuery(
        partialStore as any,
        'items',
        { status: 'active', name: { $regex: '^keep' } },
        wrapDocument,
        'count',
      ).exec(),
    ).resolves.toBe(1);

    expect(exactStore.countRecords).toHaveBeenCalledTimes(1);
    expect(partialStore.countRecords).not.toHaveBeenCalled();
  });

  it('preserves projection, lean and wrapped document behavior', async () => {
    const store = {
      getRecords: jest.fn().mockResolvedValue([
        {
          recordId: '1',
          payload: { _id: '1', name: 'alpha', secret: 'hidden' },
        },
      ]),
      getAll: jest.fn(),
      countRecords: jest.fn(),
    };

    const lean = new StorageQuery(
      store as any,
      'items',
      { name: 'alpha' },
      wrapDocument,
      'many',
      { name: 1, _id: 0 },
    ).lean();
    const wrapped = new StorageQuery(
      store as any,
      'items',
      { name: 'alpha' },
      wrapDocument,
      'one',
    );

    await expect(lean.exec()).resolves.toEqual([{ name: 'alpha' }]);
    await expect(wrapped.exec()).resolves.toEqual({
      wrapped: true,
      _id: '1',
      name: 'alpha',
      secret: 'hidden',
    });
  });
});
