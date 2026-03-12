import { describe, it, expect } from 'vitest';
import { createShell } from '../../../src/shell.js';
import { discoverAndroidDevices } from '../../../src/devices/android-discovery.js';
import { captureAndroidScreenshot } from '../../../src/capture/android-capture.js';

const SKIP = !process.env.DRIFTX_DEVICE_TESTS;

describe.skipIf(SKIP)('@device Android capture', () => {
  it('discovers at least one Android device', async () => {
    const shell = createShell();
    const devices = await discoverAndroidDevices(shell);
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0].platform).toBe('android');
  });

  it('captures a screenshot from the first booted device', async () => {
    const shell = createShell();
    const devices = await discoverAndroidDevices(shell);
    const booted = devices.find((d) => d.state === 'booted');
    expect(booted).toBeDefined();
    const buffer = await captureAndroidScreenshot(shell, booted!.id);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer[0]).toBe(0x89);
  });
});
