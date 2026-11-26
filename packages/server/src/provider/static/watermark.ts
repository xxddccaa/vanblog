import { BlendMode, Jimp, JimpMime, loadFont } from 'jimp';

const { SANS_128_WHITE } = require('jimp/fonts') as {
  SANS_128_WHITE: string;
};

const getOutputMime = (buffer: Buffer) => {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return JimpMime.jpeg;
  }
  if (buffer.subarray(0, 2).toString('ascii') === 'BM') {
    return JimpMime.bmp;
  }
  return JimpMime.png;
};

export const addWaterMarkToIMG = async (srcImage: Buffer, waterMarkText: string) => {
  // 水印距离右下角百分比
  const LOGO_MARGIN_PERCENTAGE = 5 / 100;
  const logo = await generateWaterMark(waterMarkText);
  const image = await Jimp.read(srcImage);

  // 将 logo 等比缩小 10 倍
  // logo.resize(inputGif.width / 10, Jimp.AUTO);

  const xMargin = image.bitmap.width * LOGO_MARGIN_PERCENTAGE;
  const yMargin = image.bitmap.width * LOGO_MARGIN_PERCENTAGE;

  const X = image.bitmap.width - logo.bitmap.width - xMargin;
  const Y = image.bitmap.height - logo.bitmap.height - yMargin;

  //@ts-ignore
  const newImage = image.composite(logo, X, Y, {
    mode: BlendMode.SRC_OVER,
    opacitySource: 0.8,
    opacityDest: 1,
  });

  return await newImage.getBuffer(getOutputMime(srcImage));
};

export const generateWaterMark: any = async (waterMark: string) => {
  const font = await loadFont(SANS_128_WHITE);
  const logo = new Jimp({ width: 500, height: 150, color: 0x00000000 });
  logo.print({ font, x: 0, y: 0, text: waterMark, maxWidth: 500 });
  logo.color([{ apply: 'mix', params: [{ r: 167, g: 167, b: 167 }, 100] }]);
  return logo;
};
