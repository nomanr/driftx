import type { Shell, DiffResult, RunMetadata } from '../types.js';
import type { DriftConfig } from '../config.js';
import { DeviceDiscovery } from '../devices/discovery.js';
import { captureScreenshot } from '../capture/capture.js';
import { runComparison } from '../diff/compare.js';
import { RunStore } from '../run-store.js';
import { ExitCode } from '../exit-codes.js';
import * as fs from 'node:fs';

export interface CompareCommandOptions {
  design: string;
  device?: string;
  threshold?: number;
  screenshot?: string;
}

export async function runCompare(
  shell: Shell,
  config: DriftConfig,
  options: CompareCommandOptions,
): Promise<{ result: DiffResult; exitCode: number }> {
  const store = new RunStore(process.cwd());
  const run = store.createRun();

  let screenshotPath: string;
  let deviceId = 'unknown';
  let platform = config.platform;

  if (options.screenshot) {
    screenshotPath = options.screenshot;
  } else {
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    const booted = devices.filter((d) => d.state === 'booted');
    if (booted.length === 0) throw new Error('No booted devices found');

    const device = options.device
      ? booted.find((d) => d.id === options.device) ?? booted[0]
      : booted[0];

    deviceId = device.id;
    platform = device.platform;

    const buffer = await captureScreenshot(shell, device, {
      settleCheck: config.settleCheckEnabled,
      settleMaxDelta: config.settleMaxDelta,
      settleDelayMs: config.settleTimeMs,
    });
    screenshotPath = store.getRunPath(run.runId, 'screenshot.png');
    await store.writeArtifact(run.runId, 'screenshot.png', buffer);
  }

  const designBuffer = fs.readFileSync(options.design);
  await store.writeArtifact(run.runId, 'design.png', designBuffer);

  const diffThreshold = options.threshold ?? config.diffThreshold;
  const [mr, mg, mb, ma] = config.diffMaskColor;
  const compareResult = await runComparison(options.design, screenshotPath, {
    threshold: config.threshold,
    diffThreshold,
    regionMergeGap: config.regionMergeGap,
    regionMinArea: config.regionMinArea,
    ignoreRules: config.ignoreRules,
    diffMaskColor: { r: mr, g: mg, b: mb, a: ma / 255 },
    platform,
  });

  await store.writeArtifact(run.runId, 'diff-mask.png', compareResult.diffMaskBuffer);
  for (const crop of compareResult.regionCrops) {
    await store.writeArtifact(run.runId, `regions/${crop.id}.png`, crop.buffer);
  }

  const startedAt = new Date().toISOString();
  const metadata: Partial<RunMetadata> = {
    runId: run.runId,
    startedAt,
    completedAt: new Date().toISOString(),
    projectRoot: process.cwd(),
    deviceId,
    platform,
    orientation: 'portrait',
    framework: 'unknown',
    driftVersion: '0.1.0',
  };
  await store.writeMetadata(run.runId, metadata);

  const diffResult: DiffResult = {
    runId: run.runId,
    metadata: metadata as RunMetadata,
    totalPixels: compareResult.totalPixels,
    diffPixels: compareResult.diffPixels,
    diffPercentage: compareResult.diffPercentage,
    regions: compareResult.regions,
    findings: [],
    capabilities: {
      inspection: { tree: 'none', sourceMapping: 'none', styles: 'none', protocol: 'none' },
      scrollCapture: { supported: false, reason: 'Not implemented', mode: 'none' },
      sourceMapping: false,
      prerequisites: [],
    },
    durationMs: compareResult.durationMs,
  };

  const resultJson = JSON.stringify(diffResult, null, 2);
  await store.writeArtifact(run.runId, 'result.json', Buffer.from(resultJson));

  const passed = compareResult.diffPercentage <= diffThreshold;
  const exitCode = passed ? ExitCode.Success : ExitCode.DiffFound;

  return { result: diffResult, exitCode };
}

export function formatCompareOutput(result: DiffResult): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`  Diff: ${result.diffPercentage.toFixed(2)}% (${result.diffPixels}/${result.totalPixels} pixels)`);
  lines.push(`  Regions: ${result.regions.length}`);
  lines.push(`  Duration: ${result.durationMs}ms`);
  lines.push('');

  if (result.regions.length > 0) {
    const header = `  ${'Region'.padEnd(12)} ${'X'.padEnd(6)} ${'Y'.padEnd(6)} ${'W'.padEnd(6)} ${'H'.padEnd(6)} ${'Pixels'.padEnd(10)} ${'%'}`;
    lines.push(header);
    lines.push('  ' + '-'.repeat(56));
    for (const r of result.regions) {
      lines.push(
        `  ${r.id.padEnd(12)} ${String(r.bounds.x).padEnd(6)} ${String(r.bounds.y).padEnd(6)} ${String(r.bounds.width).padEnd(6)} ${String(r.bounds.height).padEnd(6)} ${String(r.pixelCount).padEnd(10)} ${r.percentage.toFixed(2)}`,
      );
    }
    lines.push('');
  }

  lines.push(`  Run: ${result.runId}`);
  lines.push('');
  return lines.join('\n');
}
