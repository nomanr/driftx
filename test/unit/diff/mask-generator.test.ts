import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateDiffMask } from '../../../src/diff/mask-generator.js';
import { createDiffPair } from '../../fixtures/images.js';
import { loadImage } from '../../../src/diff/image-loader.js';
import { alignImages } from '../../../src/diff/alignment.js';
import { computePixelDiff } from '../../../src/diff/pixel-diff.js';
import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('generateDiffMask', () => {
  let tmpDir: string;
  beforeAll(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'driftx-mask-')); });
  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('produces a valid PNG overlay', async () => {
    const { design, screenshot } = await createDiffPair(100, 100, { r: 128, g: 128, b: 128 }, [
      { bounds: { x: 10, y: 10, width: 30, height: 30 }, designColor: { r: 255, g: 0, b: 0 }, screenshotColor: { r: 0, g: 255, b: 0 } },
    ]);
    const dp = path.join(tmpDir, 'd.png');
    const sp = path.join(tmpDir, 's.png');
    fs.writeFileSync(dp, design.buffer);
    fs.writeFileSync(sp, screenshot.buffer);
    const d = await loadImage(dp);
    const s = await loadImage(sp);
    const aligned = await alignImages(d, s);
    const diff = computePixelDiff(aligned, 0.1);

    const maskPng = await generateDiffMask(screenshot.buffer, diff.diffMask, diff.width, diff.height, { r: 255, g: 0, b: 0, a: 0.5 });
    const meta = await sharp(maskPng).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });
});
