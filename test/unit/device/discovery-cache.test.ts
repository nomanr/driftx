import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceDiscovery } from '../../../src/devices/discovery.js';
import { createMockShell } from '../../helpers/mock-shell.js';
import { adbFixtures } from '../../fixtures/adb-output.js';
import { simctlFixtures } from '../../fixtures/simctl-output.js';

function createShellWithDevices() {
  return createMockShell({
    'adb devices -l': { stdout: adbFixtures.singleDevice, stderr: '' },
    'adb -s emulator-5554 shell getprop ro.build.version.sdk': { stdout: adbFixtures.apiLevel34, stderr: '' },
    'xcrun simctl list devices --json': { stdout: simctlFixtures.singleBooted, stderr: '' },
  });
}

describe('DeviceDiscovery', () => {
  it('discovers devices from both platforms', async () => {
    const shell = createShellWithDevices();
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    expect(devices).toHaveLength(2);
    expect(devices.map((d) => d.platform)).toContain('android');
    expect(devices.map((d) => d.platform)).toContain('ios');
  });

  it('caches results within TTL', async () => {
    const shell = createShellWithDevices();
    const discovery = new DeviceDiscovery(shell, { cacheTtlMs: 30000 });
    await discovery.list();
    await discovery.list();
    expect(shell.calls).toHaveLength(3); // adb devices + adb getprop + simctl, not doubled
  });

  it('refreshes after TTL expires', async () => {
    vi.useFakeTimers();
    const shell = createShellWithDevices();
    const discovery = new DeviceDiscovery(shell, { cacheTtlMs: 100 });
    await discovery.list();
    vi.advanceTimersByTime(150);
    await discovery.list();
    expect(shell.calls).toHaveLength(6); // two rounds of (adb devices + adb getprop + simctl)
    vi.useRealTimers();
  });

  it('handles adb failure gracefully', async () => {
    const shell = createMockShell({
      'adb devices -l': async () => { throw new Error('adb not found'); },
      'xcrun simctl list devices --json': { stdout: simctlFixtures.singleBooted, stderr: '' },
    });
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    expect(devices).toHaveLength(1);
    expect(devices[0].platform).toBe('ios');
  });

  it('handles simctl failure gracefully', async () => {
    const shell = createMockShell({
      'adb devices -l': { stdout: adbFixtures.singleDevice, stderr: '' },
      'adb -s emulator-5554 shell getprop ro.build.version.sdk': { stdout: adbFixtures.apiLevel34, stderr: '' },
      'xcrun simctl list devices --json': async () => { throw new Error('xcrun not found'); },
    });
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    expect(devices).toHaveLength(1);
    expect(devices[0].platform).toBe('android');
  });

  it('finds device by id', async () => {
    const shell = createShellWithDevices();
    const discovery = new DeviceDiscovery(shell);
    const device = await discovery.findById('emulator-5554');
    expect(device?.id).toBe('emulator-5554');
  });

  it('returns undefined for unknown device id', async () => {
    const shell = createShellWithDevices();
    const discovery = new DeviceDiscovery(shell);
    const device = await discovery.findById('nonexistent');
    expect(device).toBeUndefined();
  });
});
