import { BadRequestException } from '@nestjs/common';
import { LocalProvider } from './local.provider';

jest.mock('src/config', () => ({
  config: {
    staticPath: '/tmp/vanblog-static',
  },
}));

jest.mock('src/utils/checkFile', () => ({
  checkOrCreateFile: jest.fn(),
}));

jest.mock('src/utils/checkFolder', () => ({
  checkOrCreate: jest.fn(),
  checkOrCreateByFilePath: jest.fn(),
}));

jest.mock('src/utils/readFileList', () => ({
  readDirs: jest.fn(),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const { checkOrCreateFile } = jest.requireMock('src/utils/checkFile') as {
  checkOrCreateFile: jest.Mock;
};
const { checkOrCreate } = jest.requireMock('src/utils/checkFolder') as {
  checkOrCreate: jest.Mock;
};
const { readDirs } = jest.requireMock('src/utils/readFileList') as {
  readDirs: jest.Mock;
};
const fs = jest.requireMock('fs') as {
  readFileSync: jest.Mock;
  writeFileSync: jest.Mock;
};

describe('LocalProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects custom-page file writes that try to escape the custom page root', async () => {
    const provider = new LocalProvider();

    await expect(provider.createFile('/landing', '../outside.txt')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      provider.updateCustomPageFileContent('/landing', '../../etc/passwd', 'oops'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(checkOrCreateFile).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('keeps legitimate custom-page file operations inside the dedicated root', async () => {
    const provider = new LocalProvider();
    readDirs.mockReturnValue(['index.html']);
    fs.readFileSync.mockReturnValue('<html></html>');

    await provider.createFile('/landing', 'index.html');
    await provider.createFolder('/landing', 'assets');
    const files = await provider.getFolderFiles('/landing');
    const content = await provider.getFileContent('/landing', 'index.html');

    expect(checkOrCreateFile).toHaveBeenCalledWith('/tmp/vanblog-static/customPage/landing/index.html');
    expect(checkOrCreate).toHaveBeenCalledWith('/tmp/vanblog-static/customPage/landing/assets');
    expect(readDirs).toHaveBeenCalledWith(
      '/tmp/vanblog-static/customPage/landing',
      '/tmp/vanblog-static/customPage/landing',
    );
    expect(fs.readFileSync).toHaveBeenCalledWith(
      '/tmp/vanblog-static/customPage/landing/index.html',
      { encoding: 'utf-8' },
    );
    expect(files).toEqual(['index.html']);
    expect(content).toBe('<html></html>');
  });

  it('flattens img and music file names before touching the filesystem', async () => {
    const provider = new LocalProvider();
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kJ1cAAAAASUVORK5CYII=',
      'base64',
    );

    await provider.saveImg('../../../tmp/cover.png', pngBuffer, 'img');
    await provider.saveFile('../../../tmp/theme.mp3', Buffer.from('music'), 'music');

    expect(fs.writeFileSync).toHaveBeenNthCalledWith(
      1,
      '/tmp/vanblog-static/img/cover.png',
      pngBuffer,
    );
    expect(fs.writeFileSync).toHaveBeenNthCalledWith(
      2,
      '/tmp/vanblog-static/music/theme.mp3',
      Buffer.from('music'),
    );
  });
});
