import { describe, it, expect, vi } from 'vitest';
import { IosBackend } from '../../../src/interact/ios.js';
import type { DeviceInfo } from '../../../src/types.js';

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

describe('IosBackend', () => {
  it('taps via simctl io', async () => {
    const shell = makeShell();
    await new IosBackend(shell).tap(device, { x: 100, y: 200 });
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'tap', '100', '200']);
  });

  it('long presses via simctl io', async () => {
    const shell = makeShell();
    await new IosBackend(shell).longPress(device, { x: 50, y: 75 }, 1000);
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'longpress', '50', '75']);
  });

  it('swipes via simctl io', async () => {
    const shell = makeShell();
    await new IosBackend(shell).swipe(device, { x: 10, y: 20 }, { x: 300, y: 400 }, 500);
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'swipe', '10', '20', '300', '400']);
  });

  it('types text via simctl io', async () => {
    const shell = makeShell();
    await new IosBackend(shell).type(device, 'hello');
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'type', 'hello']);
  });

  it('sends key via simctl io', async () => {
    const shell = makeShell();
    await new IosBackend(shell).keyEvent(device, 'home');
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'sendkey', 'home']);
  });

  it('opens URLs via simctl openurl (not under io)', async () => {
    const shell = makeShell();
    await new IosBackend(shell).openUrl(device, 'https://example.com');
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'openurl', 'ABCD-1234', 'https://example.com']);
  });
});
