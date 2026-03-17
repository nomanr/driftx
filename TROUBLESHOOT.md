# driftx Troubleshooting Guide

Paste this entire file into your AI tool (Claude Code, Cursor, Gemini, Codex) and describe your issue. The agent will have enough context to diagnose and fix it.

## What is driftx

driftx is a CLI tool that gives AI coding agents the ability to see, interact with, and verify mobile apps running on iOS simulators and Android emulators. It captures screenshots, inspects React Native component trees, taps buttons, types text, swipes, and compares the app against design images.

## Architecture

```
Design Image (Figma / Stitch / PNG)
        |
        v
   driftx CLI  <------>  Metro Bundler (port 8081)
        |                      |
        |                 CDP Protocol
        |                      |
        v                      v
   Simulator/Emulator    React Native App
        |
        +-- iOS: xcrun simctl + XCUITest companion (auto-launched)
        +-- Android: adb
```

**Key connections:**
- **Metro bundler** must be running for component tree inspection, tap-by-text resolution, and bundle ID auto-detection
- **iOS**: Uses `xcrun simctl` for screenshots and an XCUITest companion app for taps/swipes/hierarchy. The companion auto-launches when needed.
- **Android**: Uses `adb` for screenshots and input events
- **CDP (Chrome DevTools Protocol)**: Connects to Metro's debugger to inspect the React Native component tree

## How driftx integrates with AI tools

### Claude Code

**How it works:** driftx registers as a Claude Code plugin. The plugin contains a skill file (`SKILL.md`) that teaches Claude how to use driftx commands.

**Files involved:**
- `~/.claude/plugins/driftx` -- symlink to the driftx-plugin directory inside the npm package
- `~/.claude/plugins/installed_plugins.json` -- plugin registry
- `~/.claude/plugins/cache/local/driftx/` -- cached plugin data (cleared on setup)

**Setup:** `npx driftx init` (auto-detects Claude Code) or `npx driftx setup-claude`

**Common issues:**
- Plugin not loading: Restart Claude Code after setup. Check that `~/.claude/plugins/driftx` symlink exists and points to a valid directory.
- Stale skill: Run `npx driftx setup-claude` again to clear cache and re-register.
- Skill not triggering: The skill should auto-activate for design-to-code tasks. If it doesn't, invoke it manually with `/driftx`.

### Cursor

**How it works:** driftx writes a rule file that Cursor loads automatically.

**Files involved:**
- `.cursor/rules/driftx.mdc` -- the skill file with `alwaysApply: true`

**Setup:** `npx driftx init` (auto-detects Cursor) or `npx driftx setup-cursor`

**Common issues:**
- Rule not loading: Check `.cursor/rules/driftx.mdc` exists in your project root.
- Outdated rule: Run `npx driftx setup-cursor` again to overwrite with latest version.

### Gemini CLI

**How it works:** driftx instructions are added to `GEMINI.md` in your project root.

**Setup:** Fetch and follow instructions from:
`https://raw.githubusercontent.com/nomanr/driftx/main/.gemini/INSTALL.md`

### Codex

**How it works:** driftx instructions are added to the Codex agent configuration.

**Setup:** Fetch and follow instructions from:
`https://raw.githubusercontent.com/nomanr/driftx/main/.codex/INSTALL.md`

## Prerequisites

Run `npx driftx doctor --format json` to check all prerequisites. Here's what's needed:

| Prerequisite | Required for | How to verify |
|-------------|-------------|---------------|
| Node.js >= 18 | driftx itself | `node --version` |
| Metro bundler | Tree inspection, tap resolution, bundle ID detection | `curl http://localhost:8081/status` |
| adb | Android emulator | `adb devices` |
| xcrun simctl | iOS simulator | `xcrun simctl list devices booted` |
| Booted device | All commands except doctor/init | `npx driftx devices` |

## Cache and artifacts

driftx stores run artifacts (screenshots, diff masks, reports) in the system cache:

- **macOS**: `~/Library/Caches/driftx/runs/`
- **Linux**: `~/.cache/driftx/runs/` (or `$XDG_CACHE_HOME/driftx/runs/`)

Clean old artifacts: `npx driftx clean` (removes runs older than 7 days)
Clean all: `npx driftx clean --all`

The only project-level file is `.driftxrc.json` (configuration).

## Common issues and fixes

### "No booted device found"
Start a simulator/emulator:
- iOS: `open -a Simulator` or launch from Xcode
- Android: `emulator -avd <name>` or launch from Android Studio

### "Metro not running" / "Cannot connect to Metro"
Start Metro: `npx react-native start`
If using a custom port, set `metroPort` in `.driftxrc.json`.

### "Target not found" (tap command)
Run `npx driftx inspect --json` to see available targets. Tap uses testID, component name, or visible text. If none match, use coordinates: `npx driftx tap 150,300 --xy`

### XCUITest companion won't launch (iOS)
- Check simulator is booted: `xcrun simctl list devices booted`
- The companion auto-launches. If it fails, add `--verbose` to see debug output.
- The companion ships pre-built, no Xcode build step needed.

### Screenshots are blank or wrong size
- Ensure the app is in the foreground on the simulator/emulator
- Try specifying the device: `npx driftx capture -o test.png -d "iPhone 16 Pro"`

### High pixel diff percentage (design comparison)
- If the design image is small (< 400px wide), the comparison may be unreliable. Use structured design data (HTML/CSS) as the source of truth for styles.
- Dynamic content (user data, timestamps, API content) will always differ. These are not issues.
- Run `npx driftx compare --design <path> --format json` and check the `findings` array for specific differences.

### Plugin/skill version mismatch
Run `npx driftx init` to re-register with the latest version. Restart your AI tool after.

## Diagnostics to share

When reporting an issue, include the output of:
```bash
npx driftx doctor --format json
npx driftx devices --format json
npx driftx --version
node --version
```
