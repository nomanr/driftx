import { describe, it, expect } from 'vitest';
import { buildDriftxImage, buildAnalysisConfig } from '../../../src/analyses/context.js';
import { PNG } from 'pngjs';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('buildDriftxImage', () => {
  it('creates DriftxImage from file path', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'driftx-ctx-'));
    try {
      const png = new PNG({ width: 2, height: 3 });
      png.data.fill(255);
      const buffer = PNG.sync.write(png);
      const imgPath = join(tmp, 'test.png');
      writeFileSync(imgPath, buffer);

      const img = await buildDriftxImage(imgPath);
      expect(img.width).toBe(2);
      expect(img.height).toBe(3);
      expect(img.aspectRatio).toBeCloseTo(2 / 3);
      expect(img.path).toBe(imgPath);
      expect(img.buffer).toBeInstanceOf(Buffer);
      expect(img.rawPixels).toBeInstanceOf(Buffer);
      expect(img.rawPixels.length).toBe(2 * 3 * 4);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('buildAnalysisConfig', () => {
  it('builds from CLI flags and config', () => {
    const config = buildAnalysisConfig(
      { default: ['pixel'], disabled: [], options: {} },
      'pixel,semantic',
      undefined,
    );
    expect(config.enabled).toEqual(['pixel', 'semantic']);
    expect(config.disabled).toEqual([]);
  });

  it('uses config defaults when no flags', () => {
    const config = buildAnalysisConfig(
      { default: ['pixel', 'a11y'], disabled: [], options: {} },
      undefined,
      undefined,
    );
    expect(config.enabled).toEqual(['pixel', 'a11y']);
  });

  it('handles --without flag', () => {
    const config = buildAnalysisConfig(
      { default: ['pixel', 'a11y'], disabled: [], options: {} },
      undefined,
      'a11y',
    );
    expect(config.enabled).toEqual(['pixel', 'a11y']);
    expect(config.disabled).toEqual(['a11y']);
  });
});
