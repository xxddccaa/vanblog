import { MindMapController } from './mindmap.controller';

describe('MindMapController', () => {
  it('clamps oversized admin mind map pagination before querying the provider', async () => {
    const mindMapProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, mindMaps: [] }),
    };
    const controller = new MindMapController(mindMapProvider as any, {} as any);

    await controller.getByOption('0' as any, '999' as any);

    expect(mindMapProvider.getByOption).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
    );
  });
});
