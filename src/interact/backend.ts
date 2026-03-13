import type { Shell } from '../types.js';
import type { InteractionBackend } from './types.js';
import type { CompanionClient } from '../ios-companion/client.js';
import { AndroidBackend } from './android.js';
import { IosBackend } from './ios.js';

export function createBackend(shell: Shell, platform: 'android' | 'ios', companion?: CompanionClient): InteractionBackend {
  if (platform === 'android') return new AndroidBackend(shell);
  if (!companion) throw new Error('iOS interactions require the XCUITest companion. Run on a simulator with Xcode installed.');
  return new IosBackend(shell, companion);
}
