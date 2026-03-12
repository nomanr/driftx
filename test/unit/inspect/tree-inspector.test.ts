import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
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

  it('includes idb install hint when iOS inspection fails', async () => {
    const shell = createMockShell({});
    const inspector = new TreeInspector(shell);
    const result = await inspector.inspect(iosDevice, { metroPort: 0, devToolsPort: 0, timeoutMs: 100 });
    expect(result.hints).toHaveLength(1);
    expect(result.hints[0]).toContain('idb');
    expect(result.hints[0]).toContain('brew install');
  });

  it('returns empty hints on successful inspection', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': {
        stdout: uiautomatorFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const inspector = new TreeInspector(shell);
    const result = await inspector.inspect(androidDevice, { metroPort: 0, devToolsPort: 0, timeoutMs: 100 });
    expect(result.hints).toHaveLength(0);
  });
});

describe('TreeInspector strategy cache', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-cache-test-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('caches strategy and reuses on second call', async () => {
    let callCount = 0;
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': () => {
        callCount++;
        return { stdout: uiautomatorFixtures.simpleHierarchy, stderr: '' };
      },
    });
    const inspector = new TreeInspector(shell, tmpDir);
    const opts = { metroPort: 0, devToolsPort: 0, timeoutMs: 100 };

    const spy = vi.spyOn(inspector, 'resolveStrategy');

    await inspector.inspect(androidDevice, opts);
    await inspector.inspect(androidDevice, opts);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(2);
  });

  it('persists cache to disk across instances', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': {
        stdout: uiautomatorFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const opts = { metroPort: 0, devToolsPort: 0, timeoutMs: 100 };

    const inspector1 = new TreeInspector(shell, tmpDir);
    await inspector1.inspect(androidDevice, opts);

    const inspector2 = new TreeInspector(shell, tmpDir);
    const spy = vi.spyOn(inspector2, 'resolveStrategy');
    await inspector2.inspect(androidDevice, opts);

    expect(spy).toHaveBeenCalledTimes(0);
  });

  it('invalidates cache on complete failure', async () => {
    let attempt = 0;
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': () => {
        attempt++;
        if (attempt === 1) return { stdout: uiautomatorFixtures.simpleHierarchy, stderr: '' };
        throw new Error('device disconnected');
      },
    });
    const inspector = new TreeInspector(shell, tmpDir);
    const opts = { metroPort: 0, devToolsPort: 0, timeoutMs: 100 };

    const r1 = await inspector.inspect(androidDevice, opts);
    expect(r1.tree.length).toBeGreaterThan(0);

    const r2 = await inspector.inspect(androidDevice, opts);
    expect(r2.tree).toHaveLength(0);
    expect(r2.capabilities.tree).toBe('none');

    const spy = vi.spyOn(inspector, 'resolveStrategy');
    await inspector.inspect(androidDevice, opts);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('expires cache after TTL', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': {
        stdout: uiautomatorFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const inspector = new TreeInspector(shell, tmpDir);
    const opts = { metroPort: 0, devToolsPort: 0, timeoutMs: 100 };

    await inspector.inspect(androidDevice, opts);

    const spy = vi.spyOn(inspector, 'resolveStrategy');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_001);

    await inspector.inspect(androidDevice, opts);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('invalidateCache clears specific device', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': {
        stdout: uiautomatorFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const inspector = new TreeInspector(shell, tmpDir);
    const opts = { metroPort: 0, devToolsPort: 0, timeoutMs: 100 };

    await inspector.inspect(androidDevice, opts);
    inspector.invalidateCache(androidDevice.id);

    const spy = vi.spyOn(inspector, 'resolveStrategy');
    await inspector.inspect(androidDevice, opts);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('invalidateCache with no arg clears all', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': {
        stdout: uiautomatorFixtures.simpleHierarchy,
        stderr: '',
      },
      'idb ui describe-all --udid ABC-DEF-123': {
        stdout: iosAccessibilityFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const inspector = new TreeInspector(shell, tmpDir);
    const opts = { metroPort: 0, devToolsPort: 0, timeoutMs: 100 };

    await inspector.inspect(androidDevice, opts);
    await inspector.inspect(iosDevice, opts);
    inspector.invalidateCache();

    const spy = vi.spyOn(inspector, 'resolveStrategy');
    await inspector.inspect(androidDevice, opts);
    await inspector.inspect(iosDevice, opts);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
