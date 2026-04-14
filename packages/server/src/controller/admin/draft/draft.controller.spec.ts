import { DraftController } from './draft.controller';

describe('DraftController', () => {
  it('clamps oversized admin draft pagination before querying the provider', async () => {
    const draftProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, drafts: [] }),
    };
    const controller = new DraftController(
      draftProvider as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await controller.getByOption('0' as any, '999' as any, false as any);

    expect(draftProvider.getByOption).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
    );
  });
});
