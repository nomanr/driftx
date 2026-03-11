import { describe, it, expect } from 'vitest';
import { createMockShell } from '../../helpers/mock-shell.js';
import { checkPrerequisites } from '../../../src/prerequisites.js';

function makeHandlers(overrides: Record<string, { stdout: string; stderr: string } | (() => never)> = {}) {
  const defaults: Record<string, { stdout: string; stderr: string } | (() => never)> = {
    'node --version': { stdout: 'v20.11.0\n', stderr: '' },
    'adb --version': { stdout: 'Android Debug Bridge version 34.0.5\n', stderr: '' },
    'xcrun --version': { stdout: 'xcrun version 73.\n', stderr: '' },
    'npx react-native': { stdout: 'info Metro running on port 8081\n', stderr: '' },
  };
  return { ...defaults, ...overrides };
}

describe('prerequisites', () => {
  it('detects adb when available', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell);
    const adb = checks.find((c) => c.name === 'adb');
    expect(adb?.available).toBe(true);
    expect(adb?.version).toContain('34.0.5');
  });

  it('reports adb missing with fix instruction', async () => {
    const shell = createMockShell(makeHandlers({
      'adb --version': () => { throw new Error('command not found: adb'); },
    }));
    const checks = await checkPrerequisites(shell);
    const adb = checks.find((c) => c.name === 'adb');
    expect(adb?.available).toBe(false);
    expect(adb?.fix).toBeDefined();
    expect(adb?.fix).toContain('Android SDK');
  });

  it('checks node version', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell);
    const node = checks.find((c) => c.name === 'node');
    expect(node?.available).toBe(true);
    expect(node?.version).toContain('20.11.0');
  });

  it('marks node as required', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell);
    const node = checks.find((c) => c.name === 'node');
    expect(node?.required).toBe(true);
  });

  it('detects xcrun when available', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell);
    const xcrun = checks.find((c) => c.name === 'xcrun');
    expect(xcrun?.available).toBe(true);
  });

  it('marks metro as optional', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell);
    const metro = checks.find((c) => c.name === 'metro');
    expect(metro?.required).toBe(false);
  });
});
