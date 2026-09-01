import { createStorageModel } from './collection-model';

const createStore = (initial: any[] = []) => {
  const clone = (value: any) => JSON.parse(JSON.stringify(value));
  const data = initial.map((item) => clone(item));
  const store = {
    upsert: jest.fn(async (_collection: string, payload: any) => {
      const index = data.findIndex((item) => item._id === payload._id);
      const saved = clone(payload);
      if (index >= 0) data[index] = saved;
      else data.push(saved);
      return clone(saved);
    }),
    mutateRecords: jest.fn(async (
      _collection: string,
      plan: any,
      mutation: any,
      options: any,
    ) => {
      const records = data.map((payload) => ({
        recordId: String(payload._id),
        payload: clone(payload),
      }));
      return await mutation(records, {
        upsert: async (payload: any) => {
          const index = data.findIndex((item) => item._id === payload._id);
          const saved = clone(payload);
          if (index >= 0) data[index] = saved;
          else data.push(saved);
          return clone(saved);
        },
        deleteByIds: async (ids: string[]) => {
          let deleted = 0;
          for (let index = data.length - 1; index >= 0; index -= 1) {
            if (ids.includes(String(data[index]._id))) {
              data.splice(index, 1);
              deleted += 1;
            }
          }
          return deleted;
        },
      });
    }),
  };
  return { store, data };
};

describe('createStorageModel write paths', () => {
  it('updates one exact candidate and preserves atomic update operators', async () => {
    const { store, data } = createStore([
      { _id: 'a', status: 'active', viewer: 1 },
      { _id: 'b', status: 'inactive', viewer: 5 },
    ]);
    const Model = createStorageModel('items', store as any);

    await expect(
      Model.updateOne({ _id: 'a' }, { $inc: { viewer: 1 } }),
    ).resolves.toMatchObject({ matchedCount: 1, modifiedCount: 1 });

    expect(data.find((item) => item._id === 'a')?.viewer).toBe(2);
    expect(store.mutateRecords).toHaveBeenCalledWith(
      'items',
      expect.objectContaining({ exact: true, hasCandidate: true }),
      expect.any(Function),
      { limit: 1 },
    );
  });

  it('does not lose matches when an unsupported condition requires full fallback', async () => {
    const { store, data } = createStore([
      { _id: 'a', name: 'keep-one', enabled: false },
      { _id: 'b', name: 'drop', enabled: false },
    ]);
    const Model = createStorageModel('items', store as any);

    await Model.updateMany({ name: { $regex: '^keep' } }, { $set: { enabled: true } });

    expect(data).toEqual([
      { _id: 'a', name: 'keep-one', enabled: true },
      { _id: 'b', name: 'drop', enabled: false },
    ]);
    expect(store.mutateRecords.mock.calls[0][1]).toMatchObject({
      exact: false,
      hasCandidate: false,
      whereSql: 'TRUE',
    });
  });

  it('supports update upsert and findOneAndUpdate return modes', async () => {
    const { store, data } = createStore([{ _id: 'a', name: 'old', count: 1 }]);
    const Model = createStorageModel('items', store as any);

    await expect(
      Model.updateOne({ name: 'new' }, { $set: { count: 2 } }, { upsert: true }),
    ).resolves.toMatchObject({ upsertedCount: 1 });
    const previous = await Model.findOneAndUpdate(
      { _id: 'a' },
      { $inc: { count: 1 } },
      { new: false },
    );
    const current = await Model.findOneAndUpdate(
      { _id: 'a' },
      { $inc: { count: 1 } },
      { new: true },
    );

    expect(data.some((item) => item.name === 'new' && item.count === 2)).toBe(true);
    expect(previous.toObject()).toMatchObject({ count: 1 });
    expect(current.toObject()).toMatchObject({ count: 3 });
  });

  it('deletes one or many matched records through the mutation context', async () => {
    const { store, data } = createStore([
      { _id: 'a', group: 'x' },
      { _id: 'b', group: 'x' },
      { _id: 'c', group: 'y' },
    ]);
    const Model = createStorageModel('items', store as any);

    await expect(Model.deleteOne({ _id: 'a' })).resolves.toMatchObject({ deletedCount: 1 });
    await expect(Model.deleteMany({ group: 'x' })).resolves.toMatchObject({ deletedCount: 1 });

    expect(data).toEqual([{ _id: 'c', group: 'y' }]);
  });
});
