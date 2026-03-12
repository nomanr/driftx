import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Shell } from '../types.js';

export async function captureIosScreenshot(
  shell: Shell,
  deviceId: string,
  tmpPath?: string,
): Promise<Buffer> {
  const screenshotPath = tmpPath ?? path.join(os.tmpdir(), `driftx-ios-${Date.now()}.png`);
  await shell.exec('xcrun', ['simctl', 'io', deviceId, 'screenshot', screenshotPath]);

  if (!fs.existsSync(screenshotPath)) {
    throw new Error(`iOS screenshot not created at ${screenshotPath}`);
  }
  const buffer = fs.readFileSync(screenshotPath);
  if (!tmpPath) fs.unlinkSync(screenshotPath);
  if (buffer.length === 0) throw new Error('iOS screenshot capture returned empty file');
  return buffer;
}
