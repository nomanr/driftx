import type { BoundingBox, DiffRegion } from '../types.js';

interface ExtractOptions {
  mergeGap: number;
  minArea: number;
}

function isDiffPixel(mask: Buffer, idx: number): boolean {
  return mask[idx] > 0 || mask[idx + 1] > 0 || mask[idx + 2] > 0;
}

function floodFill(
  mask: Buffer, visited: Uint8Array, width: number, height: number,
  startX: number, startY: number,
): { bounds: BoundingBox; pixelCount: number } {
  const stack: Array<[number, number]> = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let count = 0;

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[idx]) continue;
    if (!isDiffPixel(mask, idx * 4)) continue;

    visited[idx] = 1;
    count++;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return {
    bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    pixelCount: count,
  };
}

function shouldMerge(a: BoundingBox, b: BoundingBox, gap: number): boolean {
  const aRight = a.x + a.width + gap;
  const aBottom = a.y + a.height + gap;
  const bRight = b.x + b.width + gap;
  const bBottom = b.y + b.height + gap;

  return !(a.x - gap > bRight || b.x - gap > aRight || a.y - gap > bBottom || b.y - gap > aBottom);
}

function mergeBounds(a: BoundingBox, b: BoundingBox): BoundingBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x, y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export function extractRegions(
  diffMask: Buffer, width: number, height: number,
  options: ExtractOptions,
): DiffRegion[] {
  const visited = new Uint8Array(width * height);
  let rawRegions: Array<{ bounds: BoundingBox; pixelCount: number }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || !isDiffPixel(diffMask, idx * 4)) continue;
      rawRegions.push(floodFill(diffMask, visited, width, height, x, y));
    }
  }

  let merged = true;
  while (merged) {
    merged = false;
    const next: typeof rawRegions = [];
    const used = new Set<number>();

    for (let i = 0; i < rawRegions.length; i++) {
      if (used.has(i)) continue;
      let current = rawRegions[i];

      for (let j = i + 1; j < rawRegions.length; j++) {
        if (used.has(j)) continue;
        if (shouldMerge(current.bounds, rawRegions[j].bounds, options.mergeGap)) {
          current = {
            bounds: mergeBounds(current.bounds, rawRegions[j].bounds),
            pixelCount: current.pixelCount + rawRegions[j].pixelCount,
          };
          used.add(j);
          merged = true;
        }
      }

      next.push(current);
    }

    rawRegions = next;
  }

  const totalPixels = width * height;
  return rawRegions
    .filter((r) => r.bounds.width * r.bounds.height >= options.minArea)
    .map((r, i) => ({
      id: `region-${i}`,
      bounds: r.bounds,
      pixelCount: r.pixelCount,
      percentage: totalPixels > 0 ? (r.pixelCount / totalPixels) * 100 : 0,
    }));
}
