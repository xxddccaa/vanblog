jest.mock('fs', () => ({
  rmSync: jest.fn(),
}));

import { rmSync } from 'fs';
import { rmDir } from './deleteFolder';

describe('rmDir', () => {
  it('removes directories without invoking a shell', () => {
    rmDir('/tmp/vanblog/customPage/demo');

    expect(rmSync).toHaveBeenCalledWith('/tmp/vanblog/customPage/demo', {
      recursive: true,
      force: true,
    });
  });
});
