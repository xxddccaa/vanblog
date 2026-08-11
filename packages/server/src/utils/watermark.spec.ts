import { execFileSync } from 'node:child_process';

describe('watermark', () => {
  it('adds a watermark with the current Jimp API and preserves PNG output', async () => {
    const output = execFileSync(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        '-e',
        `
          const { Jimp, JimpMime } = require('jimp');
          const { addWaterMarkToIMG } = require('./src/utils/watermark');
          (async () => {
            const source = await new Jimp({
              width: 640,
              height: 320,
              color: 0x336699ff,
            }).getBuffer(JimpMime.png);
            const result = await addWaterMarkToIMG(source, 'VanBlog');
            process.stdout.write(result.subarray(0, 8).toString('hex'));
          })().catch((error) => {
            console.error(error);
            process.exit(1);
          });
        `,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15000,
      },
    );

    expect(output).toBe('89504e470d0a1a0a');
  });
});
