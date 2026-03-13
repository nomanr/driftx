import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_DIR = join(homedir(), '.driftx');
const CACHE_FILE = join(CACHE_DIR, 'update-check.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

export function shouldCheck(cache: UpdateCache | null): boolean {
  if (!cache) return true;
  return Date.now() - cache.lastCheck > CHECK_INTERVAL_MS;
}

export function formatUpdateMessage(current: string, latest: string): string | null {
  if (compareVersions(current, latest) >= 0) return null;
  return `  Update available: ${current} → ${latest}\n  Run: npm install -g driftx`;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function readCache(): UpdateCache | null {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {}
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://registry.npmjs.org/driftx/latest', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json() as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export async function checkForUpdate(currentVersion: string): Promise<string | null> {
  const cache = readCache();
  if (!shouldCheck(cache)) {
    return cache ? formatUpdateMessage(currentVersion, cache.latestVersion) : null;
  }

  fetchLatestVersion().then((latest) => {
    if (latest) {
      writeCache({ lastCheck: Date.now(), latestVersion: latest });
    }
  }).catch(() => {});

  return cache ? formatUpdateMessage(currentVersion, cache.latestVersion) : null;
}
