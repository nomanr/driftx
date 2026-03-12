import { describe, it, expect } from 'vitest';
import { createShell } from '../../../src/shell.js';
import { discoverIosDevices } from '../../../src/devices/ios-discovery.js';
import { captureIosScreenshot } from '../../../src/capture/ios-capture.js';

const SKIP = !process.env.DRIFTX_DEVICE_TESTS;

describe.skipIf(SKIP)('@device iOS capture', () => {
  it('discovers at least one iOS simulator', async () => {
    const shell = createShell();
    const devices = await discoverIosDevices(shell);
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0].platform).toBe('ios');
  });

  it('captures a screenshot from the first booted simulator', async () => {
    const shell = createShell();
    const devices = await discoverIosDevices(shell);
    const booted = devices.find((d) => d.state === 'booted');
    expect(booted).toBeDefined();
    const buffer = await captureIosScreenshot(shell, booted!.id);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer[0]).toBe(0x89);
  });
});
