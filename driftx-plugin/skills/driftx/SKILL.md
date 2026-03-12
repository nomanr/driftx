---
name: driftx
description: Visual comparison, accessibility audit, layout regression, and device interaction for mobile apps (Android, iOS, React Native). Use when the user asks to compare their app against a design, check accessibility, detect visual regressions, inspect the component tree, capture screenshots, or interact with a device/simulator (tap, type, swipe, navigate).
---

# driftx — Visual Analysis for React Native & Android

Use driftx when the user wants to:
- Compare their running app against a design image (Figma export, mockup, etc.)
- Run an accessibility audit on the component tree
- Detect layout regressions between builds
- Inspect the React Native component tree on a device
- Capture a screenshot from a running simulator/emulator
- Interact with the app — tap buttons, type text, swipe, navigate back, open deep links
- Test a user flow end-to-end (navigate, interact, then verify visually)

## Prerequisites

driftx must be installed in the project: `npm install driftx` or available globally.
Run `npx driftx doctor` to verify the environment is set up correctly.

## Commands Reference

### `driftx compare` — Run visual analysis

The primary command. Compares a screenshot from a running device against a design image or baseline.

```bash
# Compare against a design image
npx driftx compare --design path/to/design.png --format json

# Compare with specific device
npx driftx compare --design path/to/design.png --device "iPhone 16 Pro" --format json

# Use an existing screenshot instead of capturing
npx driftx compare --design path/to/design.png --screenshot path/to/screenshot.png --format json

# Run only specific analyses
npx driftx compare --design path/to/design.png --with pixel,a11y --format json

# Exclude specific analyses
npx driftx compare --design path/to/design.png --without pixel --format json

# Regression mode — compare against previous run (no design needed)
npx driftx compare --baseline --format json
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

### `driftx inspect` — Inspect component tree

```bash
npx driftx inspect --format json
npx driftx inspect --device "Pixel 8" --format json
```

Returns the React Native component tree with component names, testIDs, text content, and bounds.

### `driftx devices` — List connected devices

```bash
npx driftx devices --format json
```

Returns available simulators/emulators and their state (booted/offline).

### `driftx capture` — Capture screenshot

```bash
npx driftx capture --output screenshot.png
npx driftx capture --device "iPhone 16 Pro" --output screenshot.png
```

Captures a screenshot from the device and saves it to the specified path.

### `driftx doctor` — Check prerequisites

```bash
npx driftx doctor --format json
```

Checks that adb, xcrun, Metro, etc. are available.

## Output Interpretation

### JSON format (CompareReport)

When using `--format json`, `driftx compare` outputs a `CompareReport`:

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
  "artifactDir": ".driftx/runs/abc123"
}
```

Key fields to check:
- `report.analyses[].metadata.passed` — `false` means the analysis failed its threshold
- `report.analyses[].findings` — individual issues found
- `report.findings` — all findings merged across analyses
- `artifactDir` — where screenshots, diff masks, and region crops are saved

### Artifacts

After a compare run, artifacts are saved to `.driftx/runs/<runId>/`:

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

## Interpreting Visual Differences

When comparing a design against a live app, **distinguish between structural issues and dynamic data**. Not every pixel difference is a bug.

### Dynamic data (NOT issues)

These are expected to differ between a design mockup and a live app — do NOT report them as mismatches:

- **Counts and numbers** — "12 stops" vs "243 stops", "97" vs "99+", timestamps, dates
- **User-specific text** — names, email addresses, avatars, profile data
- **API-driven content** — store names, product titles, list items, map labels, notification badges
- **Images from a server** — map tiles, avatars, product images, thumbnails

### Structural issues (REAL issues)

These are actual design deviations that should be reported:

- **Missing or extra UI elements** — buttons, cards, banners not in the design
- **Different labels/icons** — tab bar says "Settings" but design says "Account", wrong icon
- **Layout differences** — spacing, alignment, sizing that doesn't match the design
- **Typography changes** — bold vs regular, different font size, wrong color
- **Style differences** — wrong background color, border radius, shadows

### How to present comparison results

When showing a design-vs-app comparison table, add a **Type** column:

```
| Area | Design | App | Type | Match? |
|------|--------|-----|------|--------|
| Stop count | "12 stops" | "243 stops" | Dynamic data | OK |
| Tab labels | "Account" | "Settings" | Structural | Mismatch |
| Alert badge | 97 | 99+ | Dynamic data | OK |
| Action buttons | None | "View stops..." | Structural | Mismatch — extra element |
```

Mark dynamic data rows as **OK** even if the values differ. Only flag structural differences as mismatches. Summarize by counting only structural mismatches, not dynamic data differences.

## Workflow Patterns

### Compare against a Figma design

If the user has a Figma MCP server connected, use it to export the frame as an image first, then run driftx:

1. Use Figma MCP to get the design frame → save as PNG
2. Run `npx driftx compare --design <saved-image-path> --format json`
3. Read the JSON output to understand differences
4. Read artifact files (diff mask, report.md) for visual context
5. **Classify each difference** as dynamic data or structural issue
6. Only suggest code fixes for structural issues

If no Figma MCP, ask the user to provide the design image path.

