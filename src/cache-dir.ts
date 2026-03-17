import { join } from 'node:path';
import { homedir, platform } from 'node:os';

export function getCacheDir(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Caches', 'driftx');
  }
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg) return join(xdg, 'driftx');
  return join(homedir(), '.cache', 'driftx');
}

export function getRunsDir(): string {
  return join(getCacheDir(), 'runs');
}
