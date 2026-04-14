import { DraftProvider } from './draft.provider';

describe('DraftProvider', () => {
  it('imports drafts incrementally without rebuilding the structured draft table', async () => {
    const provider = new DraftProvider(
      {} as any,
      {} as any,
      {
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );
    provider.findOneByTitle = jest
      .fn()
      .mockResolvedValueOnce({ id: 10, title: 'Existing draft' })
      .mockResolvedValueOnce(null);
    provider.updateById = jest.fn().mockResolvedValue({ acknowledged: true } as any);
    provider.create = jest.fn().mockResolvedValue({ id: 11 } as any);

    await provider.importDrafts([
      { id: 1, title: 'Existing draft', content: 'updated' } as any,
      { id: 2, title: 'New draft', content: 'created' } as any,
    ]);

    expect(provider.updateById).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ title: 'Existing draft', deleted: false }),
    );
    expect(provider.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New draft', content: 'created' }),
    );
  });

  it('returns no drafts for blank searches without triggering a collection scan', async () => {
    const draftModel = {
      find: jest.fn(),
    };
    const provider = new DraftProvider(
      draftModel as any,
      {} as any,
      {
        searchDrafts: jest.fn().mockResolvedValue([]),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    const result = await provider.searchByString('   ');

    expect(result).toEqual([]);
    expect(draftModel.find).not.toHaveBeenCalled();
  });
});
