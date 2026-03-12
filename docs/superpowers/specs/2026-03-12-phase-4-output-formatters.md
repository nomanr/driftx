# Phase 4: Output Formatters + Clipboard — Design Spec

**Goal:** Unified output formatting across all drift commands with three formats (terminal, markdown, JSON) and clipboard integration. Completes v1: the developer tool.

**Architecture:** A formatter interface that all commands use. Commands return structured data; the CLI layer picks the formatter based on `--format` and `--copy` flags. Replaces inline formatting in each command.

**Tech Stack:** picocolors for terminal colors, pbcopy/xclip/clip.exe for clipboard (no npm dependency for clipboard).

---

## 1. Formatter Interface

```typescript
// src/formatters/types.ts

type OutputFormat = 'terminal' | 'markdown' | 'json';

interface FormatterContext {
  format: OutputFormat;
  copy: boolean;
}

interface OutputFormatter<T> {
  terminal(data: T): string;
  markdown(data: T): string;
  json(data: T): string;
}
```

Each command domain gets its own formatter:
- `CompareFormatter` — formats `CompareFormatData` (see Section 3)
- `InspectFormatter` — formats `InspectResult` (from `src/inspect/tree-inspector.ts`)
- `DevicesFormatter` — formats `DeviceInfo[]` (from `src/types.ts`)
- `DoctorFormatter` — formats `PrerequisiteCheck[]` (from `src/types.ts`)

**Excluded commands:** `init` and `capture` produce trivial single-line output and do not benefit from multi-format support. They continue to use `console.log()` directly.

## 2. File Structure

```
src/formatters/
  types.ts              # OutputFormat, FormatterContext, OutputFormatter, CompareFormatData
  compare.ts            # CompareFormatter (terminal, markdown, json)
  inspect.ts            # InspectFormatter (terminal, markdown, json)
  devices.ts            # DevicesFormatter (terminal, markdown, json)
  doctor.ts             # DoctorFormatter (terminal, markdown, json)
  clipboard.ts          # copyToClipboard(text: string): Promise<void>
  format.ts             # formatOutput<T>(formatter, data, ctx) — picks format + handles copy
```

## 3. Data Types for Formatters

### CompareFormatData

`DiffResult` lacks device name (only has `metadata.deviceId`) and artifact paths. Rather than polluting the core type, the compare command assembles a format-specific wrapper:

```typescript
// src/formatters/types.ts

interface CompareFormatData {
  result: DiffResult;
  device?: { name: string; platform: 'android' | 'ios' };
  artifactDir: string;        // e.g., ".drift/runs/abc123def456"
  tree?: ComponentNode[];     // component tree for context (if available)
  inspectHints?: string[];    // hints from tree inspection
}
```

The compare command builds this from `DiffResult` + `DeviceInfo` + `RunStore` path + `InspectResult`:

```typescript
const formatData: CompareFormatData = {
  result: diffResult,
  device: deviceInfo ? { name: deviceInfo.name, platform: deviceInfo.platform } : undefined,
  artifactDir: store.getRunPath(run.runId),
  tree: inspectResult?.tree,
  inspectHints: inspectResult?.hints,
};
```

### InspectResult

Imported from `src/inspect/tree-inspector.ts` (not `src/types.ts`). Contains: `tree`, `capabilities`, `strategy`, `device`, `hints`.

### DoctorFormatData

`formatPrerequisiteTable` currently returns `{ table, exitCode }`. The exit code logic moves into the command handler. The formatter only handles presentation:

```typescript
// In doctor command handler:
const checks = await checkPrerequisites(shell, config.metroPort);
const exitCode = checks.some(c => c.required && !c.available) ? ExitCode.PrerequisiteMissing : ExitCode.Success;
await formatOutput(doctorFormatter, checks, ctx);
process.exitCode = exitCode;
```

## 4. CLI Changes

Global flags added to the root program:

```typescript
program
  .option('--format <type>', 'output format: terminal, markdown, json', 'terminal')
  .option('--copy', 'copy output to clipboard');
```

All formatted commands use `formatOutput()` instead of `console.log(formatXxx())`.

`formatOutput()` does:
1. Call the appropriate format method on the formatter
2. If `--quiet` is set: skip stdout (but still copy if `--copy`)
3. Otherwise: print to stdout
4. If `--copy`: when format is `terminal`, copy the **markdown** version to clipboard (more useful for pasting). Otherwise copy the same format that was printed.

### Inspect --capabilities flag

The existing `--capabilities` flag is preserved. When used, it limits the inspect output to strategy + capabilities only (no tree). This works across all formats:
- Terminal: strategy + capabilities table (as today)
- Markdown: strategy + capabilities section only
- JSON: `{ capabilities, strategy, device }` (no tree)

### Inspect --json alias

`--json` remains as an alias for `--format json` for backward compatibility.

## 5. Terminal Formatter

