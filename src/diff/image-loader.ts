import sharp from 'sharp';
import * as fs from 'node:fs';

export interface LoadedImage {
  buffer: Buffer;
  width: number;
  height: number;
  aspectRatio: number;
  rawPixels: Buffer;
}

export async function loadImage(filePath: string): Promise<LoadedImage> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image not found: ${filePath}`);
  }

  const input = fs.readFileSync(filePath);
  const metadata = await sharp(input).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Invalid image: could not read dimensions from ${filePath}`);
  }

  const rawPixels = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer();

  return {
    buffer: input,
    width: metadata.width,
    height: metadata.height,
    aspectRatio: metadata.width / metadata.height,
    rawPixels,
  };
}
