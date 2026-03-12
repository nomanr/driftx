import { describe, it, expect } from 'vitest';
import { createDefaultRegistry } from '../../../src/analyses/default-registry.js';
import { AnalysisOrchestrator } from '../../../src/analyses/orchestrator.js';
import { buildDriftImage } from '../../../src/analyses/context.js';
import { RunStore } from '../../../src/run-store.js';
import { getDefaultConfig } from '../../../src/config.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';

function createTestPng(width: number, height: number, color: [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }
  return PNG.sync.write(png);
}

describe('Analysis orchestrator integration', () => {
  it('runs pixel analysis through full pipeline', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'drift-integ-'));
    try {
      const designPath = join(tmpDir, 'design.png');
      const screenshotPath = join(tmpDir, 'screenshot.png');

      const img = createTestPng(100, 200, [255, 0, 0, 255]);
      writeFileSync(designPath, img);
      writeFileSync(screenshotPath, img);

      const registry = createDefaultRegistry();
      const orchestrator = new AnalysisOrchestrator(registry);
      const store = new RunStore(tmpDir);
      const run = store.createRun();
      const config = getDefaultConfig();

      const ctx = {
        screenshot: await buildDriftImage(screenshotPath),
        design: await buildDriftImage(designPath),
        config,
        analysisConfig: { enabled: [], disabled: [], options: {} },
        runId: run.runId,
        store,
      };

      const report = await orchestrator.run(ctx);
      expect(report.analyses).toHaveLength(1);
      expect(report.analyses[0].analysisName).toBe('pixel');
      expect(report.analyses[0].error).toBeUndefined();
      expect((report.analyses[0].metadata as any).diffPercentage).toBe(0);
      expect(report.findings).toHaveLength(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('skips pixel analysis when no design provided', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'drift-integ-'));
    try {
      const screenshotPath = join(tmpDir, 'screenshot.png');
      writeFileSync(screenshotPath, createTestPng(100, 200, [255, 0, 0, 255]));

      const registry = createDefaultRegistry();
      const orchestrator = new AnalysisOrchestrator(registry);
      const store = new RunStore(tmpDir);
      const run = store.createRun();

      const ctx = {
        screenshot: await buildDriftImage(screenshotPath),
        config: getDefaultConfig(),
        analysisConfig: { enabled: [], disabled: [], options: {} },
        runId: run.runId,
        store,
      };

      const report = await orchestrator.run(ctx);
      expect(report.analyses).toHaveLength(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
