import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetaProvider } from './provider/meta/meta.provider';

describe('AppController', () => {
  let appController: AppController;
  const metaProvider = {
    getSiteInfo: jest.fn(),
  };

  beforeEach(async () => {
    metaProvider.getSiteInfo.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: MetaProvider,
          useValue: metaProvider,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('favicon', () => {
    it('redirects favicon.ico to the configured site icon', async () => {
      metaProvider.getSiteInfo.mockResolvedValue({
        favicon: 'https://blog.example.com/static/img/favicon.webp',
      });
      const res = {
        redirect: jest.fn(),
      } as any;

      await appController.getFavicon(res);

      expect(res.redirect).toHaveBeenCalledWith(
        'https://blog.example.com/static/img/favicon.webp',
      );
    });

    it('redirects the caddy-rewritten static favicon path to the configured site icon', async () => {
      metaProvider.getSiteInfo.mockResolvedValue({
        favicon: 'https://blog.example.com/static/img/favicon.webp',
      });
      const res = {
        redirect: jest.fn(),
      } as any;

      await appController.getRewrittenFavicon(res);

      expect(res.redirect).toHaveBeenCalledWith(
        'https://blog.example.com/static/img/favicon.webp',
      );
    });

    it('falls back to the admin logo when the site icon is empty', async () => {
      metaProvider.getSiteInfo.mockResolvedValue({
        favicon: '',
      });
      const res = {
        redirect: jest.fn(),
      } as any;

      await appController.getFavicon(res);

      expect(res.redirect).toHaveBeenCalledWith('/admin/logo.svg');
    });
  });
});
