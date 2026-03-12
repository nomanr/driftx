# Analysis Plugin System — Design Spec

**Goal:** Transform drift from a single pixel-diff tool into a pluggable multi-analysis platform. Users select which analyses to run (pixel diff, semantic comparison, accessibility audit, layout regression, multi-device matrix, design token extraction). Analyses run in parallel against shared context. Drift exposes itself as both a CLI and a Claude Code plugin.

**Architecture:** Shared CompareContext built once, fed read-only to independent AnalysisPlugin modules that run in parallel via `Promise.allSettled()`. An orchestrator handles discovery, filtering, execution, and result merging. Individual analysis failures don't crash the run. A Claude Code plugin wraps the same internal APIs as structured tools.

**Tech Stack:** Existing stack (sharp, pixelmatch, ws, commander) plus no new runtime dependencies for core. Design token extraction may add color-thief or similar later.

---

## 1. AnalysisPlugin Interface

```typescript
// src/analyses/types.ts

interface AnalysisPlugin {
  name: string;                              // e.g., 'pixel', 'semantic', 'a11y'
  description: string;                       // Human-readable, shown in --help and reports
  isAvailable(ctx: CompareContext): boolean;  // Can this analysis run given current context?
  run(ctx: CompareContext): Promise<AnalysisResult>;
}

interface AnalysisResult {
  analysisName: string;
  findings: DiffFinding[];                   // Reuses existing DiffFinding type
  summary: string;                           // One-line summary, e.g., "3 regions, 2.1% diff"
  metadata: Record<string, unknown>;         // Analysis-specific data
  durationMs: number;
  error?: string;                            // Set if analysis failed (partial failure, not crash)
}
```

Every analysis is a standalone module that:
- Declares what it needs via `isAvailable()` (design image? tree? baseline?)
- Receives a read-only `CompareContext`
- Returns structured findings using the existing `DiffFinding` type
- Includes a human-readable summary and timing

## 2. CompareContext (Shared Resources)

```typescript
// src/analyses/context.ts

interface CompareContext {
  // Images (uses DriftImage to avoid collision with browser ImageData global)
  screenshot: DriftImage;
  design?: DriftImage;                       // Undefined for regression-only runs
  baseline?: DriftImage;                     // Previous run's screenshot

  // Component tree
  tree?: ComponentNode[];                    // From CDP/UIAutomator/idb (undefined if no device)

  // Device
  device?: DeviceInfo;                       // Undefined if --screenshot was provided

  // Config
  config: DriftConfig;
  analysisConfig: AnalysisConfig;            // Per-analysis overrides

  // Run
  runId: string;
  store: RunStore;                           // For writing artifacts (masks, crops, etc.)
}

// Named DriftImage (not ImageData) to avoid collision with browser global.
// Includes rawPixels and aspectRatio to match existing LoadedImage used by diff pipeline.
interface DriftImage {
  buffer: Buffer;                            // PNG buffer
  rawPixels: Buffer;                         // Decoded RGBA pixel data (for pixelmatch)
  width: number;
  height: number;
  aspectRatio: number;
  path: string;
}

interface AnalysisConfig {
  enabled: string[];                         // Which analyses to run
  disabled: string[];                        // Explicit exclusions
  options: Record<string, Record<string, unknown>>;  // Per-analysis config
}
```

Built once by the orchestrator before any analysis runs:
1. Capture or load screenshot
2. Load design image (if provided)
3. Load baseline from previous run (if exists)
4. Inspect component tree (if device available)
5. Package into `CompareContext`

No analysis duplicates this work.

## 3. Analysis Registry + Orchestrator

```typescript
// src/analyses/registry.ts

class AnalysisRegistry {
  private plugins: Map<string, AnalysisPlugin>;
  register(plugin: AnalysisPlugin): void;
  get(name: string): AnalysisPlugin | undefined;
  all(): AnalysisPlugin[];
}
```

```typescript
// src/analyses/orchestrator.ts

class AnalysisOrchestrator {
  constructor(registry: AnalysisRegistry);

  async run(ctx: CompareContext): Promise<CompareReport>;
}
```

