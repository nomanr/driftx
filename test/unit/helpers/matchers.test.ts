import { describe, it, expect } from 'vitest';
import type { BoundingBox } from '../../../src/types.js';

describe('toOverlap matcher', () => {
  it('passes when boxes overlap', () => {
    const a: BoundingBox = { x: 0, y: 0, width: 50, height: 50 };
    const b: BoundingBox = { x: 25, y: 25, width: 50, height: 50 };
    expect(a).toOverlap(b);
  });

  it('fails when boxes do not overlap', () => {
    const a: BoundingBox = { x: 0, y: 0, width: 10, height: 10 };
    const b: BoundingBox = { x: 100, y: 100, width: 10, height: 10 };
    expect(a).not.toOverlap(b);
  });

  it('detects edge-touching boxes as non-overlapping', () => {
    const a: BoundingBox = { x: 0, y: 0, width: 10, height: 10 };
    const b: BoundingBox = { x: 10, y: 0, width: 10, height: 10 };
    expect(a).not.toOverlap(b);
  });

  it('detects fully contained box as overlapping', () => {
    const outer: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const inner: BoundingBox = { x: 10, y: 10, width: 20, height: 20 };
    expect(outer).toOverlap(inner);
  });
});
