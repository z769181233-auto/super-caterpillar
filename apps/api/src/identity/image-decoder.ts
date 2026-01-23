import sharp from 'sharp';
import { DecodeRGBA } from './ppv64';

export const nodeSharpDecoder: DecodeRGBA = async (absPath: string) => {
  const { data, info } = await sharp(absPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    width: info.width,
    height: info.height,
    rgba: new Uint8Array(data),
  };
};
