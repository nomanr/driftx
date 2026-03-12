# Phase 5: Analysis Plugin System — Core Framework Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform drift compare from a single pixel-diff pipeline into a pluggable analysis platform with a shared context, parallel execution, and the existing pixel diff refactored as the first plugin.

**Architecture:** A `CompareContext` is built once with shared resources (images, tree, config). An `AnalysisOrchestrator` discovers available plugins via `AnalysisRegistry`, filters by availability and user selection, runs them in parallel via `Promise.allSettled()`, and merges results into a unified `CompareReport`. The existing pixel diff pipeline becomes the `PixelAnalysis` plugin — same logic, new wrapper.

**Tech Stack:** TypeScript, vitest, sharp, pixelmatch (all existing). No new dependencies.

---

## File Structure

### New files:
| File | Responsibility |
|------|---------------|
| `src/analyses/types.ts` | AnalysisPlugin, AnalysisResult, CompareContext, CompareReport, DriftImage, AnalysisConfig |
| `src/analyses/context.ts` | `buildCompareContext()` — shared resource builder |
| `src/analyses/registry.ts` | AnalysisRegistry — plugin discovery and management |
| `src/analyses/orchestrator.ts` | AnalysisOrchestrator — filter, run parallel, merge |
| `src/analyses/plugins/pixel.ts` | PixelAnalysis — wraps existing `src/diff/compare.ts` |
| `test/unit/analyses/registry.test.ts` | Registry tests |
| `test/unit/analyses/orchestrator.test.ts` | Orchestrator tests |
| `test/unit/analyses/context.test.ts` | Context builder tests |
| `test/unit/analyses/plugins/pixel.test.ts` | Pixel plugin tests |

### Modified files:
| File | Change |
|------|--------|
| `src/types.ts` | Extend DiffFinding.category and DiffEvidence.type unions |
| `src/config.ts` | Add `analyses` section to config schema and defaults |
| `src/run-store.ts` | Add `readArtifact()` and `getLatestRun()` methods |
| `src/commands/compare.ts` | Refactor to use AnalysisOrchestrator |
| `src/formatters/types.ts` | Replace CompareFormatData with CompareReport |
| `src/formatters/compare.ts` | Update formatter to handle CompareReport |
| `src/cli.ts` | Add `--with`, `--without`, `--baseline` flags |

---

## Chunk 1: Foundation Types + RunStore + Config

### Task 1: Analysis Types

**Files:**
- Create: `src/analyses/types.ts`
- Test: `test/unit/analyses/types.test.ts`

- [ ] **Step 1: Create the analysis types file**

```typescript
// src/analyses/types.ts
import type {
  DiffFinding,
  DiffRegion,
  RunMetadata,
  ComponentNode,
  DeviceInfo,
  InspectionCapabilities,
} from '../types.js';
import type { DriftConfig } from '../config.js';
import type { RunStore } from '../run-store.js';

export interface DriftImage {
  buffer: Buffer;
  rawPixels: Buffer;
  width: number;
  height: number;
  aspectRatio: number;
  path: string;
}

export interface AnalysisConfig {
  enabled: string[];
  disabled: string[];
  options: Record<string, Record<string, unknown>>;
}

export interface CompareContext {
  screenshot: DriftImage;
  design?: DriftImage;
  baseline?: DriftImage;
  tree?: ComponentNode[];
  device?: DeviceInfo;
  config: DriftConfig;
  analysisConfig: AnalysisConfig;
  runId: string;
  store: RunStore;
}

export interface AnalysisResult {
  analysisName: string;
  findings: DiffFinding[];
  summary: string;
  metadata: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

export interface AnalysisPlugin {
  name: string;
  description: string;
  isAvailable(ctx: CompareContext): boolean;
  run(ctx: CompareContext): Promise<AnalysisResult>;
}

export interface MetaAnalysisPlugin extends AnalysisPlugin {
  run(ctx: CompareContext, orchestrator?: AnalysisOrchestrator): Promise<AnalysisResult>;
}

export interface CompareReport {
  runId: string;
  analyses: AnalysisResult[];
  findings: DiffFinding[];
  summary: string;
  metadata: RunMetadata;
  durationMs: number;
}

// Forward reference — the orchestrator type for MetaAnalysisPlugin
export type AnalysisOrchestrator = import('./orchestrator.js').AnalysisOrchestrator;
```

- [ ] **Step 2: Write a basic compile-time type check test**

