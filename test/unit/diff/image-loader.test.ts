import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadImage } from '../../../src/diff/image-loader.js';
import { createSolid } from '../../fixtures/images.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('loadImage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'driftx-img-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads a valid PNG and returns metadata', async () => {
    const img = await createSolid(200, 400, { r: 255, g: 0, b: 0 });
    const filePath = path.join(tmpDir, 'test.png');
    fs.writeFileSync(filePath, img.buffer);
    const result = await loadImage(filePath);
    expect(result.width).toBe(200);
    expect(result.height).toBe(400);
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('throws for nonexistent file', async () => {
    await expect(loadImage('/nonexistent.png')).rejects.toThrow('not found');
  });

  it('throws for corrupted file', async () => {
    const filePath = path.join(tmpDir, 'bad.png');
    fs.writeFileSync(filePath, 'not an image');
    await expect(loadImage(filePath)).rejects.toThrow();
  });

  it('computes aspect ratio', async () => {
    const img = await createSolid(1080, 2400, { r: 0, g: 0, b: 0 });
    const filePath = path.join(tmpDir, 'test.png');
    fs.writeFileSync(filePath, img.buffer);
    const result = await loadImage(filePath);
    expect(result.aspectRatio).toBeCloseTo(0.45, 1);
  });
});
