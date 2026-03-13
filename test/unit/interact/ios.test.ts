import { describe, it, expect, vi } from 'vitest';
import { IosBackend } from '../../../src/interact/ios.js';
import type { DeviceInfo } from '../../../src/types.js';
import type { CompanionClient } from '../../../src/ios-companion/client.js';

const device: DeviceInfo = {
  id: 'ABCD-1234',
  name: 'iPhone 16 Pro',
  platform: 'ios',
  osVersion: '18.0',
  state: 'booted',
};

function makeShell() {
  return { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }) };
}

function makeCompanion(): CompanionClient {
  return {
    status: vi.fn().mockResolvedValue({ status: 'ok' }),
    tap: vi.fn().mockResolvedValue(undefined),
    longPress: vi.fn().mockResolvedValue(undefined),
    swipe: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    keyEvent: vi.fn().mockResolvedValue(undefined),
    hierarchy: vi.fn().mockResolvedValue([]),
  } as unknown as CompanionClient;
}

describe('IosBackend', () => {
  it('taps via companion', async () => {
    const shell = makeShell();
    const companion = makeCompanion();
    await new IosBackend(shell, companion).tap(device, { x: 100, y: 200 });
    expect(companion.tap).toHaveBeenCalledWith(100, 200);
  });

  it('long presses via companion', async () => {
    const shell = makeShell();
    const companion = makeCompanion();
    await new IosBackend(shell, companion).longPress(device, { x: 50, y: 75 }, 1000);
    expect(companion.longPress).toHaveBeenCalledWith(50, 75, 1000);
  });

  it('swipes via companion', async () => {
    const shell = makeShell();
    const companion = makeCompanion();
    await new IosBackend(shell, companion).swipe(device, { x: 10, y: 20 }, { x: 300, y: 400 }, 500);
    expect(companion.swipe).toHaveBeenCalledWith(10, 20, 300, 400, 500);
  });

  it('types text via companion', async () => {
    const shell = makeShell();
    const companion = makeCompanion();
    await new IosBackend(shell, companion).type(device, 'hello');
    expect(companion.type).toHaveBeenCalledWith('hello');
  });

  it('sends key via companion', async () => {
    const shell = makeShell();
    const companion = makeCompanion();
    await new IosBackend(shell, companion).keyEvent(device, 'home');
    expect(companion.keyEvent).toHaveBeenCalledWith('home');
  });

  it('opens URLs via simctl openurl (not via companion)', async () => {
    const shell = makeShell();
    const companion = makeCompanion();
    await new IosBackend(shell, companion).openUrl(device, 'https://example.com');
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'openurl', 'ABCD-1234', 'https://example.com']);
  });
});
