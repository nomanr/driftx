import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runComparison } from '../../../src/diff/compare.js';
import { createDiffPair, createSolid } from '../../fixtures/images.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('compare pipeline', () => {
  let tmpDir: string;
  beforeAll(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'driftx-compare-')); });
  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('runs full pipeline on diff pair', async () => {
    const { design, screenshot } = await createDiffPair(200, 400, { r: 200, g: 200, b: 200 }, [
      { bounds: { x: 20, y: 50, width: 60, height: 40 }, designColor: { r: 255, g: 0, b: 0 }, screenshotColor: { r: 0, g: 255, b: 0 } },
    ]);
    const dp = path.join(tmpDir, 'design.png');
    const sp = path.join(tmpDir, 'screenshot.png');
    fs.writeFileSync(dp, design.buffer);
    fs.writeFileSync(sp, screenshot.buffer);

    const result = await runComparison(dp, sp, {
      threshold: 0.1,
      diffThreshold: 0.5,
      regionMergeGap: 10,
      regionMinArea: 25,
      ignoreRules: [],
      diffMaskColor: { r: 255, g: 0, b: 0, a: 0.5 },
      platform: 'android',
    });

    expect(result.diffPercentage).toBeGreaterThan(0);
    expect(result.regions.length).toBeGreaterThan(0);
    expect(result.diffMaskBuffer).toBeInstanceOf(Buffer);
    expect(result.width).toBe(200);
    expect(result.height).toBe(400);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.regionCrops.length).toBe(result.regions.length);
  });

  it('returns zero diff for identical images', async () => {
    const img = await createSolid(200, 400, { r: 128, g: 128, b: 128 });
    const p = path.join(tmpDir, 'identical.png');
    fs.writeFileSync(p, img.buffer);

    const result = await runComparison(p, p, {
      threshold: 0.1,
      diffThreshold: 0.5,
      regionMergeGap: 10,
      regionMinArea: 25,
      ignoreRules: [],
      diffMaskColor: { r: 255, g: 0, b: 0, a: 0.5 },
      platform: 'android',
    });

    expect(result.diffPercentage).toBe(0);
    expect(result.regions).toHaveLength(0);
    expect(result.regionCrops).toHaveLength(0);
    expect(result.diffMaskBuffer).toBeInstanceOf(Buffer);
  });

  it('respects ignore rules to filter regions', async () => {
    const { design, screenshot } = await createDiffPair(200, 400, { r: 200, g: 200, b: 200 }, [
      { bounds: { x: 20, y: 50, width: 60, height: 40 }, designColor: { r: 255, g: 0, b: 0 }, screenshotColor: { r: 0, g: 255, b: 0 } },
    ]);
    const dp = path.join(tmpDir, 'design-ignore.png');
    const sp = path.join(tmpDir, 'screenshot-ignore.png');
    fs.writeFileSync(dp, design.buffer);
    fs.writeFileSync(sp, screenshot.buffer);

    const result = await runComparison(dp, sp, {
      threshold: 0.1,
      diffThreshold: 0.5,
      regionMergeGap: 10,
      regionMinArea: 25,
      ignoreRules: [
        { type: 'boundingBox', value: { x: 0, y: 0, width: 200, height: 400 } },
      ],
      diffMaskColor: { r: 255, g: 0, b: 0, a: 0.5 },
      platform: 'android',
    });

    expect(result.regions).toHaveLength(0);
    expect(result.regionCrops).toHaveLength(0);
  });

  it('reports correct total pixel count', async () => {
    const img = await createSolid(100, 100, { r: 50, g: 50, b: 50 });
    const p = path.join(tmpDir, 'pixels.png');
    fs.writeFileSync(p, img.buffer);

    const result = await runComparison(p, p, {
      threshold: 0.1,
      diffThreshold: 0.5,
      regionMergeGap: 10,
      regionMinArea: 25,
      ignoreRules: [],
      diffMaskColor: { r: 255, g: 0, b: 0, a: 0.5 },
      platform: 'android',
    });

    expect(result.totalPixels).toBe(10000);
  });
});
