---
name: driftx
description: Visual comparison, accessibility audit, layout regression, and device interaction for mobile apps (Android, iOS, React Native). Use when the user asks to compare their app against a design, check accessibility, detect visual regressions, inspect the component tree, capture screenshots, or interact with a device/simulator (tap, type, swipe, navigate).
---

# driftx -- Visual Analysis for React Native & Android

## Skill Priority (READ THIS FIRST)

**driftx is BOTH a process skill AND an implementation skill for design-to-code tasks.** When the user asks to build UI from a design, implement a screen from a mockup, or match an app to a design image, driftx MUST be used as the primary workflow. Do NOT route through brainstorming or other process skills first -- driftx's own workflow (decompose into components, create task list, implement, compare) already covers the process.

**driftx takes priority over brainstorming/planning for:**
- "Build this screen from this design"
- "Implement this UI to match this mockup"
- "Make the app look like this image"
- Any task involving a design image + code implementation

## When to Use

- Compare app against a design image (Figma, Stitch, Penpot, or any exported mockup)
- Run an accessibility audit on the component tree
- Detect layout regressions between builds
- Inspect the React Native component tree on a device
- Capture a screenshot from a running simulator/emulator
- Interact with the app (tap, type, swipe, navigate back, open deep links)
- Test a user flow end-to-end

## Setup

```bash
npm install -g driftx
```

**Prerequisites** (run `driftx doctor` to verify):
- Metro bundler running (`npx react-native start`)
- **Android**: `adb` available, emulator booted
- **iOS**: `xcrun simctl` available, simulator booted

Simulators/emulators only. No physical device support yet.

## Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `compare` | `npx driftx compare --design <path> --format json` | Compare screenshot against design or baseline |
| `capture` | `npx driftx capture -o <path>` | Capture screenshot from device |
| `inspect` | `npx driftx inspect --format json` | Get React Native component tree (testIDs, text, bounds) |
| `tap` | `npx driftx tap <target>` | Tap by testID, component name, or visible text |
| `type` | `npx driftx type <target> "text"` | Tap to focus, then type text |
| `swipe` | `npx driftx swipe <up/down/left/right>` | Swipe gesture (default: 300pt iOS, 600pt Android) |
| `go-back` | `npx driftx go-back` | Press back button |
| `open-url` | `npx driftx open-url "myapp://path"` | Open a deep link |
| `devices` | `npx driftx devices --format json` | List connected simulators/emulators |
| `doctor` | `npx driftx doctor --format json` | Check prerequisites |
| `init` | `npx driftx init` | Create project config + register with detected AI tools |
| `setup-claude` | `npx driftx setup-claude` | Register as Claude Code plugin (standalone) |

**Global flags:** `-d <device>`, `--bundle-id <id>`, `--verbose`, `--format <terminal/markdown/json>`, `--copy`

### Compare flags

| Flag | Description |
|------|-------------|
| `--design <path>` | Design image (PNG). Required unless `--baseline`. |
| `--screenshot <path>` | Use existing screenshot instead of capturing. |
| `--threshold <n>` | Pixel sensitivity (0-1, default 0.1). |
| `--with <analyses>` | Analyses to run: `pixel`, `a11y`, `regression`. |
| `--without <analyses>` | Analyses to exclude. |
| `--baseline` | Compare against previous run's screenshot. |
| `--format json` | **Always use this** for structured output. |

Analyses auto-enable based on inputs: `pixel` when design provided, `a11y` when device connected, `regression` when `--baseline` used.

### Tap resolution

Tap resolves targets in order: CDP tree (testID/name/text) -> XCUITest hierarchy -> XCUITest element query -> CDP fiber measurement. Works even without accessibility labels.

### Swipe notes

Use `--distance <n>` for custom distance. If swipe dismisses app or triggers home gesture, reduce distance (e.g., `--distance 150`).

## Compare Output

Artifacts saved to `.driftx/runs/<runId>/`: `screenshot.png`, `design.png`, `diff-mask.png`, `regions/<id>.png`, `result.json`, `report.md`.

Key JSON fields: `report.analyses[].metadata.passed`, `report.findings`, `artifactDir`.

Finding severities: `critical` > `major` > `minor` > `info`.
Finding categories: `spacing`, `color`, `font`, `alignment`, `size`, `content`, `missing`, `extra`, `accessibility`, `regression`.

## Interpreting Visual Differences

**Dynamic data (NOT issues):** counts, timestamps, user-specific text, API-driven content, server images. Mark as OK even if values differ.

**Structural issues (REAL issues):** missing/extra UI elements, wrong labels/icons, layout differences, typography changes, style differences (background, border radius, shadows).