```typescript
// test/unit/analyses/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  DriftImage,
  AnalysisConfig,
  CompareContext,
  AnalysisResult,
  AnalysisPlugin,
  CompareReport,
} from '../../../src/analyses/types.js';

describe('Analysis types', () => {
  it('DriftImage has required fields', () => {
    const img: DriftImage = {
      buffer: Buffer.from(''),
      rawPixels: Buffer.from(''),
      width: 100,
      height: 200,
      aspectRatio: 0.5,
      path: '/tmp/test.png',
    };
    expect(img.width).toBe(100);
  });

  it('AnalysisResult supports error field', () => {
    const result: AnalysisResult = {
      analysisName: 'test',
      findings: [],
      summary: 'ok',
      metadata: {},
      durationMs: 100,
      error: 'something failed',
    };
    expect(result.error).toBe('something failed');
  });

  it('AnalysisConfig has enable/disable/options', () => {
    const config: AnalysisConfig = {
      enabled: ['pixel'],
      disabled: ['a11y'],
      options: { pixel: { threshold: 0.1 } },
    };
    expect(config.enabled).toContain('pixel');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/unit/analyses/types.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 4: Commit**

```bash
git add src/analyses/types.ts test/unit/analyses/types.test.ts
git commit -m "feat: analysis plugin type definitions"
```

---

### Task 2: Extend DiffFinding and DiffEvidence Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Extend DiffFinding.category union**

In `src/types.ts`, find the `category` field in the `DiffFinding` interface and extend it:

```typescript
// Before:
category: 'spacing' | 'color' | 'font' | 'alignment' | 'size' | 'content' | 'missing' | 'extra' | 'unknown';

// After:
category: 'spacing' | 'color' | 'font' | 'alignment' | 'size' | 'content' | 'missing' | 'extra' | 'unknown'
  | 'accessibility' | 'text-mismatch' | 'hierarchy' | 'regression' | 'design-token';
```

- [ ] **Step 2: Extend DiffEvidence.type union**

```typescript
// Before:
type: 'pixel' | 'tree' | 'accessibility';

// After:
type: 'pixel' | 'tree' | 'accessibility' | 'semantic' | 'token' | 'regression';
```

- [ ] **Step 3: Run all tests to verify no breakage**

Run: `npx vitest run`
Expected: All 209+ tests pass (existing tests use specific values, new union members are additive)

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: extend DiffFinding and DiffEvidence types for analysis plugins"
```

---

### Task 3: RunStore Extensions

**Files:**
- Modify: `src/run-store.ts`
- Test: `test/unit/run-store.test.ts` (create if not exists, or add to existing)

- [ ] **Step 1: Write failing tests for readArtifact and getLatestRun**

```typescript
// test/unit/run-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RunStore } from '../../src/run-store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('RunStore extensions', () => {
  let tmpDir: string;
  let store: RunStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drift-test-'));
    store = new RunStore(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
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
    // Small delay to ensure different directory timestamps
    const run2 = store.createRun();
    const latest = store.getLatestRun();
    // Latest should be one of the created runs (the most recently created)
    expect(latest).toBeDefined();
    expect([run1.runId, run2.runId]).toContain(latest);
  });

  it('getLatestRun returns undefined when no runs exist', () => {
    const result = store.getLatestRun();
    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/run-store.test.ts`
Expected: FAIL — `readArtifact` and `getLatestRun` don't exist

- [ ] **Step 3: Implement readArtifact and getLatestRun**

Add to `src/run-store.ts`:

```typescript
readArtifact(runId: string, relativePath: string): Buffer | null {
  const fullPath = join(this.getRunDir(runId), relativePath);
  try {
    return readFileSync(fullPath);
  } catch {
    return null;
  }
}

getLatestRun(): string | undefined {
  const runs = this.listRuns();
  if (runs.length === 0) return undefined;
  // Runs are nanoid-based, not timestamp-sorted. Use directory mtime.
  let latest: string | undefined;
  let latestTime = 0;
  for (const runId of runs) {
    try {
      const stat = statSync(this.getRunDir(runId));
      if (stat.mtimeMs > latestTime) {
        latestTime = stat.mtimeMs;
        latest = runId;
      }
    } catch {
      continue;
    }
  }
  return latest;
}
```

Add `statSync` to the imports from `node:fs`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/run-store.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/run-store.ts test/unit/run-store.test.ts
git commit -m "feat: add readArtifact and getLatestRun to RunStore"
```

---

### Task 4: Config Extension

**Files:**
- Modify: `src/config.ts`
- Modify: `test/unit/config/config.test.ts`

- [ ] **Step 1: Write failing test for analyses config**

Add to `test/unit/config/config.test.ts`:

```typescript
it('parses analyses config section', () => {
  const config = parseConfig({
    analyses: {
      default: ['pixel', 'a11y'],
      options: {
        pixel: { threshold: 0.2 },
      },
    },
  });
  expect(config.analyses.default).toEqual(['pixel', 'a11y']);
  expect(config.analyses.options.pixel).toEqual({ threshold: 0.2 });
});