### Accessibility audit

```bash
npx driftx compare --design <path> --with a11y --format json
```

Or without a design image (a11y only needs the component tree):
```bash
npx driftx compare --baseline --with a11y --format json
```

Review findings with `category: 'accessibility'` and suggest fixes (add accessibilityLabel, increase tap target size, etc.).

### Regression detection

```bash
npx driftx compare --baseline --format json
```

Compares current app state against the most recent previous run. No design file needed. Useful after code changes to verify nothing broke visually.

### Full audit (all analyses)

```bash
npx driftx compare --design <path> --with pixel,a11y --format json
```

Runs pixel diff and accessibility audit together.

## Device Interaction

driftx can interact with the running app — tap buttons, type text, swipe, navigate.

### `driftx tap <target>` — Tap a component

```bash
npx driftx tap login-btn
npx driftx tap LoginButton
npx driftx tap "Submit"
npx driftx tap 150,300 --xy
npx driftx tap login-btn --device "iPhone 16 Pro"
```

Returns JSON with interaction result.

### `driftx type <target> <text>` — Type text into a field

```bash
npx driftx type email-input "user@example.com"
```

Taps the target first to focus it, then types.

### `driftx swipe <direction>` — Swipe gesture

```bash
npx driftx swipe up
npx driftx swipe down
npx driftx swipe left
npx driftx swipe right
```

### `driftx go-back` — Press back button

```bash
npx driftx go-back
```

### `driftx open-url <url>` — Open a deep link

```bash
npx driftx open-url "myapp://profile/123"
```

### Interaction Workflow

1. Write/modify code
2. Hot reload
3. `npx driftx tap "Login"` — navigate
4. `npx driftx compare --design mockup.png --format json` — verify
5. Fix issues and repeat

For form testing:
1. `npx driftx type email-input "test@example.com"`
2. `npx driftx type password-input "password123"`
3. `npx driftx tap "Submit"`
4. `npx driftx compare --baseline --format json`

## Configuration

driftx uses `.driftxrc.json` in the project root. Run `npx driftx init` to create one. Key settings:

- `platform`: `"android"` or `"ios"`
- `metroPort`: Metro bundler port (default 8081)
- `threshold`: Pixel sensitivity (default 0.1)
- `diffThreshold`: Pass/fail percentage threshold (default 0.01)
- `analyses.default`: Default analyses to run
- `analyses.disabled`: Analyses to never run

## Output Formatting Rules

**Always present results in a consistent, structured format.** Follow these rules strictly:

### Results Table

Every analysis result — whether it has issues or not — must be shown in a table. Use this format for **each device**:

**When issues are found:**

```
### <Device Name> (<Platform>)

<N> components checked — <M> issues found.

| Severity | Issue | Component | Location |
|----------|-------|-----------|----------|
| Major | Missing accessibilityLabel | android.widget.Button | x:954 y:164 (105x105px) |
| Minor | Small tap target (36x36) | RCTText | x:10 y:200 (36x36px) |
```

**When no issues are found:**

```
### <Device Name> (<Platform>)

<N> components checked — no issues found.

| Category | Count |
|----------|-------|
| Missing labels | 0 |
| Small tap targets | 0 |
| Images without alt text | 0 |
| Empty text nodes | 0 |
```

**For pixel diff results:**

```
### <Device Name> (<Platform>)

| Metric | Value |
|--------|-------|
| Diff | 2.10% (5000 / 238000 pixels) |
| Regions | 3 |
| Duration | 450ms |
| Result | FAIL |

| # | Severity | Category | Component | Region |
|---|----------|----------|-----------|--------|
| 1 | Critical | spacing | LoginButton [login-btn] | (10,20) 100x50 |
```

### Next Actions

After presenting results, **always offer next actions using the AskUserQuestion tool with `options`**. This renders as a radio-button selection menu. Never present choices as plain numbered text.

Example — after a11y audit with issues:
```
AskUserQuestion(
  question: "What would you like to do next?",
  options: [
    "Capture a screenshot to visually identify the issue",
    "Inspect the component tree to find the source component",
    "Fix the issue (add accessibilityLabel)",
    "Run the audit again after changes",
    "Run on another device"
  ]
)
```

Example — after clean results (no issues):
```
AskUserQuestion(
  question: "What would you like to do next?",
  options: [
    "Run pixel diff against a design",
    "Run regression test against previous baseline",
    "Check another device",
    "Inspect the component tree",
    "Capture a screenshot"
  ]
)
```

Tailor the options to the context. Always use AskUserQuestion with options — never plain text lists.

### General Rules

- **Consistent style across all devices** — if you show a table for one device, show a table for all
- **Always include the device name and platform** as a header
- **Always include component count** (from `metadata.totalChecked`)
- **Always offer next actions** as a numbered list
- **Read artifact files** (`report.md`, `result.json`) when you need more detail about findings

## Error Handling

- If no booted device is found, suggest the user start a simulator/emulator
- If Metro is not running, suggest `npx react-native start`
- If `driftx doctor` shows missing prerequisites, show the user which tools to install
- If compare fails with "Either --design or --baseline must be provided", one of those flags is required
