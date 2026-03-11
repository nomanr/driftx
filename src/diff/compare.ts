import type { DiffRegion, IgnoreRule } from '../types.js';
import { loadImage } from './image-loader.js';
import { alignImages } from './alignment.js';
import { computePixelDiff } from './pixel-diff.js';
import { extractRegions } from './region-extractor.js';
import { filterByIgnoreRules } from './ignore-rules.js';
import { generateDiffMask, type MaskColor } from './mask-generator.js';
import { cropViewport, type ViewportOptions } from './viewport.js';
import sharp from 'sharp';

export interface CompareOptions {
  threshold: number;
  diffThreshold: number;
  regionMergeGap: number;
  regionMinArea: number;
  ignoreRules: IgnoreRule[];
  diffMaskColor: MaskColor;
  platform: 'android' | 'ios';
  viewport?: Omit<ViewportOptions, 'platform'>;
}

export interface CompareResult {
  totalPixels: number;
  diffPixels: number;
  diffPercentage: number;
  regions: DiffRegion[];
  diffMaskBuffer: Buffer;
  regionCrops: Array<{ id: string; buffer: Buffer }>;
  width: number;
  height: number;
  durationMs: number;
}

function sanitizeDiffMask(mask: Buffer, width: number, height: number): Buffer {
  const clean = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = mask[idx];
    const g = mask[idx + 1];
    const b = mask[idx + 2];
    if (r > 0 && g === 0 && b === 0) {
      clean[idx] = r;
      clean[idx + 1] = g;
      clean[idx + 2] = b;
      clean[idx + 3] = mask[idx + 3];
    }
  }
  return clean;
}

export async function runComparison(
  designPath: string,
  screenshotPath: string,
  options: CompareOptions,
): Promise<CompareResult> {
  const start = Date.now();

  let design = await loadImage(designPath);
  let screenshot = await loadImage(screenshotPath);

  if (options.viewport) {
    const vpOpts: ViewportOptions = { ...options.viewport, platform: options.platform };
    const croppedDesign = await cropViewport(design.buffer, vpOpts);
    const croppedScreenshot = await cropViewport(screenshot.buffer, vpOpts);

    design = {
      buffer: croppedDesign.buffer,
      width: croppedDesign.width,
      height: croppedDesign.height,
      aspectRatio: croppedDesign.width / croppedDesign.height,
      rawPixels: await sharp(croppedDesign.buffer).ensureAlpha().raw().toBuffer(),
    };
    screenshot = {
      buffer: croppedScreenshot.buffer,
      width: croppedScreenshot.width,
      height: croppedScreenshot.height,
      aspectRatio: croppedScreenshot.width / croppedScreenshot.height,
      rawPixels: await sharp(croppedScreenshot.buffer).ensureAlpha().raw().toBuffer(),
    };
  }

  const aligned = await alignImages(design, screenshot);
  const diff = computePixelDiff(aligned, options.threshold);

  const cleanMask = sanitizeDiffMask(diff.diffMask, diff.width, diff.height);

  let regions = extractRegions(cleanMask, diff.width, diff.height, {
    mergeGap: options.regionMergeGap,
    minArea: options.regionMinArea,
  });

  regions = filterByIgnoreRules(regions, options.ignoreRules);

  const diffMaskBuffer = await generateDiffMask(
    screenshot.buffer, cleanMask, diff.width, diff.height, options.diffMaskColor,
  );

  const regionCrops = await Promise.all(
    regions.map(async (r) => {
      const crop = await sharp(screenshot.buffer)
        .extract({
          left: r.bounds.x,
          top: r.bounds.y,
          width: Math.min(r.bounds.width, diff.width - r.bounds.x),
          height: Math.min(r.bounds.height, diff.height - r.bounds.y),
        })
        .png()
        .toBuffer();
      return { id: r.id, buffer: crop };
    }),
  );

  return {
    totalPixels: diff.totalPixels,
    diffPixels: diff.diffPixels,
    diffPercentage: diff.diffPercentage,
    regions,
    diffMaskBuffer,
    regionCrops,
    width: diff.width,
    height: diff.height,
    durationMs: Date.now() - start,
  };
}