Uses `picocolors` for severity coloring.

### Compare Output

When findings exist:
```
  Diff: 2.34% (1,247/53,280 pixels)
  Regions: 3
  Duration: 412ms

  Findings
  ──────────────────────────────────────────────────────
  [MAJOR]  diff-0  SubmitButton [submit-btn]  (120,340 200x44)  14.2% diff  (high)
  [MINOR]  diff-1  HeaderText                 (0,0 393x48)      3.1% diff   (probable)
  [INFO]   diff-2  (unmatched)                (200,600 50x20)   0.8% diff   (approximate)

  Summary: Found 3 differences (1 major, 1 minor, 1 info)
  Inspection: basic (UIAutomator) | Source mapping: unavailable

  Run: abc123def456
```

When no differences found:
```
  Diff: 0.00% (0/53,280 pixels)
  Duration: 412ms

  No differences found.

  Run: abc123def456
```

Note: findings use IDs like `diff-0` (from finding-generator.ts), regions use their own IDs. The terminal shows finding IDs since findings carry the enriched data.

Color mapping:
- `critical` → red bold
- `major` → yellow
- `minor` → cyan
- `info` → dim/gray

Confidence labels:
- >= 0.8 → `(high)`
- 0.5–0.79 → `(probable)`
- < 0.5 → `(approximate)`

### Inspect Output

Same tree format as current with colors:
- Strategy label colored by method (cdp=green, uiautomator/idb=cyan, none=dim)
- Tier indicator `⚛` in green for detailed nodes
- Hints in yellow when present

### Devices Output

Same table as current with state colors: green for booted, yellow for offline, red for unauthorized.

### Doctor Output

Same table as current with green for available, red for missing required, yellow for missing optional.

## 6. Markdown Formatter

Optimized for AI agent consumption. Maximizes context so vision-capable agents can understand and fix issues.

### Compare Output

When findings exist:

```markdown
# Drift Compare Report

**Device:** Pixel_8 (android)
**Strategy:** UIAutomator (native Android)
**Git:** abc1234 on main
**Framework:** react-native
**Diff:** 2.34% (1,247 / 53,280 pixels)
**Regions:** 3
**Duration:** 412ms
**Run ID:** abc123def456

## Artifacts

- Screenshot: `.drift/runs/abc123def456/screenshot.png`
- Design: `.drift/runs/abc123def456/design.png`
- Diff mask: `.drift/runs/abc123def456/diff-mask.png`

## Findings

### 1. [MAJOR] SubmitButton (diff-0)

- **Category:** unknown
- **Component:** SubmitButton
- **testID:** submit-btn
- **Region:** (120, 340) 200x44
- **Diff:** 14.2%
- **Confidence:** high
- **Evidence:**
  - Pixel: 85% score — "14.2% pixel difference in region"
  - Tree: 72% score — "Matched to SubmitButton via bounds overlap (68%)"
- **Region crop:** `.drift/runs/abc123def456/regions/region-0.png`

### 2. [MINOR] HeaderText (diff-1)

- **Category:** unknown
- **Component:** HeaderText
- **Region:** (0, 0) 393x48
- **Diff:** 3.1%
- **Confidence:** probable
- **Region crop:** `.drift/runs/abc123def456/regions/region-1.png`

### 3. [INFO] Unmatched region (diff-2)

- **Region:** (200, 600) 50x20
- **Diff:** 0.8%
- **Confidence:** approximate
- **Region crop:** `.drift/runs/abc123def456/regions/region-2.png`

## Capabilities

| Capability | Level |
|------------|-------|
| Tree | basic |
| Source mapping | none |
| Styles | none |
| Protocol | uiautomator |

## Component Tree Context

FrameLayout (0,0 1080x2400)
  LinearLayout (0,0 1080x2400)
    SubmitButton [submit-btn] (120,340 200x44)
    HeaderText (0,0 393x48)
```

When no differences found:

```markdown
# Drift Compare Report

**Device:** Pixel_8 (android)
**Diff:** 0.00% (0 / 53,280 pixels)
**Run ID:** abc123def456

No differences found.
```

Includes `gitCommit`, `gitBranch`, and `framework` from `RunMetadata` when available — valuable context for AI agents correlating diffs with code changes.

### Inspect Output

```markdown
# Drift Inspect Report

**Device:** Pixel_8 (android)
**Strategy:** UIAutomator (native Android)

## Component Tree

FrameLayout (0,0 1080x2400)
  LinearLayout (0,0 1080x2400)
    ...

## Capabilities

| Capability | Level |
|------------|-------|
| Tree | basic |
| Source mapping | none |
| Styles | none |
| Protocol | uiautomator |

## Hints

- Install idb for native iOS tree inspection: brew install idb-companion && pip install fb-idb
```

Hints section included when `InspectResult.hints` is non-empty.

### Devices Output

