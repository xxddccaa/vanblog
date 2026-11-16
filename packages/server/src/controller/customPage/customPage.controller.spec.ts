import { BadRequestException, HttpException } from '@nestjs/common';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PublicMaskProvider } from 'src/provider/public-mask/public-mask.provider';
import { defaultPublicMaskSetting } from 'src/utils/publicMask';
import {
  PublicCustomPageController,
  PublicOldCustomPageRedirectController,
} from './customPage.controller';

describe('PublicCustomPageController', () => {
  const createResponse = () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      sendFile: jest.fn((_path: string, callback?: (error?: any) => void) => {
        callback?.();
      }),
      redirect: jest.fn(),
      headersSent: false,
    };
    return response;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('with masking', () => {
    const createMaskProvider = () =>
      new PublicMaskProvider({
        getSetting: jest.fn().mockResolvedValue({
          value: {
            ...defaultPublicMaskSetting,
            enabled: true,
            replacements: {
              custom: 'X-CUSTOM-X',
              secret: 'X-SECRET-X',
              email: 'X-EMAIL-X',
              ip: 'X-IP-X',
            },
            rules: [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
          },
        }),
      } as any);
    const createMaskedResponse = () => ({
      ...createResponse(),
      setHeader: jest.fn(),
      type: jest.fn(),
      end: jest.fn(),
    });

    it('masks file page html', async () => {
      const controller = new PublicCustomPageController(
        {
          getCustomPageByPath: jest
            .fn()
            .mockResolvedValue({ path: '/about', type: 'file', html: '<p>acmecore</p>' }),
        } as any,
        {} as any,
        createMaskProvider(),
      );
      const res = createMaskedResponse();

      await controller.getPageContent(
        'about',
        res as any,
        { path: '/c/about', url: '/c/about' } as any,
      );

      expect(res.send).toHaveBeenCalledWith('<p>X-CUSTOM-X</p>');
    });

    it('masks text assets of folder pages and refuses paths with masked terms', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vanblog-custom-page-'));
      const assetPath = path.join(dir, 'index.html');
      fs.writeFileSync(assetPath, '<h1>acmecore</h1>');
      try {
        const customPageProvider = {
          getCustomPageByPath: jest.fn().mockResolvedValue({ path: '/landing', type: 'folder' }),
        };
        const controller = new PublicCustomPageController(
          customPageProvider as any,
          { resolveCustomPageAssetPath: jest.fn().mockReturnValue(assetPath) } as any,
          createMaskProvider(),
        );
        const res = createMaskedResponse();

        await controller.getPageContent(
          'landing',
          res as any,
          { path: '/c/landing/', url: '/c/landing/', headers: {} } as any,
        );

        expect(res.send).toHaveBeenCalledWith('<h1>X-CUSTOM-X</h1>');
        expect(res.sendFile).not.toHaveBeenCalled();

        await expect(
          controller.getPageContent(
            'acmecore-runbook',
            createMaskedResponse() as any,
            { path: '/c/acmecore-runbook', url: '/c/acmecore-runbook', headers: {} } as any,
          ),
        ).rejects.toBeInstanceOf(HttpException);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  it('serves nested assets from the nearest registered folder custom page', async () => {
    const customPageProvider = {
      getCustomPageByPath: jest.fn().mockImplementation(async (path: string) => {
        if (path === '/landing/assets/app.js') {
          return null;
        }
        if (path === '/landing/assets') {
          return null;
        }
        if (path === '/landing') {
          return {
            path: '/landing',
            type: 'folder',
          };
        }
        return null;
      }),
    };
    const staticProvider = {
      resolveCustomPageAssetPath: jest
        .fn()
        .mockReturnValue('/tmp/vanblog-static/customPage/landing/assets/app.js'),
    };
    const controller = new PublicCustomPageController(
      customPageProvider as any,
      staticProvider as any,
    );
    const res = createResponse();

    await controller.getPageContent(
      'landing/assets/app.js',
      res as any,
      {
        path: '/c/landing/assets/app.js',
        url: '/c/landing/assets/app.js',
      } as any,
    );

    expect(customPageProvider.getCustomPageByPath).toHaveBeenNthCalledWith(
      1,
      '/landing/assets/app.js',
    );
    expect(customPageProvider.getCustomPageByPath).toHaveBeenNthCalledWith(2, '/landing/assets');
    expect(customPageProvider.getCustomPageByPath).toHaveBeenNthCalledWith(3, '/landing');
    expect(staticProvider.resolveCustomPageAssetPath).toHaveBeenCalledWith(
      '/landing',
      'assets/app.js',
    );
    expect(res.sendFile).toHaveBeenCalledWith(
      '/tmp/vanblog-static/customPage/landing/assets/app.js',
      expect.any(Function),
    );
  });

  it('rejects traversal-like custom page requests before resolving any filesystem path', async () => {
    const customPageProvider = {
      getCustomPageByPath: jest.fn(),
    };
    const staticProvider = {
      resolveCustomPageAssetPath: jest.fn(),
    };
    const controller = new PublicCustomPageController(
      customPageProvider as any,
      staticProvider as any,
    );
    const res = createResponse();

    await expect(
      controller.getPageContent(
        'landing/../secret.txt',
        res as any,
        {
          path: '/c/landing/../secret.txt',
          url: '/c/landing/../secret.txt',
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(customPageProvider.getCustomPageByPath).not.toHaveBeenCalled();
    expect(staticProvider.resolveCustomPageAssetPath).not.toHaveBeenCalled();
  });

  it('renders file-based custom pages directly from stored html', async () => {
    const customPageProvider = {
      getCustomPageByPath: jest.fn().mockResolvedValue({
        path: '/edge',
        type: 'file',
        html: '<h1>edge</h1>',
      }),
    };
    const controller = new PublicCustomPageController(customPageProvider as any, {} as any);
    const res = createResponse();

    await controller.getPageContent(
      'edge',
      res as any,
      {
        path: '/c/edge',
        url: '/c/edge',
      } as any,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('<h1>edge</h1>');
  });
});

describe('PublicOldCustomPageRedirectController', () => {
  it('redirects legacy /custom routes to /c', async () => {
    const controller = new PublicOldCustomPageRedirectController();
    const res = {
      redirect: jest.fn(),
    };

    await controller.redirect(res as any, { url: '/custom/edge' } as any);

    expect(res.redirect).toHaveBeenCalledWith(301, '/c/edge');
  });
});
