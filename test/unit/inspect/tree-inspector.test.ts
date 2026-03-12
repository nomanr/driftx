import { describe, it, expect } from 'vitest';
import { TreeInspector } from '../../../src/inspect/tree-inspector.js';
import { createMockShell } from '../../helpers/mock-shell.js';
import { uiautomatorFixtures } from '../../fixtures/uiautomator-output.js';
import { iosAccessibilityFixtures } from '../../fixtures/ios-accessibility-output.js';
import type { DeviceInfo } from '../../../src/types.js';

const androidDevice: DeviceInfo = {
  id: 'emulator-5554',
  name: 'Pixel_7',
  platform: 'android',
  osVersion: '34',
  state: 'booted',
};

const iosDevice: DeviceInfo = {
  id: 'ABC-DEF-123',
  name: 'iPhone 16 Pro',
  platform: 'ios',
  osVersion: '18.0',
  state: 'booted',
};

describe('TreeInspector', () => {
  it('returns Android tree via UIAutomator (Tier A)', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': {
        stdout: uiautomatorFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const inspector = new TreeInspector(shell);
    const result = await inspector.inspect(androidDevice, { metroPort: 0, devToolsPort: 0, timeoutMs: 100 });
    expect(result.tree.length).toBeGreaterThan(0);
    expect(result.capabilities.tree).toBe('basic');
    expect(result.capabilities.protocol).toBe('uiautomator');
    expect(result.strategy.method).toBe('uiautomator');
    expect(result.device.platform).toBe('android');
  });

  it('returns iOS tree via idb (Tier A)', async () => {
    const shell = createMockShell({
      'idb ui describe-all --udid ABC-DEF-123': {
        stdout: iosAccessibilityFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const inspector = new TreeInspector(shell);
    const result = await inspector.inspect(iosDevice, { metroPort: 0, devToolsPort: 0, timeoutMs: 100 });
    expect(result.tree.length).toBeGreaterThan(0);
    expect(result.capabilities.tree).toBe('basic');
    expect(result.capabilities.protocol).toBe('idb');
    expect(result.strategy.method).toBe('idb');
    expect(result.device.platform).toBe('ios');
  });

  it('returns empty tree for iOS when accessibility fails', async () => {
    const shell = createMockShell({});
    const inspector = new TreeInspector(shell);
    const result = await inspector.inspect(iosDevice, { metroPort: 0, devToolsPort: 0, timeoutMs: 100 });
    expect(result.tree).toHaveLength(0);
    expect(result.capabilities.tree).toBe('none');
  });

  it('reports capabilities honestly', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': {
        stdout: uiautomatorFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const inspector = new TreeInspector(shell);
    const result = await inspector.inspect(androidDevice, { metroPort: 0, devToolsPort: 0, timeoutMs: 100 });
    expect(result.capabilities.sourceMapping).toBe('none');
    expect(result.capabilities.styles).toBe('none');
  });

  it('falls back to Tier A when DevTools is unreachable', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': {
        stdout: uiautomatorFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const inspector = new TreeInspector(shell);
    const result = await inspector.inspect(androidDevice, { metroPort: 0, devToolsPort: 19999, timeoutMs: 500 });
    expect(result.tree.length).toBeGreaterThan(0);
    expect(result.capabilities.tree).toBe('basic');
  });

  it('handles UIAutomator failure gracefully', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': async () => {
        throw new Error('uiautomator error');
      },
    });
    const inspector = new TreeInspector(shell);
    const result = await inspector.inspect(androidDevice, { metroPort: 0, devToolsPort: 0, timeoutMs: 100 });
    expect(result.tree).toHaveLength(0);
    expect(result.capabilities.tree).toBe('none');
  });
});
