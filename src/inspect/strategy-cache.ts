import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StrategyMethod } from './tree-inspector.js';

export interface CachedEntry {
  method: StrategyMethod;
  reason: string;
  appId?: string;
  timestamp: number;
}

export class StrategyCache {
  private filePath: string;
  private ttlMs: number;
  private entries: Map<string, CachedEntry>;

  constructor(projectRoot: string, ttlMs: number = 60_000) {
    this.filePath = path.join(projectRoot, '.driftx', 'strategy-cache.json');
    this.ttlMs = ttlMs;
    this.entries = this.load();
  }

  get(deviceId: string): CachedEntry | undefined {
    const entry = this.entries.get(deviceId);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.entries.delete(deviceId);
      this.persist();
      return undefined;
    }
    return entry;
  }

  set(deviceId: string, method: StrategyMethod, reason: string, appId?: string): void {
    this.entries.set(deviceId, { method, reason, appId, timestamp: Date.now() });
    this.persist();
  }

  delete(deviceId: string): void {
    this.entries.delete(deviceId);
    this.persist();
  }

  clear(): void {
    this.entries.clear();
    this.persist();
  }

  private load(): Map<string, CachedEntry> {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data: Record<string, CachedEntry> = JSON.parse(raw);
      return new Map(Object.entries(data));
    } catch {
      return new Map();
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      fs.mkdirSync(dir, { recursive: true });
      const obj: Record<string, CachedEntry> = Object.fromEntries(this.entries);
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
    } catch {
      // best-effort — don't break inspection if cache write fails
    }
  }
}
