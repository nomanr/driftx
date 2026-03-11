import type { DiffRegion, IgnoreRule, BoundingBox, ColorRange } from '../types.js';

export interface PixelContext {
  screenshotPixels: Buffer;
  width: number;
  height: number;
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function regionMatchesColorRange(
  region: DiffRegion,
  range: ColorRange,
  ctx: PixelContext,
): boolean {
  const { bounds } = region;
  const endX = Math.min(bounds.x + bounds.width, ctx.width);
  const endY = Math.min(bounds.y + bounds.height, ctx.height);

  for (let y = bounds.y; y < endY; y++) {
    for (let x = bounds.x; x < endX; x++) {
      const idx = (y * ctx.width + x) * 4;
      const r = ctx.screenshotPixels[idx];
      const g = ctx.screenshotPixels[idx + 1];
      const b = ctx.screenshotPixels[idx + 2];

      if (r < range.r[0] || r > range.r[1]) return false;
      if (g < range.g[0] || g > range.g[1]) return false;
      if (b < range.b[0] || b > range.b[1]) return false;
    }
  }
  return true;
}

function isIgnored(region: DiffRegion, rule: IgnoreRule, ctx?: PixelContext): boolean {
  switch (rule.type) {
    case 'boundingBox':
      return boxesOverlap(region.bounds, rule.value as BoundingBox);
    case 'colorRange':
      if (!ctx) return false;
      return regionMatchesColorRange(region, rule.value as ColorRange, ctx);
    default:
      return false;
  }
}

export function filterByIgnoreRules(
  regions: DiffRegion[],
  rules: IgnoreRule[],
  pixelContext?: PixelContext,
): DiffRegion[] {
  if (rules.length === 0) return regions;
  return regions.filter((region) => !rules.some((rule) => isIgnored(region, rule, pixelContext)));
}
