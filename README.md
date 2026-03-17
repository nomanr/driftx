# driftx

Your AI agent can code. Now it can use your app.

driftx gives coding agents eyes and hands inside apps running on iOS simulators and Android emulators.

<p>
  <a href="https://www.npmjs.com/package/driftx"><img src="https://img.shields.io/npm/v/driftx?style=flat-square&color=e8a23e&label=npm" alt="npm version" /></a>
  &nbsp;
  <a href="https://github.com/nomanr/driftx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/driftx?style=flat-square&color=c49344" alt="license" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/driftx"><img src="https://img.shields.io/npm/dm/driftx?style=flat-square&color=b8860b" alt="downloads" /></a>
  &nbsp;
  <img src="https://img.shields.io/badge/iOS%20%7C%20Android-e8a23e?style=flat-square&label=platform" alt="platform" />
</p>

### Watch an AI agent inspect, interact with, and verify a live app

https://github.com/user-attachments/assets/9d757aa6-ac70-4eae-bbf4-49df70ff345a

Fix UI bugs faster, compare screens to designs, and validate real app flows visually.

## What you can do

Ask your agent things like:

- **"Make this screen match the Figma"** - compare a design mockup against the running app, then fix the differences
- **"The login button is cut off, why?"** - agent sees the issue, inspects the component tree, and fixes the layout
- **"What components are on this screen?"** - inspect the full hierarchy with testIDs, bounds, and props
- **"Run an accessibility check on this screen"** - audit for contrast, labels, and touch target sizes
- **"Walk through the onboarding flow and screenshot each step"** - navigate, interact, and capture along the way
- **"Compare this against yesterday's build"** - detect visual regressions between builds

### See it in action

https://github.com/user-attachments/assets/c99076cc-83fc-4c23-b215-0d1b3912f991

## Quick Start

### 1. Setup

```bash
npx -y driftx@latest init
```

Creates project config and auto-registers with detected AI tools (Claude Code, Cursor). Restart your AI tool after.

### 2. Connect your agent

<details open>
<summary><strong>Claude Code</strong></summary>

Handled automatically by `npx -y driftx@latest init`. Just restart Claude Code.

**Fallback** - if auto-detection doesn't work:

```bash
npx driftx setup-claude
```

Verify with `npx driftx doctor`, then restart Claude Code.

</details>

<details>
<summary><strong>Cursor</strong></summary>

Tell Cursor:

```
Fetch and follow instructions from https://raw.githubusercontent.com/nomanr/driftx/main/.cursor/INSTALL.md
```

Verify with `driftx doctor`, then close and restart the chat.

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

Tell Gemini:

```
Fetch and follow instructions from https://raw.githubusercontent.com/nomanr/driftx/main/.gemini/INSTALL.md
```

Verify with `driftx doctor`, then close and restart the chat.

</details>

<details>
<summary><strong>Codex</strong></summary>

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/nomanr/driftx/main/.codex/INSTALL.md
```

Verify with `driftx doctor`, then close and restart the chat.

</details>

<details>
<summary><strong>Other agents</strong></summary>

Any agent that runs shell commands can use driftx. Add this to your agent's system prompt:

```
You have access to `driftx` for seeing and interacting with mobile apps:
- npx driftx capture -o screenshot.png                    # capture a screenshot
- npx driftx inspect --json                               # get the component tree
- npx driftx tap "Button Text"                            # tap by text, testID, or name
- npx driftx type input-id "text"                         # type into a field
- npx driftx swipe up                                     # swipe gestures
- npx driftx compare --design design.png --format json    # compare against a design
Always capture a screenshot after interactions to verify the result.
```

</details>

### 3. Verify

Ask your AI agent:

```
What do you know about driftx?
```

If it describes driftx and its capabilities, you're all set. You can also run `npx driftx doctor` to check that Metro, adb, xcrun, and your simulators are ready.

## Commands

```bash
# See: capture screenshots and inspect the component tree
npx driftx capture -o screenshot.png
npx driftx inspect --json

# Interact: tap, type, swipe, navigate
npx driftx tap "Login"                        # by text
npx driftx tap login-btn                      # by testID
npx driftx tap 150,300 --xy                   # by coordinates
npx driftx type email-input "user@test.com"
npx driftx swipe up
npx driftx swipe down --distance 200
npx driftx go-back
npx driftx open-url "myapp://profile/123"

# Compare: diff against designs, audit accessibility, detect regressions
npx driftx compare --design mockup.png --format json
npx driftx compare --design mockup.png --with a11y --format json
npx driftx compare --baseline --format json

# Utilities
npx driftx devices
npx driftx doctor
npx driftx clean
```

## Flags

| Flag | Description |
|------|-------------|
| `-d, --device <id>` | Device ID or name (picker shown if multiple) |
| `--bundle-id <id>` | iOS bundle identifier (auto-detected from Metro) |
| `--verbose` | Debug logging |
| `--format <type>` | `terminal`, `markdown`, or `json` |
| `--copy` | Copy output to clipboard |

## Requirements

- **Metro bundler** running (`npx react-native start`)
- **Android**: `adb` available, emulator booted
- **iOS**: `xcrun simctl` available, simulator booted

## How It Works

**Tap resolution** uses a 4-tier fallback: CDP fiber tree → XCUITest companion hierarchy → accessibility element query → fiber measurement via `measureInWindow()`.

**iOS companion** is a pre-built XCUITest server that auto-launches on the simulator. Ships in the npm package, no Xcode build step required.

**Visual analysis** compares screenshots pixel-by-pixel against design images, runs accessibility checks, and detects layout regressions between builds.

## Platform Support

| Platform | Emulator/Simulator | Physical Device |
|----------|-------------------|-----------------|
| Android  | Supported         | Not yet         |
| iOS      | Supported         | Not yet         |

## Configuration

```bash
npx -y driftx@latest init
```

Creates `.driftxrc.json`:

```json
{
  "platform": "react-native",
  "metroPort": 8081,
  "threshold": 0.1,
  "diffThreshold": 5
}
```

## Development

```bash
npm install
npm run dev          # watch mode
npm test             # run tests
npm run build:ios    # rebuild iOS companion
```

## License

[MIT](LICENSE)