Orchestrator flow:
1. Get all registered plugins from registry
2. Filter: keep only those in `analysisConfig.enabled` (or all if empty), remove `disabled`
3. Filter: keep only those where `isAvailable(ctx)` returns true
4. Run all remaining in `Promise.allSettled()` — individual failures don't crash the run
5. For rejected promises: create an `AnalysisResult` with `error` set and empty findings
6. Merge `AnalysisResult[]` into a unified `CompareReport`
7. Write artifacts and report

```typescript
// src/analyses/types.ts

interface CompareReport {
  runId: string;
  analyses: AnalysisResult[];                // Per-analysis results
  findings: DiffFinding[];                   // Merged findings across all analyses
  summary: string;                           // Overall summary
  metadata: RunMetadata;
  durationMs: number;
}
```

## 4. The Six Analyses

### 4.1 Pixel Diff (`pixel`)

Refactored from the existing `src/diff/compare.ts` pipeline into an `AnalysisPlugin`.

- **Requires:** screenshot + design
- **Produces:** Diff regions, diff percentage, diff mask overlay, region crops
- **isAvailable:** `!!ctx.design`
- **Config:** threshold, diffThreshold, regionMergeGap, regionMinArea, diffMaskColor, ignoreRules

Same logic as today, just wrapped in the plugin interface. The existing diff pipeline code moves into this plugin.

### 4.2 Semantic Comparison (`semantic`)

Compares the structure and content between design and live app. Works across different device sizes because it reasons about what's present, not pixel positions.

- **Requires:** screenshot + design + tree
- **Produces:** Text mismatches, missing/extra components, hierarchy differences
- **isAvailable:** `!!ctx.design && !!ctx.tree?.length`
- **How it works:**
  1. Extract visible text from tree (already have this from CDP)
  2. Run OCR or text extraction on the design image
  3. Compare: what text is in the design but not the app? What's in the app but not the design?
  4. Compare structural hierarchy if both trees available
- **Config:** textMatchThreshold, ignoreCase, ignoreWhitespace

### 4.3 Accessibility Audit (`a11y`)

Checks the component tree for accessibility issues.

- **Requires:** tree
- **Produces:** Findings for missing labels, small tap targets, empty text nodes
- **isAvailable:** `!!ctx.tree?.length`
- **Checks:**
  - Interactive components (Pressable, TouchableOpacity, Button) without accessibilityLabel or testID
  - Tap targets smaller than 44x44pt (iOS) or 48x48dp (Android)
  - Images without alt text / accessibilityLabel
  - Empty text nodes
  - Color contrast issues (if style data available)
- **Config:** minTapTarget, requireLabels, contrastRatio

### 4.4 Layout Regression (`regression`)

Compares current screenshot against a previous run's screenshot. No design file needed.

- **Requires:** screenshot + baseline
- **Produces:** Same as pixel diff but against previous capture instead of design
- **isAvailable:** `!!ctx.baseline`
- **How it works:**
  1. Load baseline from most recent previous run (or specified run ID)
  2. Run same pixel diff pipeline as the pixel analysis
  3. Report changes as regressions
- **Config:** baselineRunId (optional, defaults to most recent), regressionThreshold

### 4.5 Multi-Device Matrix (`multi-device`)

Runs pixel + semantic analyses across multiple simulators in one command.

- **Requires:** design + list of device IDs/names
- **Produces:** Per-device results rolled up into a matrix summary
- **isAvailable:** `ctx.analysisConfig.options['multi-device']?.devices?.length > 0`
- **How it works:**
  1. Discover and filter requested devices
  2. For each device: capture screenshot, build a sub-context, run pixel + semantic
  3. Aggregate results into a matrix (device x analysis = pass/fail)
- **Config:** devices (list of device names/IDs)

Note: Multi-device is a meta-analysis. It implements `MetaAnalysisPlugin` instead of `AnalysisPlugin`:

```typescript
interface MetaAnalysisPlugin extends AnalysisPlugin {
  run(ctx: CompareContext, orchestrator: AnalysisOrchestrator): Promise<AnalysisResult>;
}
```

The orchestrator detects meta-plugins and passes itself as a dependency. The multi-device plugin uses it to build sub-contexts (capture per device, inspect per device) and run sub-analyses. The `CompareContext.store` is used to create sub-run directories for each device.

