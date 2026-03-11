import sharp from 'sharp';
import type { BoundingBox } from '../../src/types.js';

export interface TestImage {
  buffer: Buffer;
  width: number;
  height: number;
}

export async function createSolid(width: number, height: number, color: { r: number; g: number; b: number }): Promise<TestImage> {
  const buffer = await sharp({
    create: { width, height, channels: 4, background: { ...color, alpha: 255 } },
  }).png().toBuffer();
  return { buffer, width, height };
}

export async function createWithRegion(
  width: number,
  height: number,
  baseColor: { r: number; g: number; b: number },
  region: { x: number; y: number; w: number; h: number; color: { r: number; g: number; b: number } },
): Promise<TestImage> {
  const overlay = await sharp({
    create: { width: region.w, height: region.h, channels: 4, background: { ...region.color, alpha: 255 } },
  }).png().toBuffer();

  const buffer = await sharp({
    create: { width, height, channels: 4, background: { ...baseColor, alpha: 255 } },
  })
    .composite([{ input: overlay, left: region.x, top: region.y }])
    .png()
    .toBuffer();

  return { buffer, width, height };
}

export async function createDiffPair(
  width: number,
  height: number,
  baseColor: { r: number; g: number; b: number },
  diffs: Array<{ bounds: BoundingBox; designColor: { r: number; g: number; b: number }; screenshotColor: { r: number; g: number; b: number } }>,
): Promise<{ design: TestImage; screenshot: TestImage; expectedRegions: BoundingBox[] }> {
  const designOverlays = await Promise.all(
    diffs.map(async (d) => ({
      input: await sharp({
        create: { width: d.bounds.width, height: d.bounds.height, channels: 4 as const, background: { ...d.designColor, alpha: 255 } },
      }).png().toBuffer(),
      left: d.bounds.x,
      top: d.bounds.y,
    })),
  );

  const screenshotOverlays = await Promise.all(
    diffs.map(async (d) => ({
      input: await sharp({
        create: { width: d.bounds.width, height: d.bounds.height, channels: 4 as const, background: { ...d.screenshotColor, alpha: 255 } },
      }).png().toBuffer(),
      left: d.bounds.x,
      top: d.bounds.y,
    })),
  );

  const designBuf = await sharp({
    create: { width, height, channels: 4, background: { ...baseColor, alpha: 255 } },
  }).composite(designOverlays).png().toBuffer();

  const screenshotBuf = await sharp({
    create: { width, height, channels: 4, background: { ...baseColor, alpha: 255 } },
  }).composite(screenshotOverlays).png().toBuffer();

  return {
    design: { buffer: designBuf, width, height },
    screenshot: { buffer: screenshotBuf, width, height },
    expectedRegions: diffs.map((d) => d.bounds),
  };
}
