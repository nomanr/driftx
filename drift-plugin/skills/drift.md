---
name: drift
description: Visual comparison, accessibility audit, and layout regression for React Native and Android apps. Use when the user asks to compare their app against a design, check accessibility, detect visual regressions, inspect the component tree, or capture screenshots from a device/simulator.
---

# drift — Visual Analysis for React Native & Android

Use drift when the user wants to:
- Compare their running app against a design image (Figma export, mockup, etc.)
- Run an accessibility audit on the component tree
- Detect layout regressions between builds
- Inspect the React Native component tree on a device
- Capture a screenshot from a running simulator/emulator

## Prerequisites

drift must be installed in the project: `npm install drift` or available globally.
Run `npx drift doctor` to verify the environment is set up correctly.

## Commands Reference

### `drift compare` — Run visual analysis

The primary command. Compares a screenshot from a running device against a design image or baseline.

```bash
# Compare against a design image
npx drift compare --design path/to/design.png --format json

# Compare with specific device
npx drift compare --design path/to/design.png --device "iPhone 16 Pro" --format json

# Use an existing screenshot instead of capturing
npx drift compare --design path/to/design.png --screenshot path/to/screenshot.png --format json

# Run only specific analyses
npx drift compare --design path/to/design.png --with pixel,a11y --format json

# Exclude specific analyses
npx drift compare --design path/to/design.png --without pixel --format json

# Regression mode — compare against previous run (no design needed)
npx drift compare --baseline --format json
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--design <path>` | Path to design image (PNG). Required unless `--baseline`. |
| `--screenshot <path>` | Use existing screenshot instead of capturing from device. |
| `-d, --device <id>` | Device ID or name to capture from. |
| `--threshold <n>` | Pixel sensitivity threshold (0-1, default 0.1). |
| `--with <analyses>` | Comma-separated analyses to run (e.g., `pixel,a11y,regression`). |
| `--without <analyses>` | Analyses to exclude. |
| `--baseline` | Compare against previous run's screenshot. |
| `--format json` | **Always use this** for structured output. |

**Available analyses:**
| Analysis | What it does | Auto-enabled when |
|----------|-------------|-------------------|
| `pixel` | Pixel-level diff between screenshot and design | Design image provided |
| `a11y` | Accessibility audit — missing labels, small tap targets, images without alt text | Component tree available (device connected) |
| `regression` | Layout regression — diff against previous run | `--baseline` flag used |

**Smart defaults:** When no `--with`/`--without` is specified, analyses auto-enable based on available inputs. You don't need to specify `--with` unless you want to override.

### `drift inspect` — Inspect component tree

```bash
npx drift inspect --format json
npx drift inspect --device "Pixel 8" --format json
```

Returns the React Native component tree with component names, testIDs, text content, and bounds.

### `drift devices` — List connected devices

```bash
npx drift devices --format json
```

Returns available simulators/emulators and their state (booted/offline).

### `drift capture` — Capture screenshot

```bash
npx drift capture --output screenshot.png
npx drift capture --device "iPhone 16 Pro" --output screenshot.png
```

Captures a screenshot from the device and saves it to the specified path.

### `drift doctor` — Check prerequisites

```bash
npx drift doctor --format json
```

Checks that adb, xcrun, Metro, etc. are available.

## Output Interpretation

### JSON format (CompareReport)

When using `--format json`, `drift compare` outputs a `CompareReport`:

```json
{
  "report": {
    "runId": "abc123",
    "analyses": [
      {
        "analysisName": "pixel",
        "findings": [...],
        "summary": "Pixel diff: 2.100% — 3 regions (fail)",
        "metadata": {
          "diffPercentage": 2.1,
          "diffPixels": 5000,
          "totalPixels": 238000,
          "regions": [...],
          "passed": false
        },
        "durationMs": 450
      },
      {
        "analysisName": "a11y",
        "findings": [...],
        "summary": "2 accessibility issues found",
        "metadata": {
          "totalChecked": 15,
          "issuesByType": { "label": 1, "tapTarget": 1, "image": 0, "emptyText": 0 }
        },
        "durationMs": 5
      }
    ],
    "findings": [...],
    "summary": "...",
    "durationMs": 460
  },
  "artifactDir": ".drift/runs/abc123"
}
```

Key fields to check:
- `report.analyses[].metadata.passed` — `false` means the analysis failed its threshold
- `report.analyses[].findings` — individual issues found
- `report.findings` — all findings merged across analyses
- `artifactDir` — where screenshots, diff masks, and region crops are saved

### Artifacts

After a compare run, artifacts are saved to `.drift/runs/<runId>/`:

| File | Description |
|------|-------------|
| `screenshot.png` | Captured screenshot |
| `design.png` | Copy of the design image |
| `diff-mask.png` | Visual overlay showing pixel differences |
| `regions/<id>.png` | Cropped images of each diff region |
| `regression-diff-mask.png` | Diff mask for regression analysis |
| `result.json` | Full CompareReport as JSON |
| `report.md` | Human-readable markdown report |

Read `report.md` for a formatted summary. Read `result.json` for structured data. View diff mask and region crops to understand what changed visually.

### Finding categories

| Category | Source | Meaning |
|----------|--------|---------|
| `spacing`, `color`, `font`, `alignment`, `size`, `content`, `missing`, `extra` | pixel analysis | Visual differences between design and screenshot |
| `accessibility` | a11y analysis | Missing labels, small tap targets, images without alt text |
| `regression` | regression analysis | Layout changed from previous baseline |

### Finding severity

- `critical` — major visual breakage
- `major` — noticeable difference (missing labels, significant pixel diff)
- `minor` — small issues (slightly small tap targets)
- `info` — informational (empty text nodes)

## Workflow Patterns

### Compare against a Figma design

If the user has a Figma MCP server connected, use it to export the frame as an image first, then run drift:

1. Use Figma MCP to get the design frame → save as PNG
2. Run `npx drift compare --design <saved-image-path> --format json`
3. Read the JSON output to understand differences
4. Read artifact files (diff mask, report.md) for visual context
5. Suggest code fixes based on the findings

If no Figma MCP, ask the user to provide the design image path.

### Accessibility audit

```bash
npx drift compare --design <path> --with a11y --format json
```

Or without a design image (a11y only needs the component tree):
```bash
npx drift compare --baseline --with a11y --format json
```

Review findings with `category: 'accessibility'` and suggest fixes (add accessibilityLabel, increase tap target size, etc.).

### Regression detection

```bash
npx drift compare --baseline --format json
```

Compares current app state against the most recent previous run. No design file needed. Useful after code changes to verify nothing broke visually.

### Full audit (all analyses)

```bash
npx drift compare --design <path> --with pixel,a11y --format json
```

Runs pixel diff and accessibility audit together.

## Configuration

drift uses `.driftrc.json` in the project root. Run `npx drift init` to create one. Key settings:

- `platform`: `"android"` or `"ios"`
- `metroPort`: Metro bundler port (default 8081)
- `threshold`: Pixel sensitivity (default 0.1)
- `diffThreshold`: Pass/fail percentage threshold (default 0.01)
- `analyses.default`: Default analyses to run
- `analyses.disabled`: Analyses to never run

## Error Handling

- If no booted device is found, suggest the user start a simulator/emulator
- If Metro is not running, suggest `npx react-native start`
- If `drift doctor` shows missing prerequisites, show the user which tools to install
- If compare fails with "Either --design or --baseline must be provided", one of those flags is required
