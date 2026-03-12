import { describe, it, expect } from 'vitest';
import type {
  DriftxImage,
  AnalysisConfig,
  CompareContext,
  AnalysisResult,
  AnalysisPlugin,
  CompareReport,
} from '../../../src/analyses/types.js';

describe('Analysis types', () => {
  it('DriftxImage has required fields', () => {
    const img: DriftxImage = {
      buffer: Buffer.from(''),
      rawPixels: Buffer.from(''),
      width: 100,
      height: 200,
      aspectRatio: 0.5,
      path: '/tmp/test.png',
    };
    expect(img.width).toBe(100);
  });

  it('AnalysisResult supports error field', () => {
    const result: AnalysisResult = {
      analysisName: 'test',
      findings: [],
      summary: 'ok',
      metadata: {},
      durationMs: 100,
      error: 'something failed',
    };
    expect(result.error).toBe('something failed');
  });

  it('AnalysisConfig has enable/disable/options', () => {
    const config: AnalysisConfig = {
      enabled: ['pixel'],
      disabled: ['a11y'],
      options: { pixel: { threshold: 0.1 } },
    };
    expect(config.enabled).toContain('pixel');
  });
});
