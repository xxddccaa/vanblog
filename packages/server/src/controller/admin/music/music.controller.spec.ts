import { MusicController } from './music.controller';

describe('MusicController', () => {
  it('clamps oversized admin music pagination before querying the provider', async () => {
    const staticProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, data: [] }),
    };
    const controller = new MusicController(staticProvider as any, {} as any, {} as any);

    await controller.getByOption('0' as any, '999' as any);

    expect(staticProvider.getByOption).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      staticType: 'music',
      view: 'public',
    });
  });

  it('accepts valid audio extensions from the sanitized basename and forwards the upload', async () => {
    const staticProvider = {
      upload: jest.fn().mockResolvedValue({ src: '/static/music/demo.mp3', isNew: true }),
    };
    const isrProvider = {
      activeAll: jest.fn(),
    };
    const controller = new MusicController(staticProvider as any, {} as any, isrProvider as any);

    const result = await controller.upload({
      originalname: '../../../tmp/demo.mp3',
      buffer: Buffer.from('music'),
    } as any);

    expect(staticProvider.upload).toHaveBeenCalled();
    expect(result).toEqual({
      statusCode: 200,
      data: { src: '/static/music/demo.mp3', isNew: true },
    });
  });
});