When presenting results, add a Type column to distinguish dynamic data from structural mismatches. Only count structural mismatches.

---

## Design-to-Code Workflow

**You MUST follow this component-level workflow for every design-to-code task. Do not skip any step.**

**STOP. Do NOT write any code until you have completed Phase 1 and Phase 2.**

### Phase 1: Setup & Decompose

1. **Get the design image** and save locally as PNG (e.g., `/tmp/design-target.png`)
2. **Get structured design data if available** -- primary source of truth for exact styles:
   - **Stitch**: Download HTML from `get_screen` (Tailwind classes with exact colors, borders, backgrounds, border-radius, spacing). This is MANDATORY. Try `curl -L` first, then WebFetch, then read directly from `get_screen` response. If all fail, ask the user.
   - **Figma**: Get design tokens or CSS properties if MCP provides them.
   - **Any source with code/CSS/specs**: Always download and read them.
   - Images alone are NOT enough -- they can be low-res or compressed.
   - **If a download method fails, try the next one. NEVER skip structured data because one method failed.**
3. **Read the design image** using the Read tool to visually study it
4. **Check image quality** -- if under 400px wide, rely on structured data for style accuracy
5. **Check for existing theme, component library, and design system:**
   - Search for theme/tokens (colors, spacing, typography, radii, shadows)
   - Search for reusable components (Button, Card, Input, Header, etc.)
   - Search for design system patterns (layout, navigation, lists, forms)
   - MUST reuse existing tokens and components. Do NOT hardcode values or recreate existing components.
6. **Capture a "before" screenshot**: `npx driftx capture -o /tmp/before.png`
7. **Decompose the design into components** -- break into distinct UI sections (header, cards, tab bar, etc.). For each, note which existing components/tokens to reuse and what's new.

### Phase 2: Create Task List (MANDATORY -- before any code)

You MUST create a task list using TaskCreate. Each component becomes a task with sub-steps:

```
TaskCreate(
  subject: "Implement <Component Name>",
  description: "Sub-steps:\n- [ ] Implement the component\n- [ ] Capture screenshot and visually compare against design\n- [ ] Fix mismatches until component matches\n- [ ] Read design and screenshot side by side -- confirm match"
)
```

Always add these final tasks:

```
TaskCreate(
  subject: "Final full-screen comparison",
  description: "Sub-steps:\n- [ ] Capture final screenshot\n- [ ] Run driftx compare for pixel diff\n- [ ] Read both images side by side\n- [ ] Check EACH component area -- confirm every one matches\n- [ ] Fix any remaining mismatches"
)

TaskCreate(
  subject: "Interaction testing",
  description: "Sub-steps:\n- [ ] Test all interactive elements (tap, type, swipe)\n- [ ] Capture screenshots to verify each interaction"
)
```

**Only proceed to Phase 3 after all tasks are created.**

### Phase 3: Implement & Compare Component by Component

**BUILD IN COMPONENTS, NOT MONOLITHS.** Each task from Phase 2 MUST be implemented as its own component or group of components in separate files. Do NOT build the entire screen in a single file or one long component. If the design has a header, a card list, and a tab bar, those are three separate components. This is what makes per-component comparison meaningful.

**VERIFICATION GATE: You CANNOT mark any task as completed without first reading both the design image and a fresh screenshot with the Read tool.**

For EACH task, follow this exact sequence:

**Step 1** -- Mark task as in_progress (TaskUpdate)
**Step 2** -- Implement the component as a separate, reusable component
**Step 3** -- Capture: `npx driftx capture -o /tmp/after-<component>.png`
**Step 4** -- Read the design image (Read tool). Focus on this component's area.
**Step 5** -- Read the screenshot (Read tool). Compare against the design.
**Step 6** -- Checklist (answer each before proceeding):
- Layout match? (spacing, alignment, sizing)
- Colors match? (use exact hex from structured data if available)
- Typography match? (font size, weight, style)
- All elements present? (icons, labels, badges, dividers)
- Shape/style match? (border radius, shadows, elevation -- check structured data for exact values)

**Step 7** -- If ANY fails: fix code, go back to Step 3. If ALL pass: mark task completed.

**NEVER mark a task completed without Steps 4, 5, and 6. This is the most important rule in this skill.**

### Phase 4: Full-Screen Verification

Mark task in_progress, then:

1. Capture: `npx driftx capture -o /tmp/final.png`
2. Run: `npx driftx compare --design /tmp/design-target.png --format json`
3. If pixel diff > 5%, something is wrong. Do NOT dismiss as noise. Investigate.
4. Read design image (Read tool)
5. Read screenshot (Read tool)
6. Check every component area one by one. Verify exact styles against structured data if available.
7. Fix issues, recapture, re-compare until matched.
8. Mark completed.

