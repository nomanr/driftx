# driftx

Give your AI coding agent eyes and hands for your mobile app. driftx lets Claude Code, Cursor, and other AI agents see your app's screen, tap buttons, type text, and compare against designs — on iOS simulators and Android emulators.

## Setup

### Claude Code

```bash
npm install -g driftx
driftx setup-claude
```

Restart Claude Code. The agent now has the `driftx` skill and can capture screenshots, inspect the UI, interact with the app, and run visual comparisons autonomously.

### Cursor

```bash
npm install -g driftx
```

Add to your project's `.cursor/rules` or system prompt:

```
You have access to `driftx`, a CLI tool for mobile app testing.

Key commands:
- `driftx capture -o screenshot.png` — capture a screenshot
- `driftx inspect --json` — get the component tree with tap targets
- `driftx tap "Button Text"` — tap a component by text, testID, or name
- `driftx type input-id "text"` — type into a text field
- `driftx swipe up` — swipe gestures
- `driftx compare --design design.png --format json` — compare app against a design

Always capture a screenshot after interactions to verify the result.
Run `driftx doctor` to check the environment is ready.
```

### Other AI Agents

driftx is a standard CLI. Any agent that can run shell commands can use it. Point the agent at `driftx --help` or provide the commands above in its system prompt.

## What It Does

**See the app** — Capture screenshots, inspect the React Native component tree, get element positions and text content.

**Interact with the app** — Tap buttons, type text, swipe, navigate back, open deep links. Targets resolve by testID, component name, or visible text.

**Compare against designs** — Pixel-diff against Figma exports or mockups. Run accessibility audits. Detect layout regressions between builds.

## Prerequisites

- **Metro bundler** running (`npx react-native start`)
- **Android**: `adb` available, emulator booted
- **iOS**: `xcrun simctl` available, simulator booted

```bash
driftx doctor  # verify your setup
```

## Commands

### Capture & Compare

```bash
driftx capture -o screenshot.png
driftx compare --design mockup.png --format json
driftx compare --design mockup.png --with a11y --format json
driftx compare --baseline --format json
```

### Inspect

```bash
driftx inspect --json
```

Returns component names, testIDs, text content, and bounds.

### Interact

```bash
driftx tap "Login"                        # tap by text
driftx tap login-btn                      # tap by testID
driftx tap 150,300 --xy                   # tap by coordinates
driftx type email-input "user@test.com"   # type into field
driftx swipe up                           # swipe gesture
driftx swipe down --distance 200          # custom distance
driftx go-back                            # back button
driftx open-url "myapp://profile/123"     # deep link
```

### Utilities

```bash
driftx devices       # list simulators/emulators
driftx doctor        # check prerequisites
driftx init          # generate .driftxrc.json
driftx setup-claude  # register Claude Code plugin
```

## Global Flags

| Flag | Description |
|------|-------------|
| `-d, --device <id>` | Device ID or name (picker shown if multiple devices booted) |
| `--bundle-id <id>` | iOS bundle identifier (auto-detected from Metro) |
| `--verbose` | Debug logging |
| `--format <type>` | `terminal`, `markdown`, or `json` |
| `--copy` | Copy output to clipboard |

## Platform Support

| Platform | Emulator/Simulator | Physical Device |
|----------|-------------------|-----------------|
| Android  | Supported         | Not yet         |
| iOS      | Supported         | Not yet         |

## How It Works

**Tap resolution** uses a 4-tier fallback chain:
1. CDP fiber tree — React Native component names and text
2. XCUITest companion hierarchy — iOS accessibility labels with real screen bounds
3. Accessibility element query — XCUITest `/find` endpoint
4. Fiber measurement — `stateNode.measureInWindow()` for elements without a11y labels

**iOS companion** is a pre-built XCUITest server that auto-launches on the simulator. Ships pre-built in the npm package — no Xcode build step on install.

**Visual analysis** compares screenshots pixel-by-pixel against design images, runs accessibility checks on the component tree, and detects layout regressions between builds.

## Configuration

```bash
driftx init
```

Or create `.driftxrc.json` manually:

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
npm run build:ios    # rebuild iOS companion after Swift changes
```

## License

MIT
