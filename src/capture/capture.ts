import type { DeviceInfo, Shell } from '../types.js';
import { captureAndroidScreenshot } from './android-capture.js';
import { captureIosScreenshot } from './ios-capture.js';
import { getLogger } from '../logger.js';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export function isScreenSettled(buf1: Buffer, buf2: Buffer, maxDelta: number): boolean {
  const img1 = PNG.sync.read(buf1);
  const img2 = PNG.sync.read(buf2);
  if (img1.width !== img2.width || img1.height !== img2.height) return false;
  const diffPixels = pixelmatch(img1.data, img2.data, null, img1.width, img1.height, {
    threshold: 0.1,
  });
  const totalPixels = img1.width * img1.height;
  return diffPixels / totalPixels <= maxDelta;
}

export interface CaptureOptions {
  settleCheck?: boolean;
  settleMaxDelta?: number;
  settleDelayMs?: number;
  settleMaxAttempts?: number;
  timeout?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function captureScreenshot(
  shell: Shell,
  device: DeviceInfo,
  options?: CaptureOptions,
): Promise<Buffer> {
  const logger = getLogger();
  const captureOnce = async (): Promise<Buffer> => {
    if (device.platform === 'android') {
      return captureAndroidScreenshot(shell, device.id, options?.timeout);
    }
    return captureIosScreenshot(shell, device.id);
  };

  let buffer = await captureOnce();

  if (options?.settleCheck) {
    const maxDelta = options.settleMaxDelta ?? 0.001;
    const delayMs = options.settleDelayMs ?? 300;
    const maxAttempts = options.settleMaxAttempts ?? 5;

    for (let i = 0; i < maxAttempts; i++) {
      await delay(delayMs);
      const next = await captureOnce();
      if (isScreenSettled(buffer, next, maxDelta)) {
        logger.debug(`Screen settled after ${i + 1} check(s)`);
        return next;
      }
      buffer = next;
    }
    logger.warn('Screen did not settle within max attempts, using last capture');
  }

  return buffer;
}
