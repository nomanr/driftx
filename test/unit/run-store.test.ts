import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RunStore } from '../../src/run-store.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('RunStore', () => {
  let tmpDir: string;
  let store: RunStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-test-'));
    store = new RunStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a new run with unique id', () => {
    const run = store.createRun();
    expect(run.runId).toBeTruthy();
    expect(fs.existsSync(run.dir)).toBe(true);
  });

  it('writes metadata', async () => {
    const run = store.createRun();
    const metadata = { runId: run.runId, startedAt: new Date().toISOString() };
    await store.writeMetadata(run.runId, metadata as any);
    const metaPath = path.join(run.dir, 'metadata.json');
    expect(fs.existsSync(metaPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    expect(content.runId).toBe(run.runId);
  });

  it('writes artifact', async () => {
    const run = store.createRun();
    const data = Buffer.from('PNG fake data');
    await store.writeArtifact(run.runId, 'screenshot.png', data);
    const artPath = path.join(run.dir, 'screenshot.png');
    expect(fs.existsSync(artPath)).toBe(true);
    expect(fs.readFileSync(artPath)).toEqual(data);
  });

  it('creates nested artifact directories', async () => {
    const run = store.createRun();
    const data = Buffer.from('region data');
    await store.writeArtifact(run.runId, 'regions/region-0.png', data);
    const artPath = path.join(run.dir, 'regions', 'region-0.png');
    expect(fs.existsSync(artPath)).toBe(true);
  });

  it('lists runs', () => {
    store.createRun();
    store.createRun();
    const runs = store.listRuns();
    expect(runs).toHaveLength(2);
  });

  it('readArtifact returns buffer for existing artifact', () => {
    const run = store.createRun();
    const data = Buffer.from('test-data');
    store.writeArtifact(run.runId, 'screenshot.png', data);
    const result = store.readArtifact(run.runId, 'screenshot.png');
    expect(result).toEqual(data);
  });

  it('readArtifact returns null for missing artifact', () => {
    const run = store.createRun();
    const result = store.readArtifact(run.runId, 'nonexistent.png');
    expect(result).toBeNull();
  });

  it('getLatestRun returns most recent run', () => {
    const run1 = store.createRun();
    const run2 = store.createRun();
    const latest = store.getLatestRun();
    expect(latest).toBeDefined();
    expect([run1.runId, run2.runId]).toContain(latest);
  });

  it('getLatestRun returns undefined when no runs exist', () => {
    const result = store.getLatestRun();
    expect(result).toBeUndefined();
  });
});
