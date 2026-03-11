import { describe, it, expect } from 'vitest';
import { extractRegions } from '../../../src/diff/region-extractor.js';

function createMask(width: number, height: number, regions: Array<{ x: number; y: number; w: number; h: number }>): Buffer {
  const mask = Buffer.alloc(width * height * 4, 0);
  for (const r of regions) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const idx = (y * width + x) * 4;
        mask[idx] = 255;
        mask[idx + 1] = 0;
        mask[idx + 2] = 0;
        mask[idx + 3] = 255;
      }
    }
  }
  return mask;
}

describe('extractRegions', () => {
  it('finds a single region', () => {
    const mask = createMask(100, 100, [{ x: 10, y: 10, w: 30, h: 30 }]);
    const regions = extractRegions(mask, 100, 100, { mergeGap: 10, minArea: 25 });
    expect(regions).toHaveLength(1);
    expect(regions[0].bounds.x).toBeGreaterThanOrEqual(10);
    expect(regions[0].bounds.width).toBeLessThanOrEqual(30);
  });

  it('finds two separate regions', () => {
    const mask = createMask(100, 100, [
      { x: 5, y: 5, w: 20, h: 20 },
      { x: 70, y: 70, w: 20, h: 20 },
    ]);
    const regions = extractRegions(mask, 100, 100, { mergeGap: 10, minArea: 25 });
    expect(regions).toHaveLength(2);
  });

  it('merges close regions', () => {
    const mask = createMask(100, 100, [
      { x: 10, y: 10, w: 10, h: 10 },
      { x: 25, y: 10, w: 10, h: 10 },
    ]);
    const regions = extractRegions(mask, 100, 100, { mergeGap: 10, minArea: 25 });
    expect(regions).toHaveLength(1);
  });

  it('discards tiny regions below minArea', () => {
    const mask = createMask(100, 100, [{ x: 10, y: 10, w: 3, h: 3 }]);
    const regions = extractRegions(mask, 100, 100, { mergeGap: 10, minArea: 25 });
    expect(regions).toHaveLength(0);
  });

  it('returns empty for no-diff mask', () => {
    const mask = Buffer.alloc(100 * 100 * 4, 0);
    const regions = extractRegions(mask, 100, 100, { mergeGap: 10, minArea: 25 });
    expect(regions).toHaveLength(0);
  });

  it('computes pixel count for each region', () => {
    const mask = createMask(100, 100, [{ x: 10, y: 10, w: 20, h: 20 }]);
    const regions = extractRegions(mask, 100, 100, { mergeGap: 10, minArea: 25 });
    expect(regions[0].pixelCount).toBeGreaterThan(0);
  });
});
