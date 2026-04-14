import { DocumentController } from './document.controller';

describe('DocumentController', () => {
  it('clamps oversized admin document pagination before querying the provider', async () => {
    const documentProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, documents: [] }),
    };
    const controller = new DocumentController(documentProvider as any, {} as any);

    await controller.getByOption('0' as any, '999' as any, false as any);

    expect(documentProvider.getByOption).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
    );
  });
});
