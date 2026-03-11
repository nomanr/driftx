import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Shell } from '../types.js';

const DEVICE_TMP_PATH = '/sdcard/drift-tmp.png';

export async function captureAndroidScreenshot(
  shell: Shell,
  deviceId: string,
  timeout?: number,
): Promise<Buffer> {
  const localTmp = path.join(os.tmpdir(), `drift-android-${Date.now()}-${deviceId}.png`);

  try {
    await shell.exec(
      'adb',
      ['-s', deviceId, 'shell', 'screencap', '-p', DEVICE_TMP_PATH],
      timeout ? { timeout } : undefined,
    );
    await shell.exec('adb', ['-s', deviceId, 'pull', DEVICE_TMP_PATH, localTmp]);

    if (!fs.existsSync(localTmp)) {
      throw new Error('Screenshot capture returned empty buffer — pull did not create local file');
    }
    const buffer = fs.readFileSync(localTmp);
    if (buffer.length === 0) {
      throw new Error('Screenshot capture returned empty buffer');
    }
    return buffer;
  } finally {
    try {
      await shell.exec('adb', ['-s', deviceId, 'shell', 'rm', DEVICE_TMP_PATH]);
    } catch {}
    try {
      if (fs.existsSync(localTmp)) fs.unlinkSync(localTmp);
    } catch {}
  }
}