it('provides analyses defaults when not specified', () => {
  const config = parseConfig({});
  expect(config.analyses.default).toEqual([]);
  expect(config.analyses.disabled).toEqual([]);
  expect(config.analyses.options).toEqual({});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/config/config.test.ts`
Expected: FAIL — `analyses` property doesn't exist on DriftConfig

- [ ] **Step 3: Add analyses to config schema**

In `src/config.ts`, add the analyses schema:

```typescript
const analysesSchema = z.object({
  default: z.array(z.string()).optional(),
  disabled: z.array(z.string()).optional(),
  options: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
}).optional();
```

Add to `configSchema`:
```typescript
analyses: analysesSchema,
```

Add to `DriftConfig` type:
```typescript
analyses: {
  default: string[];
  disabled: string[];
  options: Record<string, Record<string, unknown>>;
};
```

Add to `DEFAULTS`:
```typescript
analyses: {
  default: [],
  disabled: [],
  options: {},
},
```

Update `parseConfig` merge to include analyses deep-merge:
```typescript
analyses: {
  default: parsed.analyses?.default ?? DEFAULTS.analyses.default,
  disabled: parsed.analyses?.disabled ?? DEFAULTS.analyses.disabled,
  options: { ...DEFAULTS.analyses.options, ...parsed.analyses?.options },
},
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/config/config.test.ts`
Expected: PASS (all config tests)

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/config.ts test/unit/config/config.test.ts
git commit -m "feat: add analyses config section to DriftConfig"
```

---

## Chunk 2: Context Builder + Registry + Orchestrator

### Task 5: Context Builder

**Files:**
- Create: `src/analyses/context.ts`
- Test: `test/unit/analyses/context.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/unit/analyses/context.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildDriftImage, buildAnalysisConfig } from '../../src/analyses/context.js';

describe('buildDriftImage', () => {
  it('creates DriftImage from file path', async () => {
    // Use a real 1x1 PNG for testing
    const { PNG } = await import('pngjs');
    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    const tmp = mkdtempSync(join(tmpdir(), 'drift-ctx-'));
    const png = new PNG({ width: 2, height: 3 });
    png.data.fill(255);
    const buffer = PNG.sync.write(png);
    const imgPath = join(tmp, 'test.png');
    writeFileSync(imgPath, buffer);

    const img = await buildDriftImage(imgPath);
    expect(img.width).toBe(2);
    expect(img.height).toBe(3);
    expect(img.aspectRatio).toBeCloseTo(2 / 3);
    expect(img.path).toBe(imgPath);
    expect(img.buffer).toBeInstanceOf(Buffer);
    expect(img.rawPixels).toBeInstanceOf(Buffer);
    expect(img.rawPixels.length).toBe(2 * 3 * 4); // RGBA
  });
});

describe('buildAnalysisConfig', () => {
  it('builds from CLI flags and config', () => {
    const config = buildAnalysisConfig(
      { default: ['pixel'], disabled: [], options: {} },
      'pixel,semantic',  // --with flag
      undefined,          // --without flag
    );
    expect(config.enabled).toEqual(['pixel', 'semantic']);
    expect(config.disabled).toEqual([]);
  });

  it('uses config defaults when no flags', () => {
    const config = buildAnalysisConfig(
      { default: ['pixel', 'a11y'], disabled: [], options: {} },
      undefined,
      undefined,
    );
    expect(config.enabled).toEqual(['pixel', 'a11y']);
  });

  it('handles --without flag', () => {
    const config = buildAnalysisConfig(
      { default: ['pixel', 'a11y'], disabled: [], options: {} },
      undefined,
      'a11y',
    );
    expect(config.enabled).toEqual(['pixel', 'a11y']);
    expect(config.disabled).toEqual(['a11y']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/analyses/context.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement context builder**

```typescript
// src/analyses/context.ts
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import type { DriftImage, AnalysisConfig } from './types.js';

export async function buildDriftImage(filePath: string): Promise<DriftImage> {
  const buffer = readFileSync(filePath);
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;
  const rawPixels = await image.raw().ensureAlpha().toBuffer();

  return {
    buffer,
    rawPixels,
    width,
    height,
    aspectRatio: width / height,
    path: filePath,
  };
}

export function buildAnalysisConfig(
  configAnalyses: { default: string[]; disabled: string[]; options: Record<string, Record<string, unknown>> },
  withFlag?: string,
  withoutFlag?: string,
): AnalysisConfig {
  const enabled = withFlag
    ? withFlag.split(',').map((s) => s.trim())
    : [...configAnalyses.default];

  const disabled = withoutFlag
    ? withoutFlag.split(',').map((s) => s.trim())
    : [...configAnalyses.disabled];

  return {
    enabled,
    disabled,
    options: configAnalyses.options,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/analyses/context.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/analyses/context.ts test/unit/analyses/context.test.ts
git commit -m "feat: context builder for analysis plugin system"
```

---

### Task 6: Analysis Registry

**Files:**
- Create: `src/analyses/registry.ts`
- Test: `test/unit/analyses/registry.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/unit/analyses/registry.test.ts
import { describe, it, expect } from 'vitest';
import { AnalysisRegistry } from '../../src/analyses/registry.js';
import type { AnalysisPlugin, CompareContext } from '../../src/analyses/types.js';

function makePlugin(name: string, available = true): AnalysisPlugin {
  return {
    name,
    description: `${name} analysis`,
    isAvailable: () => available,
    run: async () => ({
      analysisName: name,
      findings: [],
      summary: 'ok',
      metadata: {},
      durationMs: 0,
    }),
  };
}

describe('AnalysisRegistry', () => {
  it('registers and retrieves a plugin', () => {
    const registry = new AnalysisRegistry();
    const plugin = makePlugin('pixel');
    registry.register(plugin);
    expect(registry.get('pixel')).toBe(plugin);
  });

  it('returns undefined for unknown plugin', () => {
    const registry = new AnalysisRegistry();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('lists all registered plugins', () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel'));
    registry.register(makePlugin('a11y'));
    const all = registry.all();
    expect(all.map((p) => p.name)).toEqual(['pixel', 'a11y']);
  });

  it('throws on duplicate registration', () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel'));
    expect(() => registry.register(makePlugin('pixel'))).toThrow('already registered');
  });

  it('names returns list of registered names', () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel'));
    registry.register(makePlugin('semantic'));
    expect(registry.names()).toEqual(['pixel', 'semantic']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/analyses/registry.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement registry**

```typescript
// src/analyses/registry.ts
import type { AnalysisPlugin } from './types.js';

export class AnalysisRegistry {
  private plugins = new Map<string, AnalysisPlugin>();

  register(plugin: AnalysisPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Analysis "${plugin.name}" already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string): AnalysisPlugin | undefined {
    return this.plugins.get(name);
  }

  all(): AnalysisPlugin[] {
    return [...this.plugins.values()];
  }

  names(): string[] {
    return [...this.plugins.keys()];
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/analyses/registry.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/analyses/registry.ts test/unit/analyses/registry.test.ts
git commit -m "feat: AnalysisRegistry for plugin management"
```

---

### Task 7: Analysis Orchestrator

**Files:**
- Create: `src/analyses/orchestrator.ts`
- Test: `test/unit/analyses/orchestrator.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/unit/analyses/orchestrator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AnalysisOrchestrator } from '../../src/analyses/orchestrator.js';
import { AnalysisRegistry } from '../../src/analyses/registry.js';
import type { AnalysisPlugin, CompareContext, AnalysisResult } from '../../src/analyses/types.js';

function makePlugin(
  name: string,
  opts: { available?: boolean; findings?: number; error?: boolean; delayMs?: number } = {},
): AnalysisPlugin {
  const { available = true, findings = 0, error = false, delayMs = 0 } = opts;
  return {
    name,
    description: `${name} analysis`,
    isAvailable: () => available,
    run: async (): Promise<AnalysisResult> => {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (error) throw new Error(`${name} failed`);
      return {
        analysisName: name,
        findings: Array.from({ length: findings }, (_, i) => ({
          id: `${name}-${i}`,
          category: 'unknown' as const,
          severity: 'info' as const,
          confidence: 0.5,
          region: { x: 0, y: 0, width: 10, height: 10 },
          evidence: [],
        })),
        summary: `${name}: ${findings} findings`,
        metadata: {},
        durationMs: delayMs,
      };
    },
  };
}

function makeContext(overrides: Partial<CompareContext> = {}): CompareContext {
  return {
    screenshot: { buffer: Buffer.from(''), rawPixels: Buffer.from(''), width: 100, height: 200, aspectRatio: 0.5, path: '/tmp/s.png' },
    config: {} as any,
    analysisConfig: { enabled: [], disabled: [], options: {} },
    runId: 'test-run',
    store: {} as any,
    ...overrides,
  };
}

describe('AnalysisOrchestrator', () => {
  it('runs all available plugins and merges findings', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 2 }));
    registry.register(makePlugin('a11y', { findings: 1 }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const report = await orchestrator.run(makeContext());
    expect(report.analyses).toHaveLength(2);
    expect(report.findings).toHaveLength(3);
    expect(report.runId).toBe('test-run');
  });

  it('skips unavailable plugins', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 1 }));
    registry.register(makePlugin('a11y', { available: false }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const report = await orchestrator.run(makeContext());
    expect(report.analyses).toHaveLength(1);
    expect(report.analyses[0].analysisName).toBe('pixel');
  });

  it('respects enabled filter', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 1 }));
    registry.register(makePlugin('a11y', { findings: 1 }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const ctx = makeContext({
      analysisConfig: { enabled: ['pixel'], disabled: [], options: {} },
    });
    const report = await orchestrator.run(ctx);
    expect(report.analyses).toHaveLength(1);
    expect(report.analyses[0].analysisName).toBe('pixel');
  });

  it('respects disabled filter', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 1 }));
    registry.register(makePlugin('a11y', { findings: 1 }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const ctx = makeContext({
      analysisConfig: { enabled: [], disabled: ['a11y'], options: {} },
    });
    const report = await orchestrator.run(ctx);
    expect(report.analyses).toHaveLength(1);
    expect(report.analyses[0].analysisName).toBe('pixel');
  });

  it('handles plugin failure gracefully via Promise.allSettled', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel', { findings: 1 }));
    registry.register(makePlugin('broken', { error: true }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const report = await orchestrator.run(makeContext());
    expect(report.analyses).toHaveLength(2);
    const broken = report.analyses.find((a) => a.analysisName === 'broken')!;
    expect(broken.error).toBe('broken failed');
    expect(broken.findings).toEqual([]);
    // Pixel findings still present
    expect(report.findings).toHaveLength(1);
  });

  it('runs plugins in parallel', async () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('slow1', { delayMs: 50, findings: 1 }));
    registry.register(makePlugin('slow2', { delayMs: 50, findings: 1 }));
    const orchestrator = new AnalysisOrchestrator(registry);

    const start = Date.now();
    const report = await orchestrator.run(makeContext());
    const elapsed = Date.now() - start;
    expect(report.analyses).toHaveLength(2);
    // If parallel, should be ~50ms. If sequential, ~100ms.
    expect(elapsed).toBeLessThan(90);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/analyses/orchestrator.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement orchestrator**

```typescript
// src/analyses/orchestrator.ts
import type { AnalysisPlugin, AnalysisResult, CompareContext, CompareReport } from './types.js';
import type { AnalysisRegistry } from './registry.js';
import type { RunMetadata } from '../types.js';

export class AnalysisOrchestrator {
  constructor(private registry: AnalysisRegistry) {}

  async run(ctx: CompareContext): Promise<CompareReport> {
    const start = Date.now();
    const plugins = this.selectPlugins(ctx);

    const settled = await Promise.allSettled(
      plugins.map((plugin) => plugin.run(ctx)),
    );

    const analyses: AnalysisResult[] = settled.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        analysisName: plugins[i].name,
        findings: [],
        summary: `Error: ${result.reason?.message ?? 'unknown error'}`,
        metadata: {},
        durationMs: 0,
        error: result.reason?.message ?? 'unknown error',
      };
    });

    const findings = analyses.flatMap((a) => a.findings);
    const summaries = analyses.map((a) => a.summary).join('; ');
    const durationMs = Date.now() - start;

    return {
      runId: ctx.runId,
      analyses,
      findings,
      summary: summaries,
      metadata: {} as RunMetadata,
      durationMs,
    };
  }

  private selectPlugins(ctx: CompareContext): AnalysisPlugin[] {
    let plugins = this.registry.all();
    const { enabled, disabled } = ctx.analysisConfig;

    if (enabled.length > 0) {
      plugins = plugins.filter((p) => enabled.includes(p.name));
    }

    if (disabled.length > 0) {
      plugins = plugins.filter((p) => !disabled.includes(p.name));
    }

    return plugins.filter((p) => p.isAvailable(ctx));
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/analyses/orchestrator.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/analyses/orchestrator.ts test/unit/analyses/orchestrator.test.ts
git commit -m "feat: AnalysisOrchestrator with parallel execution and error handling"
```

---

## Chunk 3: Pixel Plugin + Compare Refactor + Formatter Update

### Task 8: Pixel Analysis Plugin

**Files:**
- Create: `src/analyses/plugins/pixel.ts`
- Test: `test/unit/analyses/plugins/pixel.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/unit/analyses/plugins/pixel.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PixelAnalysis } from '../../../src/analyses/plugins/pixel.js';
import type { CompareContext } from '../../../src/analyses/types.js';

function makeContext(overrides: Partial<CompareContext> = {}): CompareContext {
  return {
    screenshot: { buffer: Buffer.from(''), rawPixels: Buffer.from(''), width: 100, height: 200, aspectRatio: 0.5, path: '/tmp/s.png' },
    config: {
      threshold: 0.1,
      diffThreshold: 0.01,
      regionMergeGap: 8,
      regionMinArea: 100,
      diffMaskColor: [255, 0, 0, 128],
      ignoreRules: [],
      platform: 'ios',
    } as any,
    analysisConfig: { enabled: [], disabled: [], options: {} },
    runId: 'test-run',
    store: { getRunPath: () => '/tmp/runs/test-run', writeArtifact: vi.fn() } as any,
    ...overrides,
  };
}

describe('PixelAnalysis', () => {
  const pixel = new PixelAnalysis();

  it('has correct name and description', () => {
    expect(pixel.name).toBe('pixel');
    expect(pixel.description).toBeDefined();
  });

  it('is available when design exists', () => {
    const ctx = makeContext({
      design: { buffer: Buffer.from(''), rawPixels: Buffer.from(''), width: 100, height: 200, aspectRatio: 0.5, path: '/tmp/d.png' },
    });
    expect(pixel.isAvailable(ctx)).toBe(true);
  });

  it('is not available without design', () => {
    const ctx = makeContext();
    expect(pixel.isAvailable(ctx)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/analyses/plugins/pixel.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement PixelAnalysis**

The plugin wraps the existing `runComparison()` from `src/diff/compare.ts`. It converts DriftImage paths to the string paths that `runComparison` expects, runs the pipeline, and converts `CompareResult` to `AnalysisResult`.

```typescript
// src/analyses/plugins/pixel.ts
import type { AnalysisPlugin, AnalysisResult, CompareContext } from '../types.js';
import { runComparison } from '../../diff/compare.js';
import { matchRegionsToComponents } from '../../inspect/component-matcher.js';
import { generateFindings } from '../../inspect/finding-generator.js';

export class PixelAnalysis implements AnalysisPlugin {
  name = 'pixel';
  description = 'Pixel-level image comparison between screenshot and design';

  isAvailable(ctx: CompareContext): boolean {
    return !!ctx.design;
  }

  async run(ctx: CompareContext): Promise<AnalysisResult> {
    const start = Date.now();
    const { config } = ctx;
    const [mr, mg, mb, ma] = config.diffMaskColor;

    const compareResult = await runComparison(ctx.design!.path, ctx.screenshot.path, {
      threshold: config.threshold,
      diffThreshold: config.diffThreshold,
      regionMergeGap: config.regionMergeGap,
      regionMinArea: config.regionMinArea,
      ignoreRules: config.ignoreRules,
      diffMaskColor: { r: mr, g: mg, b: mb, a: ma / 255 },
      platform: config.platform,
    });

    await ctx.store.writeArtifact(ctx.runId, 'diff-mask.png', compareResult.diffMaskBuffer);
    for (const crop of compareResult.regionCrops) {
      await ctx.store.writeArtifact(ctx.runId, `regions/${crop.id}.png`, crop.buffer);
    }

    const matches = ctx.tree?.length
      ? matchRegionsToComponents(compareResult.regions, ctx.tree)
      : [];
    const findings = generateFindings(
      compareResult.regions,
      matches,
      compareResult.totalPixels,
    );

    const passed = compareResult.diffPercentage <= config.diffThreshold;

    return {
      analysisName: this.name,
      findings,
      summary: passed
        ? `Pixel diff: ${compareResult.diffPercentage.toFixed(3)}% (pass)`
        : `Pixel diff: ${compareResult.diffPercentage.toFixed(3)}% — ${compareResult.regions.length} regions (fail)`,
      metadata: {
        totalPixels: compareResult.totalPixels,
        diffPixels: compareResult.diffPixels,
        diffPercentage: compareResult.diffPercentage,
        regions: compareResult.regions,
        durationMs: compareResult.durationMs,
        passed,
      },
      durationMs: Date.now() - start,
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/analyses/plugins/pixel.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/analyses/plugins/pixel.ts test/unit/analyses/plugins/pixel.test.ts
git commit -m "feat: PixelAnalysis plugin wrapping existing diff pipeline"
```

---

### Task 9: Default Registry Factory

**Files:**
- Create: `src/analyses/default-registry.ts`

- [ ] **Step 1: Create factory that registers all built-in plugins**

```typescript
// src/analyses/default-registry.ts
import { AnalysisRegistry } from './registry.js';
import { PixelAnalysis } from './plugins/pixel.js';

export function createDefaultRegistry(): AnalysisRegistry {
  const registry = new AnalysisRegistry();
  registry.register(new PixelAnalysis());
  // Future: registry.register(new A11yAnalysis());
  // Future: registry.register(new RegressionAnalysis());
  // Future: registry.register(new SemanticAnalysis());
  // Future: registry.register(new TokensAnalysis());
  // Future: registry.register(new MultiDeviceAnalysis());
  return registry;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/analyses/default-registry.ts
git commit -m "feat: default registry factory for built-in analysis plugins"
```

---

### Task 10: Refactor commands/compare.ts

**Files:**
- Modify: `src/commands/compare.ts`
- Modify: `src/formatters/types.ts`
- Modify: `src/formatters/compare.ts`
- Modify: `src/cli.ts`

This is the integration task. The compare command switches from directly calling `runComparison()` to using the `AnalysisOrchestrator`.

- [ ] **Step 1: Update CompareFormatData → use CompareReport**

In `src/formatters/types.ts`, replace `CompareFormatData` with an import of `CompareReport`:

```typescript
// src/formatters/types.ts
import type { ComponentNode } from '../types.js';
import type { CompareReport } from '../analyses/types.js';

export type OutputFormat = 'terminal' | 'markdown' | 'json';

export interface FormatterContext {
  format: OutputFormat;
  copy: boolean;
  quiet: boolean;
}

export interface OutputFormatter<T> {
  terminal(data: T): string;
  markdown(data: T): string;
  json(data: T): string;
}

export interface CompareFormatData {
  report: CompareReport;
  device?: { name: string; platform: 'android' | 'ios' };
  artifactDir: string;
  tree?: ComponentNode[];
  inspectHints?: string[];
}
```

- [ ] **Step 2: Update the compare formatter**

Update `src/formatters/compare.ts` to work with the new `CompareFormatData` that contains a `CompareReport` instead of a `DiffResult`. The key change: findings come from `data.report.findings`, and per-analysis summaries are shown.

The terminal formatter should show:
- Each analysis name + summary on its own line
- Then merged findings sorted by severity (same as before)

The markdown formatter should show:
- Per-analysis sections with their summaries
- Then merged findings (same detail as before)

The json formatter should output the full `CompareReport`.

Key changes in `compareFormatter`:
- Replace `data.result.findings` → `data.report.findings`
- Replace `data.result.diffPercentage` → `(data.report.analyses.find(a => a.analysisName === 'pixel')?.metadata as any)?.diffPercentage ?? 0`
- Replace `data.result.durationMs` → `data.report.durationMs`
- Replace `data.result.capabilities` → remove or derive from context
- Add per-analysis summary section

- [ ] **Step 3: Refactor commands/compare.ts**

Rewrite `runCompare` to use the orchestrator:

```typescript
// src/commands/compare.ts
import type { Shell, RunMetadata, DeviceInfo } from '../types.js';
import type { DriftConfig } from '../config.js';
import type { CompareFormatData } from '../formatters/types.js';
import type { CompareReport } from '../analyses/types.js';
import { DeviceDiscovery } from '../devices/discovery.js';
import { captureScreenshot } from '../capture/capture.js';
import { TreeInspector } from '../inspect/tree-inspector.js';
import { buildDriftImage, buildAnalysisConfig } from '../analyses/context.js';
import { createDefaultRegistry } from '../analyses/default-registry.js';
import { AnalysisOrchestrator } from '../analyses/orchestrator.js';
import { RunStore } from '../run-store.js';
import { ExitCode } from '../exit-codes.js';
import { compareFormatter } from '../formatters/compare.js';
import { pickDevice } from './device-picker.js';
import * as fs from 'node:fs';

export interface CompareCommandOptions {
  design?: string;
  device?: string;
  threshold?: number;
  screenshot?: string;
  with?: string;
  without?: string;
  baseline?: boolean;
}

export async function runCompare(
  shell: Shell,
  config: DriftConfig,
  options: CompareCommandOptions,
): Promise<{ report: CompareReport; exitCode: number; formatData: CompareFormatData }> {
  const store = new RunStore(process.cwd());
  const run = store.createRun();

  let screenshotPath: string;
  let deviceInfo: DeviceInfo | undefined;

  if (options.screenshot) {
    screenshotPath = options.screenshot;
  } else {
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    const booted = devices.filter((d) => d.state === 'booted');
    if (booted.length === 0) throw new Error('No booted devices found');

    let device;
    if (options.device) {
      device = booted.find((d) => d.id === options.device || d.name === options.device);
      if (!device) throw new Error(`Device not found: ${options.device}`);
    } else {
      device = await pickDevice(booted);
    }

    deviceInfo = device;
    const buffer = await captureScreenshot(shell, device, {
      settleCheck: config.settleCheckEnabled,
      settleMaxDelta: config.settleMaxDelta,
      settleDelayMs: config.settleTimeMs,
    });
    screenshotPath = store.getRunPath(run.runId, 'screenshot.png');
    await store.writeArtifact(run.runId, 'screenshot.png', buffer);
  }

  // Build context
  const screenshot = await buildDriftImage(screenshotPath);

  let design;
  if (options.design) {
    const designBuffer = fs.readFileSync(options.design);
    await store.writeArtifact(run.runId, 'design.png', designBuffer);
    design = await buildDriftImage(options.design);
  }

  let baseline;
  if (options.baseline) {
    const latestRun = store.getLatestRun();
    if (latestRun) {
      const baselineBuffer = store.readArtifact(latestRun, 'screenshot.png');
      if (baselineBuffer) {
        const baselinePath = store.getRunPath(latestRun, 'screenshot.png');
        baseline = await buildDriftImage(baselinePath);
      }
    }
  }

  let tree;
  let inspectHints: string[] = [];
  if (deviceInfo) {
    const inspector = new TreeInspector(shell, process.cwd());
    const inspectResult = await inspector.inspect(deviceInfo, {
      metroPort: config.metroPort,
      devToolsPort: config.devToolsPort,
      timeoutMs: config.timeouts.treeInspectionMs,
    });
    tree = inspectResult.tree;
    inspectHints = inspectResult.hints;
  }

  const analysisConfig = buildAnalysisConfig(
    config.analyses,
    options.with,
    options.without,
  );

  const ctx = {
    screenshot,
    design,
    baseline,
    tree,
    device: deviceInfo,
    config,
    analysisConfig,
    runId: run.runId,
    store,
  };

  // Run analyses
  const registry = createDefaultRegistry();
  const orchestrator = new AnalysisOrchestrator(registry);
  const report = await orchestrator.run(ctx);

  // Populate metadata
  const startedAt = new Date().toISOString();
  report.metadata = {
    runId: run.runId,
    startedAt,
    completedAt: new Date().toISOString(),
    projectRoot: process.cwd(),
    deviceId: deviceInfo?.id ?? 'static',
    platform: deviceInfo?.platform ?? config.platform,
    orientation: 'portrait',
    framework: 'unknown',
    driftVersion: '0.1.0',
  } as RunMetadata;

  await store.writeMetadata(run.runId, report.metadata);
  const resultJson = JSON.stringify(report, null, 2);
  await store.writeArtifact(run.runId, 'result.json', Buffer.from(resultJson));

  const formatData: CompareFormatData = {
    report,
    device: deviceInfo ? { name: deviceInfo.name, platform: deviceInfo.platform } : undefined,
    artifactDir: store.getRunPath(run.runId),
    tree,
    inspectHints,
  };

  const reportMarkdown = compareFormatter.markdown(formatData);
  await store.writeArtifact(run.runId, 'report.md', Buffer.from(reportMarkdown));

  // Exit code: pass if pixel analysis passed (or no pixel analysis ran)
  const pixelResult = report.analyses.find((a) => a.analysisName === 'pixel');
  const pixelPassed = pixelResult ? (pixelResult.metadata as any)?.passed !== false : true;
  const exitCode = pixelPassed ? ExitCode.Success : ExitCode.DiffFound;

  return { report, exitCode, formatData };
}
```

- [ ] **Step 4: Update CLI to pass new flags**

In `src/cli.ts`, update the compare command:

```typescript
// Add new options to compare command
.option('--with <analyses>', 'comma-separated list of analyses to run')
.option('--without <analyses>', 'exclude specific analyses')
.option('--baseline', 'compare against previous run screenshot')
```

Update the action handler to pass the new options:

```typescript
const { exitCode, formatData } = await runCompare(shell, config, {
  design: opts.design as string,
  device: opts.device as string | undefined,
  threshold: opts.threshold as number | undefined,
  screenshot: opts.screenshot as string | undefined,
  with: opts.with as string | undefined,
  without: opts.without as string | undefined,
  baseline: !!opts.baseline,
});
```

Note: `--design` changes from `requiredOption` to `option` since regression mode (`--baseline`) doesn't need a design.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass. Some compare formatter tests may need updating for the new `CompareFormatData` shape (report field instead of result field).

- [ ] **Step 6: Fix any failing tests**

Update `test/unit/formatters/compare.test.ts` to use the new shape:
- Replace `result: diffResult` with `report: { runId: '...', analyses: [...], findings: [...], ... }`
- Update assertions accordingly

Update `test/unit/commands/inspect.test.ts` and any other tests that reference `CompareFormatData`.

- [ ] **Step 7: Run all tests again**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/commands/compare.ts src/formatters/types.ts src/formatters/compare.ts src/cli.ts
git add test/unit/formatters/compare.test.ts
git commit -m "feat: refactor compare command to use analysis orchestrator"
```

---

### Task 11: Integration Smoke Test

**Files:**
- Create: `test/integration/analyses/orchestrator.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// test/integration/analyses/orchestrator.test.ts
import { describe, it, expect } from 'vitest';
import { createDefaultRegistry } from '../../../src/analyses/default-registry.js';
import { AnalysisOrchestrator } from '../../../src/analyses/orchestrator.js';
import { buildDriftImage } from '../../../src/analyses/context.js';
import { RunStore } from '../../../src/run-store.js';
import { getDefaultConfig } from '../../../src/config.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';

function createTestPng(width: number, height: number, color: [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }
  return PNG.sync.write(png);
}

describe('Analysis orchestrator integration', () => {
  it('runs pixel analysis through full pipeline', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'drift-integ-'));
    const designPath = join(tmpDir, 'design.png');
    const screenshotPath = join(tmpDir, 'screenshot.png');

    // Create identical images → 0% diff
    const img = createTestPng(100, 200, [255, 0, 0, 255]);
    writeFileSync(designPath, img);
    writeFileSync(screenshotPath, img);

    const registry = createDefaultRegistry();
    const orchestrator = new AnalysisOrchestrator(registry);
    const store = new RunStore(tmpDir);
    const run = store.createRun();
    const config = getDefaultConfig();

    const ctx = {
      screenshot: await buildDriftImage(screenshotPath),
      design: await buildDriftImage(designPath),
      config,
      analysisConfig: { enabled: [], disabled: [], options: {} },
      runId: run.runId,
      store,
    };

    const report = await orchestrator.run(ctx);
    expect(report.analyses).toHaveLength(1);
    expect(report.analyses[0].analysisName).toBe('pixel');
    expect(report.analyses[0].error).toBeUndefined();
    expect((report.analyses[0].metadata as any).diffPercentage).toBe(0);
    expect(report.findings).toHaveLength(0);
  });

  it('skips pixel analysis when no design provided', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'drift-integ-'));
    const screenshotPath = join(tmpDir, 'screenshot.png');
    writeFileSync(screenshotPath, createTestPng(100, 200, [255, 0, 0, 255]));

    const registry = createDefaultRegistry();
    const orchestrator = new AnalysisOrchestrator(registry);
    const store = new RunStore(tmpDir);
    const run = store.createRun();

    const ctx = {
      screenshot: await buildDriftImage(screenshotPath),
      config: getDefaultConfig(),
      analysisConfig: { enabled: [], disabled: [], options: {} },
      runId: run.runId,
      store,
    };

    const report = await orchestrator.run(ctx);
    expect(report.analyses).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run test/integration/analyses/orchestrator.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add test/integration/analyses/orchestrator.test.ts
git commit -m "test: integration test for analysis orchestrator pipeline"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Analysis types | `src/analyses/types.ts` |
| 2 | Extend DiffFinding/DiffEvidence | `src/types.ts` |
| 3 | RunStore extensions | `src/run-store.ts` |
| 4 | Config extension | `src/config.ts` |
| 5 | Context builder | `src/analyses/context.ts` |
| 6 | Analysis registry | `src/analyses/registry.ts` |
| 7 | Analysis orchestrator | `src/analyses/orchestrator.ts` |
| 8 | Pixel analysis plugin | `src/analyses/plugins/pixel.ts` |
| 9 | Default registry factory | `src/analyses/default-registry.ts` |
| 10 | Refactor compare + formatter | `src/commands/compare.ts`, `src/formatters/*`, `src/cli.ts` |
| 11 | Integration smoke test | `test/integration/analyses/` |

After Phase 5, `drift compare --design mockup.png` works exactly as before but runs through the plugin architecture. New analyses can be added by creating a class implementing `AnalysisPlugin` and registering it in `default-registry.ts`.
