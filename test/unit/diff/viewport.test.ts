import { describe, it, expect } from 'vitest';
import { cropViewport } from '../../../src/diff/viewport.js';
import { createSolid } from '../../fixtures/images.js';

describe('cropViewport', () => {
  it('crops android status bar', async () => {
    const img = await createSolid(1080, 2400, { r: 128, g: 128, b: 128 });
    const result = await cropViewport(img.buffer, {
      platform: 'android',
      cropStatusBar: true,
      statusBarHeight: { android: 48, ios: 59 },
      cropNavigationBar: false,
    });
    expect(result.height).toBe(2400 - 48);
    expect(result.width).toBe(1080);
  });

  it('crops iOS status bar', async () => {
    const img = await createSolid(1170, 2532, { r: 128, g: 128, b: 128 });
    const result = await cropViewport(img.buffer, {
      platform: 'ios',
      cropStatusBar: true,
      statusBarHeight: { android: 48, ios: 59 },
      cropNavigationBar: false,
    });
    expect(result.height).toBe(2532 - 59);
  });

  it('does not crop when disabled', async () => {
    const img = await createSolid(1080, 2400, { r: 128, g: 128, b: 128 });
    const result = await cropViewport(img.buffer, {
      platform: 'android',
      cropStatusBar: false,
      statusBarHeight: { android: 48, ios: 59 },
      cropNavigationBar: false,
    });
    expect(result.height).toBe(2400);
  });
});