```markdown
# Drift Devices

| ID | Name | Platform | OS | State |
|----|------|----------|-----|-------|
| emulator-5554 | Pixel_8 | android | 34 | booted |
| ABC-DEF-123 | iPhone 16 Pro | ios | 18.0 | booted |
```

### Doctor Output

```markdown
# Drift Doctor

| Tool | Status | Version | Required | Fix |
|------|--------|---------|----------|-----|
| adb | available | 35.0.2 | yes | — |
| xcrun | available | 16.0 | yes | — |
| metro | unavailable | — | no | Start Metro with npx react-native start |
```

## 7. JSON Formatter

Outputs the raw data structure as JSON to stdout via `JSON.stringify(data, null, 2)`.

- `compare` → full `CompareFormatData` (includes result, device, artifactDir)
- `inspect` → `{ tree, capabilities, strategy, device, hints }`
- `devices` → `DeviceInfo[]`
- `doctor` → `PrerequisiteCheck[]`

For inspect, the JSON output cherry-picks fields from `InspectResult` to avoid leaking internal state. This matches the current `--json` behavior.

## 8. Clipboard

No npm dependency. Shell-based:

```typescript
// src/formatters/clipboard.ts

export async function copyToClipboard(text: string): Promise<void> {
  const platform = process.platform;
  let cmd: string;
  if (platform === 'darwin') {
    cmd = 'pbcopy';
  } else if (platform === 'win32') {
    cmd = 'clip';
  } else {
    cmd = 'xclip -selection clipboard';
  }
  // pipe text to clipboard command via stdin
  // on failure: log warning, do not throw (output already printed to stdout)
}
```

### Graceful degradation

If the clipboard command fails (e.g., `xclip` not installed on Linux), print a warning to stderr but do not fail the command. The output was already printed to stdout.

### --copy behavior

| Flags | stdout | clipboard |
|-------|--------|-----------|
| (default) | terminal | — |
| `--copy` | terminal | markdown |
| `--format markdown` | markdown | — |
| `--format markdown --copy` | markdown | markdown |
| `--format json` | json | — |
| `--format json --copy` | json | json |
| `--quiet --copy` | (suppressed) | markdown |

Key: `--copy` without `--format` copies **markdown** (most useful for pasting into AI tools), not the terminal-colored output. `--quiet --copy` suppresses stdout but still copies.

## 9. Report Persistence

`drift compare` writes `report.md` to the run directory alongside `result.json`:

```
.drift/runs/<runId>/
  report.md           # Markdown report (always written)
  result.json         # JSON result (already exists)
  ...
```

This happens regardless of `--format` — the markdown report is always persisted for later retrieval. Uses `store.writeArtifact(runId, 'report.md', Buffer.from(markdown))`.

## 10. Migration Plan

Existing formatters in `src/commands/` get replaced by the new formatter module:

| Current | Location | Replacement |
|---------|----------|-------------|
| `formatCompareOutput()` | `src/commands/compare.ts` | `CompareFormatter` |
| `formatTree()`, `formatCapabilities()`, `formatStrategy()`, `formatHints()` | `src/commands/inspect.ts` | `InspectFormatter` |
| `formatDeviceTable()` | `src/commands/devices.ts` | `DevicesFormatter` |
| `formatPrerequisiteTable()` | `src/commands/doctor.ts` | `DoctorFormatter` |

Steps:
1. Install `picocolors`
2. Create `src/formatters/` with the new interface and all formatters
3. Update `src/cli.ts` to add global `--format` and `--copy` flags
4. Update each command handler to use `formatOutput()` instead of inline formatting
5. Move exit code logic out of `formatPrerequisiteTable` into the doctor command handler
6. Keep `--json` on inspect as alias for `--format json`
7. Keep `--capabilities` on inspect (limits output scope, works across all formats)
8. Remove old inline formatters from `src/commands/`
9. Update existing tests, add new tests for each formatter x format combination

## 11. Dependencies

**Add:**
- `picocolors` — terminal colors (3KB, zero deps, faster than chalk)

**No new deps for clipboard** — uses shell commands (pbcopy, xclip, clip.exe).

## 12. Success Criteria

- Commands `compare`, `inspect`, `devices`, `doctor` support `--format terminal|markdown|json` and `--copy`
- Terminal output has severity colors, summary line, and confidence labels
- Terminal output handles zero-findings case cleanly
- Markdown output includes full context: device, strategy, git info, findings with category, image paths, component tree, hints
- Markdown is useful when pasted into Claude Code / Cursor
- JSON outputs raw data structures
- `--copy` copies to system clipboard on macOS, Linux, and Windows
- `--copy` degrades gracefully when clipboard tool is unavailable
- `--quiet --copy` suppresses stdout but still copies
- `report.md` persisted in run artifacts for every compare run
- `drift inspect --json` still works (alias for `--format json`)
- `drift inspect --capabilities` works across all formats
