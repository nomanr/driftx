import { describe, it, expect } from 'vitest';
import { filterByIgnoreRules } from '../../../src/diff/ignore-rules.js';
import type { DiffRegion, IgnoreRule, BoundingBox } from '../../../src/types.js';

function makeRegion(id: string, bounds: BoundingBox): DiffRegion {
  return { id, bounds, pixelCount: bounds.width * bounds.height, percentage: 1 };
}

describe('filterByIgnoreRules', () => {
  it('filters region overlapping ignored bounding box', () => {
    const regions = [makeRegion('r-0', { x: 10, y: 10, width: 50, height: 50 })];
    const rules: IgnoreRule[] = [{ type: 'boundingBox', value: { x: 0, y: 0, width: 100, height: 100 } }];
    const filtered = filterByIgnoreRules(regions, rules);
    expect(filtered).toHaveLength(0);
  });

  it('keeps region outside ignored bounding box', () => {
    const regions = [makeRegion('r-0', { x: 200, y: 200, width: 50, height: 50 })];
    const rules: IgnoreRule[] = [{ type: 'boundingBox', value: { x: 0, y: 0, width: 100, height: 100 } }];
    const filtered = filterByIgnoreRules(regions, rules);
    expect(filtered).toHaveLength(1);
  });

  it('handles multiple rules', () => {
    const regions = [
      makeRegion('r-0', { x: 10, y: 10, width: 20, height: 20 }),
      makeRegion('r-1', { x: 500, y: 500, width: 20, height: 20 }),
    ];
    const rules: IgnoreRule[] = [
      { type: 'boundingBox', value: { x: 0, y: 0, width: 100, height: 100 } },
    ];
    const filtered = filterByIgnoreRules(regions, rules);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('r-1');
  });

  it('returns all regions when no rules', () => {
    const regions = [makeRegion('r-0', { x: 10, y: 10, width: 20, height: 20 })];
    const filtered = filterByIgnoreRules(regions, []);
    expect(filtered).toHaveLength(1);
  });

  it('testID rule does not filter regions (no component tree yet)', () => {
    const regions = [makeRegion('r-0', { x: 10, y: 10, width: 50, height: 50 })];
    const rules: IgnoreRule[] = [{ type: 'testID', value: 'avatar-image' }];
    const filtered = filterByIgnoreRules(regions, rules);
    expect(filtered).toHaveLength(1);
  });

  it('componentName rule does not filter regions (no component tree yet)', () => {
    const regions = [makeRegion('r-0', { x: 10, y: 10, width: 50, height: 50 })];
    const rules: IgnoreRule[] = [{ type: 'componentName', value: 'StatusBar' }];
    const filtered = filterByIgnoreRules(regions, rules);
    expect(filtered).toHaveLength(1);
  });

  it('textPattern rule does not filter regions (no component tree yet)', () => {
    const regions = [makeRegion('r-0', { x: 10, y: 10, width: 50, height: 50 })];
    const rules: IgnoreRule[] = [{ type: 'textPattern', value: '\\d{1,2}:\\d{2}' }];
    const filtered = filterByIgnoreRules(regions, rules);
    expect(filtered).toHaveLength(1);
  });

  it('sourceFile rule does not filter regions (no component tree yet)', () => {
    const regions = [makeRegion('r-0', { x: 10, y: 10, width: 50, height: 50 })];
    const rules: IgnoreRule[] = [{ type: 'sourceFile', value: 'src/components/Ad.tsx' }];
    const filtered = filterByIgnoreRules(regions, rules);
    expect(filtered).toHaveLength(1);
  });

  it('colorRange rule filters region whose pixels fall within the color range', () => {
    const regions = [makeRegion('r-0', { x: 0, y: 0, width: 2, height: 2 })];
    const pixels = Buffer.alloc(2 * 2 * 4);
    for (let i = 0; i < 4; i++) {
      pixels[i * 4] = 200;
      pixels[i * 4 + 1] = 200;
      pixels[i * 4 + 2] = 200;
      pixels[i * 4 + 3] = 255;
    }
    const rules: IgnoreRule[] = [{
      type: 'colorRange',
      value: { r: [190, 210], g: [190, 210], b: [190, 210] },
    }];
    const filtered = filterByIgnoreRules(regions, rules, { screenshotPixels: pixels, width: 2, height: 2 });
    expect(filtered).toHaveLength(0);
  });

  it('colorRange rule keeps region when pixels are outside the range', () => {
    const regions = [makeRegion('r-0', { x: 0, y: 0, width: 2, height: 2 })];
    const pixels = Buffer.alloc(2 * 2 * 4);
    for (let i = 0; i < 4; i++) {
      pixels[i * 4] = 50;
      pixels[i * 4 + 1] = 50;
      pixels[i * 4 + 2] = 50;
      pixels[i * 4 + 3] = 255;
    }
    const rules: IgnoreRule[] = [{
      type: 'colorRange',
      value: { r: [190, 210], g: [190, 210], b: [190, 210] },
    }];
    const filtered = filterByIgnoreRules(regions, rules, { screenshotPixels: pixels, width: 2, height: 2 });
    expect(filtered).toHaveLength(1);
  });
});
