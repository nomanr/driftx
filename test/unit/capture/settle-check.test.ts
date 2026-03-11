import { describe, it, expect } from 'vitest';
import { isScreenSettled } from '../../../src/capture/capture.js';
import sharp from 'sharp';

async function createTestPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

describe('isScreenSettled', () => {
  it('returns true for identical images', async () => {
    const img = await createTestPng(100, 100, { r: 255, g: 0, b: 0 });
    const result = isScreenSettled(img, img, 0.001);
    expect(result).toBe(true);
  });

  it('returns false for different images', async () => {
    const img1 = await createTestPng(100, 100, { r: 255, g: 0, b: 0 });
    const img2 = await createTestPng(100, 100, { r: 0, g: 255, b: 0 });
    const result = isScreenSettled(img1, img2, 0.001);
    expect(result).toBe(false);
  });

  it('returns false for images with different dimensions', async () => {
    const img1 = await createTestPng(100, 100, { r: 255, g: 0, b: 0 });
    const img2 = await createTestPng(200, 200, { r: 255, g: 0, b: 0 });
    const result = isScreenSettled(img1, img2, 0.001);
    expect(result).toBe(false);
  });
});
