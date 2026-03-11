import sharp from 'sharp';

export interface MaskColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export async function generateDiffMask(
  screenshotBuffer: Buffer,
  diffMask: Buffer,
  width: number,
  height: number,
  color: MaskColor,
): Promise<Buffer> {
  const overlay = Buffer.alloc(width * height * 4);
  const alpha = Math.round(color.a * 255);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const hasDiff = diffMask[idx] > 0 || diffMask[idx + 1] > 0 || diffMask[idx + 2] > 0;

    if (hasDiff) {
      overlay[idx] = color.r;
      overlay[idx + 1] = color.g;
      overlay[idx + 2] = color.b;
      overlay[idx + 3] = alpha;
    } else {
      overlay[idx + 3] = 0;
    }
  }

  const overlayPng = await sharp(overlay, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  return sharp(screenshotBuffer)
    .composite([{ input: overlayPng, blend: 'over' }])
    .png()
    .toBuffer();
}
