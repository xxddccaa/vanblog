jest.mock('src/config', () => ({
  config: {
    demo: false,
  },
}));

import { config } from 'src/config';
import { TokenController } from './token.controller';

describe('TokenController', () => {
  afterEach(() => {
    (config as any).demo = false;
    jest.clearAllMocks();
  });

  it('blocks token creation when demo mode is enabled as a boolean flag', async () => {
    (config as any).demo = true;
    const tokenProvider = {
      createAPIToken: jest.fn(),
    };
    const controller = new TokenController(tokenProvider as any);

    const result = await controller.createApiToken({ name: 'demo-token' });

    expect(result).toEqual({
      statusCode: 401,
      message: '演示站禁止修改此项！',
    });
    expect(tokenProvider.createAPIToken).not.toHaveBeenCalled();
  });

  it('blocks token deletion when demo mode is enabled as a boolean flag', async () => {
    (config as any).demo = true;
    const tokenProvider = {
      disableAPITokenById: jest.fn(),
    };
    const controller = new TokenController(tokenProvider as any);

    const result = await controller.deleteApiTokenByName('1');

    expect(result).toEqual({
      statusCode: 401,
      message: '演示站禁止修改此项！',
    });
    expect(tokenProvider.disableAPITokenById).not.toHaveBeenCalled();
  });
});
