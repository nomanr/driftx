import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Shell, DeviceInfo } from '../types.js';
import { DEFAULT_RETRY_POLICY } from '../types.js';
import type { DriftConfig } from '../config.js';
import { DeviceDiscovery } from '../devices/discovery.js';
import { captureScreenshot } from '../capture/capture.js';
import { RunStore } from '../run-store.js';
import { withRetry } from '../retry.js';
import { pickDevice } from './device-picker.js';

export interface CaptureCommandOptions {
  device?: string;
  output?: string;
  settleCheck?: boolean;
}

export async function runCapture(
  shell: Shell,
  config: DriftConfig,
  options: CaptureCommandOptions,
): Promise<{ path: string; runId: string }> {
  const discovery = new DeviceDiscovery(shell);
  const devices = await discovery.list();
  const booted = devices.filter((d) => d.state === 'booted');

  if (booted.length === 0) {
    throw new Error('No booted devices found. Start an emulator or boot a simulator.');
  }

  let device: DeviceInfo;
  if (options.device) {
    const found = booted.find((d) => d.id === options.device || d.name === options.device);
    if (!found) throw new Error(`Device not found: ${options.device}`);
    device = found;
  } else if (config.primaryDevice) {
    const found = booted.find((d) => d.id === config.primaryDevice || d.name === config.primaryDevice);
    if (!found) throw new Error(`Primary device not found: ${config.primaryDevice}`);
    device = found;
  } else {
    device = await pickDevice(booted);
  }

  const buffer = await withRetry(
    () => captureScreenshot(shell, device, {
      settleCheck: options.settleCheck ?? config.settleCheckEnabled,
      settleMaxDelta: config.settleMaxDelta,
      settleDelayMs: config.settleTimeMs,
    }),
    config.retry ?? DEFAULT_RETRY_POLICY,
  );

  const projectRoot = process.cwd();

  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, buffer);
    return { path: options.output, runId: '' };
  }

  const store = new RunStore(projectRoot);
  const run = store.createRun();
  await store.writeArtifact(run.runId, 'screenshot.png', buffer);
  await store.writeMetadata(run.runId, {
    runId: run.runId,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    deviceId: device.id,
    platform: device.platform,
    orientation: 'portrait',
    framework: 'unknown',
    projectRoot,
    driftVersion: '0.1.0',
  });

  return { path: store.getRunPath(run.runId, 'screenshot.png'), runId: run.runId };
}
