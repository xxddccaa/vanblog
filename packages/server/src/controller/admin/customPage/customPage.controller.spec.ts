jest.mock('src/config', () => ({
  config: {
    demo: false,
  },
}));

import { config } from 'src/config';
import { CustomPageController } from './customPage.controller';

describe('CustomPageController', () => {
  afterEach(() => {
    (config as any).demo = false;
    jest.clearAllMocks();
  });

  it('blocks custom-page uploads in demo mode because they mutate filesystem content', async () => {
    (config as any).demo = true;
    const staticProvider = {
      upload: jest.fn(),
    };
    const controller = new CustomPageController(
      {} as any,
      staticProvider as any,
      {} as any,
    );

    const result = await controller.upload(
      {
        originalname: 'index.html',
        buffer: Buffer.from('demo'),
      },
      '/landing',
      'index.html',
    );

    expect(result).toEqual({
      statusCode: 401,
      message: '演示站禁止修改此项！',
    });
    expect(staticProvider.upload).not.toHaveBeenCalled();
  });
});
