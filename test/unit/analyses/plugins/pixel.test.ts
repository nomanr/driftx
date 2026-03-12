import { describe, it, expect, vi } from 'vitest';
import { PixelAnalysis } from '../../../../src/analyses/plugins/pixel.js';
import type { CompareContext } from '../../../../src/analyses/types.js';

function makeContext(overrides: Partial<CompareContext> = {}): CompareContext {
  return {
    screenshot: { buffer: Buffer.from(''), rawPixels: Buffer.from(''), width: 100, height: 200, aspectRatio: 0.5, path: '/tmp/s.png' },
    config: {
      threshold: 0.1,
      diffThreshold: 0.01,
      regionMergeGap: 8,
      regionMinArea: 100,
      diffMaskColor: [255, 0, 0, 128],
      ignoreRules: [],
      platform: 'ios',
    } as any,
    analysisConfig: { enabled: [], disabled: [], options: {} },
    runId: 'test-run',
    store: { getRunPath: () => '/tmp/runs/test-run', writeArtifact: vi.fn() } as any,
    ...overrides,
  };
}

describe('PixelAnalysis', () => {
  const pixel = new PixelAnalysis();

  it('has correct name and description', () => {
    expect(pixel.name).toBe('pixel');
    expect(pixel.description).toBeDefined();
  });

  it('is available when design exists', () => {
    const ctx = makeContext({
      design: { buffer: Buffer.from(''), rawPixels: Buffer.from(''), width: 100, height: 200, aspectRatio: 0.5, path: '/tmp/d.png' },
    });
    expect(pixel.isAvailable(ctx)).toBe(true);
  });

  it('is not available without design', () => {
    const ctx = makeContext();
    expect(pixel.isAvailable(ctx)).toBe(false);
  });
});
