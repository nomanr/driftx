import { describe, it, expect, afterEach } from 'vitest';
import { captureIosScreenshot } from '../../../src/capture/ios-capture.js';
import { createMockShell } from '../../helpers/mock-shell.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const DEVICE_ID = 'ABCD-1234-SIM';
const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xff]);

describe('captureIosScreenshot', () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
    tmpFiles.length = 0;
  });

  it('returns PNG buffer from simctl screenshot', async () => {
    const tmpPath = path.join(os.tmpdir(), `drift-ios-test-${Date.now()}.png`);
    tmpFiles.push(tmpPath);

    const shell = createMockShell({
      'simctl io': (fullCmd: string) => {
        const parts = fullCmd.split(' ');
        const outputPath = parts[parts.length - 1];
        fs.writeFileSync(outputPath, FAKE_PNG);
        return { stdout: '', stderr: '' };
      },
    });

    const buffer = await captureIosScreenshot(shell, DEVICE_ID, tmpPath);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(shell.calls[0]).toContain('simctl io');
    expect(shell.calls[0]).toContain(DEVICE_ID);
  });

  it('throws when screenshot file is not created', async () => {
    const tmpPath = path.join(os.tmpdir(), `drift-ios-missing-${Date.now()}.png`);

    const shell = createMockShell({
      'simctl io': { stdout: '', stderr: '' },
    });

    await expect(captureIosScreenshot(shell, DEVICE_ID, tmpPath)).rejects.toThrow('not created');
  });

  it('throws when screenshot file is empty', async () => {
    const tmpPath = path.join(os.tmpdir(), `drift-ios-empty-${Date.now()}.png`);
    tmpFiles.push(tmpPath);

    const shell = createMockShell({
      'simctl io': () => {
        fs.writeFileSync(tmpPath, Buffer.alloc(0));
        return { stdout: '', stderr: '' };
      },
    });

    await expect(captureIosScreenshot(shell, DEVICE_ID, tmpPath)).rejects.toThrow('empty file');
  });
});
