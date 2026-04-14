import { ImgController } from './img.controller';

describe('ImgController', () => {
  it('clamps oversized admin image pagination before querying the provider', async () => {
    const staticProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, data: [] }),
    };
    const controller = new ImgController(staticProvider as any);

    await controller.getByOption('0' as any, '999' as any);

    expect(staticProvider.getByOption).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      staticType: 'img',
      view: 'public',
    });
  });
});
