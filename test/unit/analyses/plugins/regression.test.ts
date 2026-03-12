import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegressionAnalysis } from '../../../../src/analyses/plugins/regression.js';
import type { CompareContext } from '../../../../src/analyses/types.js';

vi.mock('../../../../src/diff/compare.js', () => ({
  runComparison: vi.fn(),
}));

import { runComparison } from '../../../../src/diff/compare.js';

const mockRunComparison = vi.mocked(runComparison);

function makeDriftImage(path: string) {
  return { buffer: Buffer.from(''), rawPixels: Buffer.from(''), width: 100, height: 200, aspectRatio: 0.5, path };
}

function makeContext(overrides: Partial<CompareContext> = {}): CompareContext {
  return {
    screenshot: makeDriftImage('/tmp/screenshot.png'),
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
    store: { getRunPath: () => '/tmp/runs/test-run', writeArtifact: vi.fn().mockResolvedValue(undefined) } as any,
    ...overrides,
  };
}

function makeCompareResult(overrides: Partial<{
  totalPixels: number;
  diffPixels: number;
  diffPercentage: number;
  regions: any[];
  regionCrops: any[];
}> = {}) {
  return {
    totalPixels: 10000,
    diffPixels: 0,
    diffPercentage: 0,
    regions: [],
    diffMaskBuffer: Buffer.from(''),
    regionCrops: [],
    width: 100,
    height: 200,
    durationMs: 10,
    ...overrides,
  };
}

describe('RegressionAnalysis', () => {
  const regression = new RegressionAnalysis();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name and description', () => {
    expect(regression.name).toBe('regression');
    expect(regression.description).toBe('Layout regression detection against previous baseline');
  });

  it('is available when baseline exists', () => {
    const ctx = makeContext({ baseline: makeDriftImage('/tmp/baseline.png') });
    expect(regression.isAvailable(ctx)).toBe(true);
  });

  it('is not available without baseline', () => {
    const ctx = makeContext();
    expect(regression.isAvailable(ctx)).toBe(false);
  });

  it('runs pixel diff between baseline and screenshot', async () => {
    const regions = [
      { id: 'r0', bounds: { x: 10, y: 10, width: 50, height: 50 }, pixelCount: 2500, percentage: 2.5 },
      { id: 'r1', bounds: { x: 60, y: 60, width: 30, height: 30 }, pixelCount: 900, percentage: 0.9 },
    ];
    const regionCrops = [
      { id: 'r0', buffer: Buffer.from('crop0') },
      { id: 'r1', buffer: Buffer.from('crop1') },
    ];

    mockRunComparison.mockResolvedValue(makeCompareResult({
      totalPixels: 10000,
      diffPixels: 340,
      diffPercentage: 3.4,
      regions,
      regionCrops,
    }) as any);

    const ctx = makeContext({ baseline: makeDriftImage('/tmp/baseline.png') });
    const result = await regression.run(ctx);

    expect(mockRunComparison).toHaveBeenCalledWith(
      '/tmp/baseline.png',
      '/tmp/screenshot.png',
      expect.objectContaining({ threshold: 0.1 }),
    );

    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].category).toBe('regression');
    expect(result.findings[0].id).toBe('regression-0');
    expect(result.findings[0].severity).toBe('major');
    expect(result.findings[0].confidence).toBe(1.0);
    expect(result.findings[0].description).toBe('Region r0: 2.500% changed (2500px)');
    expect(result.findings[1].category).toBe('regression');
    expect(result.findings[1].id).toBe('regression-1');

    expect(result.analysisName).toBe('regression');
    expect(result.metadata).toMatchObject({
      totalPixels: 10000,
      diffPixels: 340,
      diffPercentage: 3.4,
      passed: false,
    });

    expect(ctx.store.writeArtifact).toHaveBeenCalledWith('test-run', 'regression-diff-mask.png', expect.any(Buffer));
    expect(ctx.store.writeArtifact).toHaveBeenCalledWith('test-run', 'regression-regions/r0.png', expect.any(Buffer));
    expect(ctx.store.writeArtifact).toHaveBeenCalledWith('test-run', 'regression-regions/r1.png', expect.any(Buffer));
  });

  it('reports no changes when diff is within threshold', async () => {
    mockRunComparison.mockResolvedValue(makeCompareResult({
      diffPercentage: 0.005,
    }) as any);

    const ctx = makeContext({ baseline: makeDriftImage('/tmp/baseline.png') });
    const result = await regression.run(ctx);

    expect(result.metadata.passed).toBe(true);
    expect(result.summary).toBe('Regression: no changes detected');
    expect(result.findings).toHaveLength(0);
  });
});
