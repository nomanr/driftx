import type { Shell, RunMetadata, DeviceInfo, InspectionCapabilities } from '../types.js';
import type { DriftConfig } from '../config.js';
import type { CompareFormatData } from '../formatters/types.js';
import type { InspectResult } from '../inspect/tree-inspector.js';
import type { CompareReport } from '../analyses/types.js';
import { DeviceDiscovery } from '../devices/discovery.js';
import { captureScreenshot } from '../capture/capture.js';
import { TreeInspector } from '../inspect/tree-inspector.js';
import { RunStore } from '../run-store.js';
import { ExitCode } from '../exit-codes.js';
import { compareFormatter } from '../formatters/compare.js';
import { pickDevice } from './device-picker.js';
import { buildDriftImage, buildAnalysisConfig } from '../analyses/context.js';
import { createDefaultRegistry } from '../analyses/default-registry.js';
import { AnalysisOrchestrator } from '../analyses/orchestrator.js';
import * as fs from 'node:fs';

export interface CompareCommandOptions {
  design?: string;
  device?: string;
  threshold?: number;
  screenshot?: string;
  with?: string;
  without?: string;
  baseline?: boolean;
}

export async function runCompare(
  shell: Shell,
  config: DriftConfig,
  options: CompareCommandOptions,
): Promise<{ report: CompareReport; exitCode: number; formatData: CompareFormatData }> {
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

  const screenshotImage = await buildDriftImage(screenshotPath);

  let designImage;
  if (options.design) {
    const designBuffer = fs.readFileSync(options.design);
    await store.writeArtifact(run.runId, 'design.png', designBuffer);
    designImage = await buildDriftImage(options.design);
  }

  let baselineImage;
  if (options.baseline) {
    const latestRunId = store.getLatestRun();
    if (latestRunId) {
      const baselinePath = store.getRunPath(latestRunId, 'screenshot.png');
      if (fs.existsSync(baselinePath)) {
        baselineImage = await buildDriftImage(baselinePath);
      }
    }
  }

  let inspectResult: InspectResult | undefined;
  let inspectionCapabilities: InspectionCapabilities = {
    tree: 'none', sourceMapping: 'none', styles: 'none', protocol: 'none',
  };

  if (deviceInfo) {
    const inspector = new TreeInspector(shell, process.cwd());
    inspectResult = await inspector.inspect(deviceInfo, {
      metroPort: config.metroPort,
      devToolsPort: config.devToolsPort,
      timeoutMs: config.timeouts.treeInspectionMs,
    });
    inspectionCapabilities = inspectResult.capabilities;
  }

  const analysisConfig = buildAnalysisConfig(config.analyses, options.with, options.without);

  const ctx = {
    screenshot: screenshotImage,
    design: designImage,
    baseline: baselineImage,
    tree: inspectResult?.tree,
    device: deviceInfo,
    config,
    analysisConfig,
    runId: run.runId,
    store,
  };

  const registry = createDefaultRegistry();
  const orchestrator = new AnalysisOrchestrator(registry);
  const report = await orchestrator.run(ctx);

  const startedAt = new Date().toISOString();
  const metadata: RunMetadata = {
    runId: run.runId,
    startedAt,
    completedAt: new Date().toISOString(),
    projectRoot: process.cwd(),
    deviceId,
    platform,
    orientation: 'portrait',
    framework: 'unknown',
    driftVersion: '0.1.0',
    configHash: '',
  };
  report.metadata = metadata;
  await store.writeMetadata(run.runId, metadata as unknown as Record<string, unknown>);

  const resultJson = JSON.stringify(report, null, 2);
  await store.writeArtifact(run.runId, 'result.json', Buffer.from(resultJson));

  const anyFailed = report.analyses.some((a) => {
    const meta = a.metadata as Record<string, unknown>;
    return meta.passed === false;
  });
  const exitCode = anyFailed ? ExitCode.DiffFound : ExitCode.Success;

  const formatData: CompareFormatData = {
    report,
    device: deviceInfo ? { name: deviceInfo.name, platform: deviceInfo.platform } : undefined,
    artifactDir: store.getRunPath(run.runId),
    tree: inspectResult?.tree,
    inspectHints: inspectResult?.hints,
  };

  const reportMarkdown = compareFormatter.markdown(formatData);
  await store.writeArtifact(run.runId, 'report.md', Buffer.from(reportMarkdown));

  return { report, exitCode, formatData };
}
