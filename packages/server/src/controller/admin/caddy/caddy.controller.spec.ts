import { BadRequestException } from '@nestjs/common';
import { CaddyController } from './caddy.controller';

describe('CaddyController', () => {
  const createController = ({
    manageHttps = true,
    baseUrl = 'https://blog.example.com',
  }: {
    manageHttps?: boolean;
    baseUrl?: string;
  } = {}) => {
    const settingProvider = {
      getHttpsSetting: jest.fn(),
    };
    const caddyProvider = {
      isHttpsManagedByVanblog: jest.fn().mockReturnValue(manageHttps),
    };
    const metaProvider = {
      getSiteInfo: jest.fn().mockResolvedValue({ baseUrl }),
    };

    return {
      controller: new CaddyController(
        settingProvider as any,
        caddyProvider as any,
        metaProvider as any,
      ),
      caddyProvider,
      metaProvider,
    };
  };

  it('only allows on-demand certificates for the configured site host', async () => {
    const { controller } = createController();

    await expect(controller.askOnDemand('blog.example.com')).resolves.toBe(
      'is Domain, on damand https',
    );
  });

  it('rejects on-demand certificates for domains outside siteInfo.baseUrl', async () => {
    const { controller } = createController();

    await expect(controller.askOnDemand('attacker.example.net')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects on-demand certificates when built-in https management is disabled', async () => {
    const { controller } = createController({ manageHttps: false });

    await expect(controller.askOnDemand('blog.example.com')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects on-demand certificates when baseUrl is missing or invalid', async () => {
    const missingBaseUrl = createController({ baseUrl: '' });
    const invalidBaseUrl = createController({ baseUrl: 'not-a-url' });

    await expect(missingBaseUrl.controller.askOnDemand('blog.example.com')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(invalidBaseUrl.controller.askOnDemand('blog.example.com')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects ipv4 addresses for on-demand certificates', async () => {
    const { controller } = createController();

    await expect(controller.askOnDemand('1.2.3.4')).rejects.toBeInstanceOf(BadRequestException);
  });
});
