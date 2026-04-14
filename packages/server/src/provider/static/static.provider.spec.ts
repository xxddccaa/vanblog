import { StaticProvider } from './static.provider';
import axios from 'axios';
import { HttpException } from '@nestjs/common';

jest.mock('axios');

const mockedAxios = axios as jest.MockedFunction<typeof axios>;
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kJ1cAAAAASUVORK5CYII=',
  'base64',
);
const SVG_BUFFER = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script></svg>',
);

describe('StaticProvider', () => {
  beforeEach(() => {
    mockedAxios.mockReset();
  });

  it('updates imported static items with targeted PG upserts instead of refreshing the whole table', async () => {
    const staticModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      upsertStatic: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      getStaticBySign: jest.fn().mockResolvedValue({
        _id: 'legacy-id',
        sign: 'abc',
        name: 'old.png',
        realPath: '/old.png',
        staticType: 'img',
        storageType: 'local',
      }),
    };
    const provider = new StaticProvider(
      staticModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      structuredDataService as any,
    );

    await provider.importItems([
      { sign: 'abc', name: 'new.png', realPath: '/new.png', staticType: 'img', storageType: 'local' } as any,
    ]);

    expect(staticModel.updateOne).toHaveBeenCalledWith(
      { _id: 'legacy-id' },
      expect.objectContaining({ sign: 'abc', name: 'new.png' }),
    );
    expect(structuredDataService.upsertStatic).toHaveBeenCalledWith(
      expect.objectContaining({ sign: 'abc', name: 'new.png', realPath: '/new.png' }),
    );
  });

  it('deletes using the PG static snapshot before removing the record from the model', async () => {
    const staticModel = {
      deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
    };
    const localProvider = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const structuredDataService = {
      isInitialized: jest.fn().mockReturnValue(true),
      getStaticBySign: jest.fn().mockResolvedValue({
        sign: 'abc',
        name: 'cover.png',
        realPath: '/img/cover.png',
        staticType: 'img',
        storageType: 'local',
      }),
      deleteStaticBySign: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new StaticProvider(
      staticModel as any,
      {} as any,
      {} as any,
      localProvider as any,
      {} as any,
      undefined,
      structuredDataService as any,
    );

    await provider.deleteOneBySign('abc');

    expect(localProvider.deleteFile).toHaveBeenCalledWith('cover.png', 'img');
    expect(staticModel.deleteOne).toHaveBeenCalledWith({ sign: 'abc' });
    expect(structuredDataService.deleteStaticBySign).toHaveBeenCalledWith('abc');
  });

  it('rejects private image urls before scanning them from article content', async () => {
    const provider = new StaticProvider(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      {} as any,
    );

    await expect(provider.fetchImg('http://127.0.0.1:3000/private.png')).resolves.toBeNull();
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('rejects svg uploads before they can be stored in the local static directory', async () => {
    const provider = new StaticProvider(
      {} as any,
      { getStaticSetting: jest.fn().mockResolvedValue({ enableWebp: false }) } as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      {} as any,
    );
    const saveFileSpy = jest.spyOn(provider, 'saveFile').mockResolvedValue('/static/img/blocked.svg');

    await expect(
      provider.upload(
        {
          originalname: 'payload.svg',
          buffer: SVG_BUFFER,
        },
        'img',
      ),
    ).rejects.toBeInstanceOf(HttpException);

    expect(saveFileSpy).not.toHaveBeenCalled();
  });

  it('strips traversal segments from uploaded image names before generating the storage path', async () => {
    const provider = new StaticProvider(
      {} as any,
      { getStaticSetting: jest.fn().mockResolvedValue({ enableWebp: false }) } as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      {} as any,
    );
    jest.spyOn(provider, 'getOneBySign').mockResolvedValue(null);
    const saveFileSpy = jest.spyOn(provider, 'saveFile').mockResolvedValue('/static/img/safe.png');

    await provider.upload(
      {
        originalname: '../../../tmp/evil.png',
        buffer: PNG_BUFFER,
      },
      'img',
    );

    expect(saveFileSpy).toHaveBeenCalledWith(
      'png',
      expect.stringMatching(/^[a-f0-9]{32}\.evil\.png$/),
      PNG_BUFFER,
      'img',
      expect.any(String),
      undefined,
    );
  });
});
