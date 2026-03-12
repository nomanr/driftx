import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePixelDiff } from '../../../src/diff/pixel-diff.js';
import { createDiffPair, createSolid } from '../../fixtures/images.js';
import { loadImage } from '../../../src/diff/image-loader.js';
import { alignImages } from '../../../src/diff/alignment.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('computePixelDiff', () => {
  let tmpDir: string;
  beforeAll(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'driftx-diff-')); });
  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns zero diff for identical images', async () => {
    const img = await createSolid(100, 100, { r: 128, g: 128, b: 128 });
    const p = path.join(tmpDir, 'same.png');
    fs.writeFileSync(p, img.buffer);
    const loaded = await loadImage(p);
    const aligned = await alignImages(loaded, loaded);
    const result = computePixelDiff(aligned, 0.1);
    expect(result.diffPixels).toBe(0);
    expect(result.diffPercentage).toBe(0);
  });

  it('detects differences between images', async () => {
    const { design, screenshot } = await createDiffPair(100, 100, { r: 128, g: 128, b: 128 }, [
      { bounds: { x: 10, y: 10, width: 30, height: 30 }, designColor: { r: 255, g: 0, b: 0 }, screenshotColor: { r: 0, g: 255, b: 0 } },
    ]);
    const dp = path.join(tmpDir, 'design.png');
    const sp = path.join(tmpDir, 'screen.png');
    fs.writeFileSync(dp, design.buffer);
    fs.writeFileSync(sp, screenshot.buffer);
    const d = await loadImage(dp);
    const s = await loadImage(sp);
    const aligned = await alignImages(d, s);
    const result = computePixelDiff(aligned, 0.1);
    expect(result.diffPixels).toBeGreaterThan(0);
    expect(result.diffMask).toBeInstanceOf(Buffer);
  });

  it('returns diff mask as raw RGBA buffer', async () => {
    const { design, screenshot } = await createDiffPair(100, 100, { r: 128, g: 128, b: 128 }, [
      { bounds: { x: 10, y: 10, width: 20, height: 20 }, designColor: { r: 255, g: 0, b: 0 }, screenshotColor: { r: 0, g: 0, b: 255 } },
    ]);
    const dp = path.join(tmpDir, 'design2.png');
    const sp = path.join(tmpDir, 'screen2.png');
    fs.writeFileSync(dp, design.buffer);
    fs.writeFileSync(sp, screenshot.buffer);
    const d = await loadImage(dp);
    const s = await loadImage(sp);
    const aligned = await alignImages(d, s);
    const result = computePixelDiff(aligned, 0.1);
    expect(result.diffMask.length).toBe(100 * 100 * 4);
  });
});