### Phase 5: Interaction Testing

Mark task in_progress, then:

1. Test every interactive element (tap, type, swipe)
2. Capture screenshot after each interaction, read with Read tool to confirm
3. **Test BOTH happy paths AND edge cases:**
   - **Happy paths**: normal expected usage (tap button, type valid input, swipe content)
   - **Edge cases**: empty input submission, very long text, rapid taps, boundary values
   - **Error states**: invalid input, network errors if applicable, disabled states
   - **Navigation**: back button behavior, deep link handling, state preservation after navigation
4. Mark completed when all interactions verified.

### Phase 6: Results Summary

Present two summary tables:

```
## Design Implementation Results

| # | Component | Layout | Colors | Typography | Elements | Style | Status |
|---|-----------|--------|--------|------------|----------|-------|--------|
| 1 | Header    | Pass   | Pass   | Pass       | Pass     | Pass  | Pass   |
| 2 | Card List | Pass   | Fixed  | Pass       | Pass     | Pass  | Pass   |
| 3 | Tab Bar   | Pass   | Pass   | Pass       | Pass     | Pass  | Pass   |
| 4 | Full-Screen | -    | -      | -          | -        | -     | Pass   |

## Interaction Testing Results

| # | Test | Action | Expected Result | Status |
|---|------|--------|-----------------|--------|
| 1 | Login button | Tap | Navigate to login screen | Pass |
| 2 | Search input | Type "hello" | Text appears in field | Pass |
| 3 | Empty search submit | Tap search with empty input | No crash, shows validation | Pass |
| 4 | Long text input | Type 200+ chars | Text truncates or scrolls, no overflow | Pass |
| 5 | Card list scroll | Swipe up | Scrolls to reveal more cards | Pass |
| 6 | Back navigation | Go back | Returns to previous screen, state preserved | Pass |

Overall: 10/10 passed
```

Values: **Pass** (matched first try), **Fixed** (had mismatches, resolved), **Fail** (unresolved), **-** (n/a).

Always present both tables.

---

## Design Source Workflows

### Stitch

1. `get_screen` to get screenshot URL + HTML code
2. Download screenshot using `curl -L <url> -o /tmp/stitch-design.png`. If curl fails, try WebFetch. If both fail, ask the user to provide the image.
3. **Download and read the HTML** -- MANDATORY. The HTML contains Tailwind classes with exact colors, borders, backgrounds, border-radius, spacing. This is your primary source of truth. Use `curl -L` to download. If curl fails, try WebFetch. If WebFetch fails, the HTML code is already in the `get_screen` response -- read it directly from there. **Do NOT proceed without the HTML. Do NOT guess styles from the screenshot. If all download methods fail, ask the user for help.**
4. Follow the Design-to-Code Workflow above

### Figma

1. Use Figma MCP to export design frame as PNG
2. **Extract CSS properties from the Figma MCP** -- Figma does not provide HTML. Instead, inspect individual nodes/frames to get:
   - Colors (fills, strokes) as hex values
   - Font family, size, weight, line height
   - Padding, margins, gaps
   - Border radius, border width
   - Shadow/elevation values
   - Layout mode (auto-layout direction, spacing)
   - Note these values and use them as your source of truth for styling, same as Stitch HTML.
3. Follow the Design-to-Code Workflow above

### Other sources

Get the design image (export or user-provided path), save as PNG, follow the Design-to-Code Workflow above.

### Quick comparisons (no implementation)

```bash
npx driftx compare --design <path> --format json              # pixel diff
npx driftx compare --baseline --with a11y --format json        # a11y audit
npx driftx compare --baseline --format json                    # regression
npx driftx compare --design <path> --with pixel,a11y --format json  # full audit
```

## Output Formatting

Present results in tables. Always include device name and platform as header.

After results, offer next actions using AskUserQuestion with `options` (radio-button menu). Tailor options to context.

## Configuration

`.driftxrc.json` in project root (run `npx driftx init`): `platform`, `metroPort`, `threshold`, `diffThreshold`, `analyses.default`, `analyses.disabled`.

## Update Detection

Check stderr from every driftx command for update messages. If you see `Update available: X -> Y`, immediately notify the user to run `npm update -g driftx`.

## Error Handling

- No booted device -> suggest starting simulator/emulator
- No Metro -> suggest `npx react-native start`
- `driftx doctor` fails -> show which tools to install
- Tap "Target not found" -> run `npx driftx inspect --json` or use `--xy` coordinates
- Interaction timeout -> add `--verbose` for debug logs