### 4.6 Design Token Extraction (`tokens`)

Extracts visual properties from design and screenshot, compares them.

- **Requires:** screenshot + design
- **Produces:** Color palette differences, spacing mismatches, font size variations
- **isAvailable:** `!!ctx.design`
- **How it works:**
  1. Extract dominant colors from both images (color quantization)
  2. Compare palettes: missing colors, shifted hues, wrong opacities
  3. Extract spacing patterns (gaps between major regions)
  4. Report token-level differences
- **Config:** colorTolerance, spacingTolerance

## 5. CLI Integration

### New flags on `drift compare`

```
--with <analyses>       Comma-separated list of analyses to run (default: smart)
--without <analyses>    Exclude specific analyses
--baseline              Enable regression mode (compare against previous run)
--devices <list>        Device names/IDs for multi-device matrix
```

### Smart defaults (when no --with/--without)

| Condition | Analyses enabled |
|---|---|
| design + device + tree | pixel, semantic, a11y |
| design + device, no tree | pixel |
| design + --screenshot (no device) | pixel, tokens |
| --baseline, no design | regression |
| design + --devices | multi-device |

### Config schema extension

```typescript
// Added to DriftConfig
analyses: {
  default: string[];                        // Default enabled analyses, e.g., ['pixel', 'semantic', 'a11y']
  options: {
    pixel: { /* existing diff config */ };
    semantic: { textMatchThreshold: number; ignoreCase: boolean };
    a11y: { minTapTarget: number; requireLabels: boolean };
    regression: { baselineRunId?: string; regressionThreshold: number };
    'multi-device': { devices: string[] };
    tokens: { colorTolerance: number; spacingTolerance: number };
  };
};
```

## 6. Claude Code Plugin

A plugin package that registers drift tools with Claude Code.

### Tools exposed

| Tool | Description |
|---|---|
| `drift_compare` | Run comparison with selected analyses, returns structured report |
| `drift_inspect` | Inspect component tree on device |
| `drift_capture` | Capture screenshot from device |
| `drift_devices` | List connected devices and simulators |
| `drift_report` | Retrieve results from a previous run by ID |

### Plugin structure

```
drift-claude-plugin/
  plugin.json             # Plugin manifest (tools, description)
  src/
    index.ts              # Tool definitions
    tools/
      compare.ts          # Wraps AnalysisOrchestrator
      inspect.ts          # Wraps TreeInspector
      capture.ts          # Wraps captureScreenshot
      devices.ts          # Wraps DeviceDiscovery
      report.ts           # Reads from RunStore
```

Each tool calls the same internal APIs that the CLI uses. The plugin is a distribution layer, not a separate codebase.

## 7. Impact on Existing Phases

### What changes

| Existing | Change |
|---|---|
| Phase 5 (source mapping) | Absorbed — becomes an enhancement to CompareContext (richer tree data), not a standalone phase |
| Phase 6 (MCP server) | Replaced by Claude Code plugin |
| `src/commands/compare.ts` | Refactored to use AnalysisOrchestrator instead of calling diff pipeline directly |
| `src/diff/compare.ts` | Becomes the internal engine for PixelAnalysis plugin |
| `DriftConfig` | Extended with `analyses` section |
| `CompareFormatData` | Replaced by `CompareReport` |
| `compareFormatter` | Updated to format `CompareReport` (multiple analyses) |

### What stays the same

- Device discovery, screenshot capture — unchanged
- Tree inspection (CDP, UIAutomator, idb) — unchanged
- Run artifact storage — unchanged, extended with per-analysis artifacts
- Other formatters (devices, doctor, inspect) — unchanged
- CLI structure (commander) — unchanged, new flags added

### New directory structure

```
src/
├── analyses/
│   ├── types.ts              # AnalysisPlugin, AnalysisResult, CompareContext, CompareReport
│   ├── context.ts            # buildCompareContext()
│   ├── registry.ts           # AnalysisRegistry
│   ├── orchestrator.ts       # AnalysisOrchestrator
│   └── plugins/
│       ├── pixel.ts          # PixelAnalysis (wraps existing diff pipeline)
│       ├── semantic.ts       # SemanticAnalysis
│       ├── a11y.ts           # AccessibilityAnalysis
│       ├── regression.ts     # LayoutRegressionAnalysis
│       ├── multi-device.ts   # MultiDeviceAnalysis
│       └── tokens.ts         # DesignTokenAnalysis
├── diff/                     # Existing — becomes internal engine for pixel plugin
├── inspect/                  # Existing — unchanged
└── ...
```

