import type { Shell, DiffResult, DiffFinding, RunMetadata, DeviceInfo, InspectionCapabilities } from '../types.js';
import type { DriftConfig } from '../config.js';
import type { CompareFormatData } from '../formatters/types.js';
import type { InspectResult } from '../inspect/tree-inspector.js';
import { DeviceDiscovery } from '../devices/discovery.js';
import { captureScreenshot } from '../capture/capture.js';
import { runComparison } from '../diff/compare.js';
import { TreeInspector } from '../inspect/tree-inspector.js';
import { matchRegionsToComponents } from '../inspect/component-matcher.js';
import { generateFindings } from '../inspect/finding-generator.js';
import { RunStore } from '../run-store.js';
import { ExitCode } from '../exit-codes.js';
import { compareFormatter } from '../formatters/compare.js';
import { pickDevice } from './device-picker.js';
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
): Promise<{ result: DiffResult; exitCode: number; formatData: CompareFormatData }> {
  const store = new RunStore(process.cwd());
  const run = store.createRun();

  let screenshotPath: string;
  let deviceId = 'unknown';
  let platform = config.platform;
  let deviceInfo: DeviceInfo | undefined;

  if (options.screenshot) {
    screenshotPath = options.screenshot;
  } else {
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    const booted = devices.filter((d) => d.state === 'booted');
    if (booted.length === 0) throw new Error('No booted devices found');

    let device;
    if (options.device) {
      device = booted.find((d) => d.id === options.device || d.name === options.device);
      if (!device) throw new Error(`Device not found: ${options.device}`);
    } else {
      device = await pickDevice(booted);
    }

    deviceId = device.id;
    platform = device.platform;
    deviceInfo = device;

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

  let findings: DiffFinding[] = [];
  let inspectionCapabilities: InspectionCapabilities = {
    tree: 'none', sourceMapping: 'none', styles: 'none', protocol: 'none',
  };
  let inspectResult: InspectResult | undefined;

  if (compareResult.regions.length > 0 && deviceInfo) {
    const inspector = new TreeInspector(shell, process.cwd());
    inspectResult = await inspector.inspect(deviceInfo, {
      metroPort: config.metroPort,
      devToolsPort: config.devToolsPort,
      timeoutMs: config.timeouts.treeInspectionMs,
    });
    inspectionCapabilities = inspectResult.capabilities;

    const matches = matchRegionsToComponents(compareResult.regions, inspectResult.tree);
    findings = generateFindings(compareResult.regions, matches, compareResult.totalPixels);
  } else {
    findings = generateFindings(compareResult.regions, [], compareResult.totalPixels);
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
    findings,
    capabilities: {
      inspection: inspectionCapabilities,
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

  const formatData: CompareFormatData = {
    result: diffResult,
    device: deviceInfo ? { name: deviceInfo.name, platform: deviceInfo.platform } : undefined,
    artifactDir: store.getRunPath(run.runId),
    tree: inspectResult?.tree,
    inspectHints: inspectResult?.hints,
  };

  const reportMarkdown = compareFormatter.markdown(formatData);
  await store.writeArtifact(run.runId, 'report.md', Buffer.from(reportMarkdown));

  return { result: diffResult, exitCode, formatData };
}
