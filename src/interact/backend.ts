import type { Shell } from '../types.js';
import type { InteractionBackend } from './types.js';
import { AndroidBackend } from './android.js';
import { IosBackend } from './ios.js';

export function createBackend(shell: Shell, platform: 'android' | 'ios'): InteractionBackend {
  return platform === 'android' ? new AndroidBackend(shell) : new IosBackend(shell);
}
