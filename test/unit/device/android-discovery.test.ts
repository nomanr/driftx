import { describe, it, expect } from 'vitest';
import { parseAdbDevices } from '../../../src/devices/android-discovery.js';
import { createMockShell } from '../../helpers/mock-shell.js';
import { adbFixtures } from '../../fixtures/adb-output.js';

describe('parseAdbDevices', () => {
  it('parses two connected devices', () => {
    const devices = parseAdbDevices(adbFixtures.twoDevices);
    expect(devices).toHaveLength(2);
    expect(devices[0].id).toBe('emulator-5554');
    expect(devices[0].platform).toBe('android');
    expect(devices[0].state).toBe('booted');
    expect(devices[1].name).toBe('Pixel_7');
  });

  it('parses single device', () => {
    const devices = parseAdbDevices(adbFixtures.singleDevice);
    expect(devices).toHaveLength(1);
  });

  it('returns empty for no devices', () => {
    const devices = parseAdbDevices(adbFixtures.noDevices);
    expect(devices).toHaveLength(0);
  });

  it('detects offline state', () => {
    const devices = parseAdbDevices(adbFixtures.offlineDevice);
    expect(devices[0].state).toBe('offline');
  });

  it('detects unauthorized state', () => {
    const devices = parseAdbDevices(adbFixtures.unauthorizedDevice);
    expect(devices[0].state).toBe('unauthorized');
  });

  it('handles mixed device states', () => {
    const devices = parseAdbDevices(adbFixtures.mixedStates);
    expect(devices).toHaveLength(3);
    expect(devices[0].state).toBe('booted');
    expect(devices[1].state).toBe('unauthorized');
    expect(devices[2].state).toBe('offline');
  });

  it('returns empty for malformed output', () => {
    const devices = parseAdbDevices(adbFixtures.malformed);
    expect(devices).toHaveLength(0);
  });
});

describe('discoverAndroidDevices', () => {
  it('fetches API level for each device and populates osVersion', async () => {
    const { discoverAndroidDevices } = await import('../../../src/devices/android-discovery.js');
    const shell = createMockShell({
      'adb devices -l': { stdout: adbFixtures.singleDevice, stderr: '' },
      'adb -s emulator-5554 shell getprop ro.build.version.sdk': { stdout: adbFixtures.apiLevel34, stderr: '' },
    });
    const devices = await discoverAndroidDevices(shell);
    expect(devices).toHaveLength(1);
    expect(devices[0].osVersion).toBe('34');
  });

  it('handles API level fetch failure gracefully', async () => {
    const { discoverAndroidDevices } = await import('../../../src/devices/android-discovery.js');
    const shell = createMockShell({
      'adb devices -l': { stdout: adbFixtures.singleDevice, stderr: '' },
      'adb -s emulator-5554 shell getprop ro.build.version.sdk': async () => { throw new Error('timeout'); },
    });
    const devices = await discoverAndroidDevices(shell);
    expect(devices).toHaveLength(1);
    expect(devices[0].osVersion).toBe('');
  });
});
