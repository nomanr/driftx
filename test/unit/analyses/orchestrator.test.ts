import { describe, it, expect } from 'vitest';
import { AnalysisOrchestrator } from '../../../src/analyses/orchestrator.js';
import { AnalysisRegistry } from '../../../src/analyses/registry.js';
import type { AnalysisPlugin, CompareContext, AnalysisResult } from '../../../src/analyses/types.js';

function makePlugin(
  name: string,
  opts: { available?: boolean; findings?: number; error?: boolean; delayMs?: number } = {},
): AnalysisPlugin {
  const { available = true, findings = 0, error = false, delayMs = 0 } = opts;
  return {
    name,
    description: `${name} analysis`,
    isAvailable: () => available,
    run: async (): Promise<AnalysisResult> => {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (error) throw new Error(`${name} failed`);
      return {
        analysisName: name,
        findings: Array.from({ length: findings }, (_, i) => ({
          id: `${name}-${i}`,
          category: 'unknown' as const,
          severity: 'info' as const,
          confidence: 0.5,
          region: { x: 0, y: 0, width: 10, height: 10 },
          evidence: [],
        })),
        summary: `${name}: ${findings} findings`,
        metadata: {},
        durationMs: delayMs,
      };
    },
  };
}

function makeContext(overrides: Partial<CompareContext> = {}): CompareContext {
  return {
    screenshot: { buffer: Buffer.from(''), rawPixels: Buffer.from(''), width: 100, height: 200, aspectRatio: 0.5, path: '/tmp/s.png' },
    config: {} as any,
    analysisConfig: { enabled: [], disabled: [], options: {} },
    runId: 'test-run',
    store: {} as any,
    ...overrides,
  };
}

describe('AnalysisOrchestrator', () => {
  it('runs all available plugins and merges findings', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 2 }));
    registry.register(makePlugin('a11y', { findings: 1 }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const report = await orchestrator.run(makeContext());
    expect(report.analyses).toHaveLength(2);
    expect(report.findings).toHaveLength(3);
    expect(report.runId).toBe('test-run');
  });

  it('skips unavailable plugins', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 1 }));
    registry.register(makePlugin('a11y', { available: false }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const report = await orchestrator.run(makeContext());
    expect(report.analyses).toHaveLength(1);
    expect(report.analyses[0].analysisName).toBe('pixel');
  });

  it('respects enabled filter', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 1 }));
    registry.register(makePlugin('a11y', { findings: 1 }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const ctx = makeContext({
      analysisConfig: { enabled: ['pixel'], disabled: [], options: {} },
    });
    const report = await orchestrator.run(ctx);
    expect(report.analyses).toHaveLength(1);
    expect(report.analyses[0].analysisName).toBe('pixel');
  });

  it('respects disabled filter', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 1 }));
    registry.register(makePlugin('a11y', { findings: 1 }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const ctx = makeContext({
      analysisConfig: { enabled: [], disabled: ['a11y'], options: {} },
    });
    const report = await orchestrator.run(ctx);
    expect(report.analyses).toHaveLength(1);
    expect(report.analyses[0].analysisName).toBe('pixel');
  });

  it('handles plugin failure gracefully via Promise.allSettled', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 1 }));
    registry.register(makePlugin('broken', { error: true }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const report = await orchestrator.run(makeContext());
    expect(report.analyses).toHaveLength(2);
    const broken = report.analyses.find((a) => a.analysisName === 'broken')!;
    expect(broken.error).toBe('broken failed');
    expect(broken.findings).toEqual([]);
    expect(report.findings).toHaveLength(1);
  });

  it('runs plugins in parallel', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('slow1', { delayMs: 50, findings: 1 }));
    registry.register(makePlugin('slow2', { delayMs: 50, findings: 1 }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const start = Date.now();
    const report = await orchestrator.run(makeContext());
    const elapsed = Date.now() - start;
    expect(report.analyses).toHaveLength(2);
    expect(elapsed).toBeLessThan(90);
  });
});
