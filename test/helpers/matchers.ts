import type { BoundingBox } from '../../src/types.js';
import { expect } from 'vitest';

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

expect.extend({
  toOverlap(received: BoundingBox, expected: BoundingBox) {
    const pass = boxesOverlap(received, expected);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to overlap ${JSON.stringify(expected)}`
          : `expected ${JSON.stringify(received)} to overlap ${JSON.stringify(expected)}`,
    };
  },
});

declare module 'vitest' {
  interface Assertion<T = any> {
    toOverlap(expected: BoundingBox): T;
  }
  interface AsymmetricMatchersContaining {
    toOverlap(expected: BoundingBox): any;
  }
}
