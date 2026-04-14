import { BadRequestException } from '@nestjs/common';
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