## 8. Report Format

The unified `CompareReport` is formatted across all three output modes:

**Terminal:** Summary table showing each analysis result (pass/fail, finding count, duration), followed by merged findings sorted by severity.

**Markdown:** Per-analysis sections with findings, followed by merged summary. This is what gets saved as `report.md` and what Claude Code consumes.

**JSON:** Full `CompareReport` object with all analysis results, findings, and metadata.

## 9. Type Extensions

The existing `DiffFinding` and `DiffEvidence` types need wider unions for new analyses.

**DiffFinding.category** — extend with:
- `'accessibility'` — missing labels, small tap targets
- `'text-mismatch'` — text differs between design and app
- `'hierarchy'` — structural difference in component tree
- `'regression'` — layout changed from baseline
- `'design-token'` — color/spacing/font token mismatch

**DiffEvidence.type** — extend from `'pixel' | 'tree' | 'accessibility'` to:
`'pixel' | 'tree' | 'accessibility' | 'semantic' | 'token' | 'regression'`

## 10. RunStore Extensions

The regression plugin needs to read previous run artifacts. Add to `RunStore`:

```typescript
readArtifact(runId: string, relativePath: string): Buffer | null;
getLatestRun(): string | undefined;  // Returns most recent runId
```

The context builder uses `getLatestRun()` + `readArtifact(runId, 'screenshot.png')` to populate `ctx.baseline`.

## 11. Config Integration

The existing Zod-based `configSchema` in `src/config.ts` needs an `analyses` key added. The `DEFAULTS` object should include sensible defaults:

```typescript
analyses: {
  default: [],                               // Empty = smart defaults
  options: {}                                // Empty = use per-analysis defaults
}
```

`parseConfig` must deep-merge `analyses.options` so users can override individual analysis settings without specifying all of them.

## 12. Backward Compatibility

Old runs stored in `.drift/runs/` use the `DiffResult` format. The `drift_report` tool and `RunStore` should handle both:
- Old runs: `result.json` contains `DiffResult` — wrap in a single-analysis `CompareReport` when read
- New runs: `result.json` contains `CompareReport`

Detection: if `result.json` has an `analyses` array, it's the new format.

## 13. Risks and Open Questions

| Risk | Mitigation |
|---|---|
| **Semantic OCR dependency** — extracting text from design images requires OCR (tesseract.js is ~2MB wasm) | Defer OCR choice to implementation. Start with tree-only semantic comparison (compare app text against design text if provided as metadata). Add image OCR as optional enhancement. |
| **Design tokens is research-grade** — extracting spacing patterns from rasterized images is hard | Flag tokens plugin as experimental. Start with color palette extraction only (well-understood problem). Add spacing/font analysis incrementally. |
| **Sharp memory pressure** — parallel analyses using sharp on large images could spike memory | The orchestrator can optionally limit concurrency via a semaphore. Start without limits, add if needed. |
| **Multi-device isAvailable uses untyped config access** | Define typed config interfaces per analysis (e.g., `MultiDeviceConfig { devices: string[] }`) and validate with Zod at config load time. |
| **RunMetadata requires deviceId/platform** — undefined when using --screenshot | Default `deviceId` to `'static'` and `platform` to `config.platform` for screenshot-only runs. |
| **Claude Code plugin manifest format** | TBD pending Claude Code plugin API documentation. This is the last implementation step. |

## 14. Implementation Order

1. Core framework: types, context builder, registry, orchestrator
2. Pixel analysis plugin (refactor existing code)
3. Accessibility analysis plugin
4. Layout regression plugin (+ RunStore extensions)
5. Semantic comparison plugin
6. Design token extraction plugin (experimental)
7. Multi-device matrix plugin
8. Updated CLI integration (--with/--without/--devices)
9. Updated formatters for CompareReport
10. Claude Code plugin package
