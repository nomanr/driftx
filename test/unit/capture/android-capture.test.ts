import { describe, it, expect } from 'vitest';
import { captureAndroidScreenshot } from '../../../src/capture/android-capture.js';
import { createMockShell } from '../../helpers/mock-shell.js';
import * as fs from 'node:fs';

const DEVICE_ID = 'emulator-5554';
const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xff]);

describe('captureAndroidScreenshot', () => {
  it('returns PNG buffer via adb screencap and pull', async () => {
    const shell = createMockShell({
      'shell screencap': { stdout: '', stderr: '' },
      'pull /sdcard/driftx-tmp.png': (fullCmd: string) => {
        const parts = fullCmd.split('/sdcard/driftx-tmp.png ');
        const localPath = parts[1];
        fs.writeFileSync(localPath, FAKE_PNG);
        return { stdout: `1 file pulled`, stderr: '' };
      },
      'shell rm': { stdout: '', stderr: '' },
    });

    const buffer = await captureAndroidScreenshot(shell, DEVICE_ID);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(shell.calls.some((c) => c.includes('screencap'))).toBe(true);
    expect(shell.calls.some((c) => c.includes('pull'))).toBe(true);
  });

  it('throws when pulled file is empty', async () => {
    const shell = createMockShell({
      'shell screencap': { stdout: '', stderr: '' },
      'pull /sdcard/driftx-tmp.png': (fullCmd: string) => {
        const parts = fullCmd.split('/sdcard/driftx-tmp.png ');
        const localPath = parts[1];
        fs.writeFileSync(localPath, Buffer.alloc(0));
        return { stdout: '1 file pulled', stderr: '' };
      },
      'shell rm': { stdout: '', stderr: '' },
    });

    await expect(captureAndroidScreenshot(shell, DEVICE_ID)).rejects.toThrow('empty buffer');
  });

  it('throws when screencap command fails', async () => {
    const shell = createMockShell({
      'shell screencap': () => {
        throw new Error('screencap failed');
      },
      'shell rm': { stdout: '', stderr: '' },
    });

    await expect(captureAndroidScreenshot(shell, DEVICE_ID)).rejects.toThrow('screencap failed');
  });

  it('cleans up device temp file even on failure', async () => {
    const shell = createMockShell({
      'shell screencap': { stdout: '', stderr: '' },
      'pull /sdcard/driftx-tmp.png': () => {
        throw new Error('pull failed');
      },
      'shell rm': { stdout: '', stderr: '' },
    });

    await expect(captureAndroidScreenshot(shell, DEVICE_ID)).rejects.toThrow('pull failed');
    expect(shell.calls.some((c) => c.includes('shell rm'))).toBe(true);
  });
});
