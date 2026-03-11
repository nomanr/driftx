import pixelmatch from 'pixelmatch';
import type { AlignedImages } from './alignment.js';

export interface PixelDiffResult {
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
  diffMask: Buffer;
  width: number;
  height: number;
}

export function computePixelDiff(aligned: AlignedImages, threshold: number): PixelDiffResult {
  const { width, height, designPixels, screenshotPixels } = aligned;
  const totalPixels = width * height;
  const diffMask = Buffer.alloc(width * height * 4);

  const diffPixels = pixelmatch(
    designPixels, screenshotPixels, diffMask,
    width, height,
    { threshold, includeAA: false },
  );

  return {
    diffPixels,
    totalPixels,
    diffPercentage: totalPixels > 0 ? (diffPixels / totalPixels) * 100 : 0,
    diffMask,
    width,
    height,
  };
}
