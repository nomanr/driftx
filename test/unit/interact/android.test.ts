import { describe, it, expect, vi } from 'vitest';
import { AndroidBackend } from '../../../src/interact/android.js';
import type { DeviceInfo } from '../../../src/types.js';

const device: DeviceInfo = {
  id: 'emulator-5554',
  name: 'Pixel 8',
  platform: 'android',
  osVersion: '14',
  state: 'booted',
};

function makeShell() {
  return { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }) };
}

describe('AndroidBackend', () => {
  it('taps at coordinates', async () => {
    const shell = makeShell();
    await new AndroidBackend(shell).tap(device, { x: 150, y: 300 });
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'tap', '150', '300']);
  });

  it('long presses via swipe to same point', async () => {
    const shell = makeShell();
    await new AndroidBackend(shell).longPress(device, { x: 100, y: 200 }, 800);
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'swipe', '100', '200', '100', '200', '800']);
  });

  it('swipes between two points', async () => {
    const shell = makeShell();
    await new AndroidBackend(shell).swipe(device, { x: 50, y: 400 }, { x: 50, y: 100 }, 300);
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'swipe', '50', '400', '50', '100', '300']);
  });

  it('types text', async () => {
    const shell = makeShell();
    await new AndroidBackend(shell).type(device, 'hello');
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'text', 'hello']);
  });

  it('escapes spaces in typed text', async () => {
    const shell = makeShell();
    await new AndroidBackend(shell).type(device, 'hello world');
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'text', 'hello%sworld']);
  });

  it('sends key events', async () => {
    const shell = makeShell();
    await new AndroidBackend(shell).keyEvent(device, 'KEYCODE_BACK');
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  });

  it('opens URLs via am start', async () => {
    const shell = makeShell();
    await new AndroidBackend(shell).openUrl(device, 'https://example.com');
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'https://example.com']);
  });
});
