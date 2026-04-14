import { UnauthorizedException } from '@nestjs/common';
import { InitController } from './init.controller';

jest.mock('src/provider/log/utils', () => ({
  getNetIp: jest.fn(),
}));

const { getNetIp } = jest.requireMock('src/provider/log/utils') as {
  getNetIp: jest.Mock;
};

describe('InitController', () => {
  const createController = () => {
    const initProvider = {
      checkHasInited: jest.fn().mockResolvedValue(false),
      init: jest.fn().mockResolvedValue(undefined),
    };
    const staticProvider = {
      upload: jest.fn().mockResolvedValue({ src: '/static/img/test.png', isNew: false }),
    };
    const isrProvider = {
      activeAll: jest.fn(),
    };

    return {
      controller: new InitController(
        initProvider as any,
        staticProvider as any,
        isrProvider as any,
      ),
      initProvider,
      staticProvider,
      isrProvider,
    };
  };

  beforeEach(() => {
    getNetIp.mockReset();
  });

  it('rejects public initialization requests before the site is initialized', async () => {
    const { controller, initProvider, isrProvider } = createController();
    getNetIp.mockResolvedValue({ ip: '8.8.8.8', address: 'public' });

    await expect(controller.initSystem({} as any, { user: {}, siteInfo: {} } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(initProvider.init).not.toHaveBeenCalled();
    expect(isrProvider.activeAll).not.toHaveBeenCalled();
  });

  it('allows private initialization requests and triggers the full ISR warmup', async () => {
    const { controller, initProvider, isrProvider } = createController();
    getNetIp.mockResolvedValue({ ip: '', address: 'private' });

    const result = await controller.initSystem({} as any, { user: {}, siteInfo: {} } as any);

    expect(initProvider.init).toHaveBeenCalled();
    expect(isrProvider.activeAll).toHaveBeenCalled();
    expect(result).toEqual({
      statusCode: 200,
      message: '初始化成功!',
    });
  });

  it('rejects public initialization uploads before any file is written', async () => {
    const { controller, staticProvider } = createController();
    getNetIp.mockResolvedValue({ ip: '1.1.1.1', address: 'public' });

    await expect(
      controller.uploadImg({} as any, { originalname: 'favicon.png', buffer: Buffer.from('a') } as any, 'true'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(staticProvider.upload).not.toHaveBeenCalled();
  });
});
