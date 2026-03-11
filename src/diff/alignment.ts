import sharp from 'sharp';
import type { LoadedImage } from './image-loader.js';
import { getLogger } from '../logger.js';

export interface AlignedImages {
  designPixels: Buffer;
  screenshotPixels: Buffer;
  width: number;
  height: number;
  aspectRatioWarning: boolean;
}

export async function alignImages(design: LoadedImage, screenshot: LoadedImage): Promise<AlignedImages> {
  const targetWidth = screenshot.width;
  const targetHeight = screenshot.height;
  const logger = getLogger();

  const aspectDiff = Math.abs(design.aspectRatio - screenshot.aspectRatio) / screenshot.aspectRatio;
  const aspectRatioWarning = aspectDiff > 0.05;

  if (aspectRatioWarning) {
    logger.warn(
      `Aspect ratio divergence: design=${design.aspectRatio.toFixed(3)} screenshot=${screenshot.aspectRatio.toFixed(3)} (${(aspectDiff * 100).toFixed(1)}%)`,
    );
  }

  let designPixels: Buffer;
  if (design.width === targetWidth && design.height === targetHeight) {
    designPixels = design.rawPixels;
  } else {
    designPixels = await sharp(design.buffer)
      .resize(targetWidth, targetHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer();
  }

  return {
    designPixels,
    screenshotPixels: screenshot.rawPixels,
    width: targetWidth,
    height: targetHeight,
    aspectRatioWarning,
  };
}
