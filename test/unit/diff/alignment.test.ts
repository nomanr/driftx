import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { alignImages } from '../../../src/diff/alignment.js';
import { createSolid } from '../../fixtures/images.js';
import { loadImage } from '../../../src/diff/image-loader.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('alignImages', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-align-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function writeAndLoad(name: string, w: number, h: number) {
    const img = await createSolid(w, h, { r: 128, g: 128, b: 128 });
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, img.buffer);
    return loadImage(p);
  }

  it('returns same dimensions when images match', async () => {
    const design = await writeAndLoad('d1.png', 1080, 2400);
    const screenshot = await writeAndLoad('s1.png', 1080, 2400);
    const result = await alignImages(design, screenshot);
    expect(result.width).toBe(1080);
    expect(result.height).toBe(2400);
  });

  it('scales design to match screenshot dimensions', async () => {
    const design = await writeAndLoad('d2.png', 540, 1200);
    const screenshot = await writeAndLoad('s2.png', 1080, 2400);
    const result = await alignImages(design, screenshot);
    expect(result.width).toBe(1080);
    expect(result.height).toBe(2400);
    expect(result.designPixels.length).toBe(1080 * 2400 * 4);
    expect(result.screenshotPixels.length).toBe(1080 * 2400 * 4);
  });

  it('warns on aspect ratio divergence > 5%', async () => {
    const design = await writeAndLoad('d3.png', 1080, 1920);
    const screenshot = await writeAndLoad('s3.png', 1080, 2400);
    const result = await alignImages(design, screenshot);
    expect(result.aspectRatioWarning).toBe(true);
  });

  it('no warning when aspect ratios are close', async () => {
    const design = await writeAndLoad('d4.png', 1080, 2400);
    const screenshot = await writeAndLoad('s4.png', 1080, 2400);
    const result = await alignImages(design, screenshot);
    expect(result.aspectRatioWarning).toBe(false);
  });
});
