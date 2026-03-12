# PLAN.md — drift: Visual Diff Agent for React Native and Android

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Core Modules and Responsibilities](#4-core-modules-and-responsibilities)
5. [Device Management Layer](#5-device-management-layer)
6. [Screenshot Capture Engine](#6-screenshot-capture-engine)
7. [Component Tree Inspection](#7-component-tree-inspection)
8. [Comparison Engine (Hybrid Pipeline)](#8-comparison-engine-hybrid-pipeline)
9. [Source Mapping](#9-source-mapping)
10. [Output Formatters](#10-output-formatters)
11. [Claude Code Plugin Integration](#11-claude-code-plugin-integration)
12. [CLI Design](#12-cli-design)
13. [Configuration System](#13-configuration-system)
14. [Error Handling and Developer UX](#14-error-handling-and-developer-ux)
15. [Performance Budget](#15-performance-budget)
16. [Phase-by-Phase Implementation Order](#16-phase-by-phase-implementation-order)
17. [Technical Challenges and Solutions](#17-technical-challenges-and-solutions)
18. [Testing Strategy](#18-testing-strategy)
19. [Package and Distribution](#19-package-and-distribution)

---

## 1. Executive Summary

**drift** is a pluggable visual analysis platform for React Native and Android development. It captures screenshots from running emulators/simulators, inspects the component tree (CDP for RN, UIAutomator for Android, idb for iOS), and runs multiple analyses (pixel diff, semantic comparison, accessibility audit, layout regression, multi-device matrix, design token extraction) against design specs or baselines. Output is formatted for both humans (terminal, markdown) and AI agents (JSON, Claude Code plugin).

The tool uses a plugin architecture where each analysis implements an `AnalysisPlugin` interface, receives a shared `CompareContext`, and runs in parallel. Users select analyses via `--with`/`--without` flags, config file defaults, or smart auto-detection based on available inputs.

---

## 2. Tech Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript (strict mode) | Type safety, ecosystem alignment with RN tooling, MCP SDK is TypeScript-native |
| Runtime | Node.js >= 18 | Required for `fetch`, `crypto.randomUUID`, stable WebSocket support |
| Build | tsup (esbuild-based) | Fast builds, single-file output for CLI, ESM + CJS dual output |
| CLI framework | Commander.js | Mature, lightweight, supports subcommands, auto-help generation |
| Interactive prompts | @inquirer/prompts | Modern, composable, supports device selection flows |
| Image processing | sharp | Fastest Node.js image library; crop, resize, raw pixel extraction |
| Pixel diff | pixelmatch | Zero-dependency, works on raw pixel buffers, anti-alias detection |
| WebSocket client | ws | Standard Node.js WebSocket library for React DevTools bridge |
| ADB communication | adbkit (or direct child_process) | Pure Node.js ADB client, built-in screenshot support |
| iOS simulator | child_process + xcrun simctl | Direct CLI invocation, no wrapper library needed |
| iOS accessibility | idb (Facebook iOS Development Bridge) | Provides `ui describe-all` for accessibility tree |
| MCP server | @modelcontextprotocol/sdk | Official TypeScript SDK, supports stdio + Streamable HTTP transports |
| Vision model | @anthropic-ai/sdk | Claude API for semantic diff classification |
| Config | cosmiconfig | Standard config loading (.driftrc, .driftrc.json, drift.config.ts) |
| Schema validation | zod | Runtime validation, integrates with MCP SDK tool schemas |
| Clipboard | clipboardy | Cross-platform clipboard access |
| Testing | vitest | Fast, TypeScript-native, compatible with ESM |
| Logging | pino | Structured JSON logging, low overhead |

---

## 3. Project Structure

```
drift/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .driftrc.example.json
├── README.md
├── PLAN.md
│
├── src/
│   ├── index.ts                          # CLI entry point (bin)
│   ├── cli/
│   │   ├── program.ts                    # Commander program definition
│   │   ├── commands/
│   │   │   ├── init.ts                   # drift init
│   │   │   ├── devices.ts               # drift devices
│   │   │   ├── compare.ts               # drift compare
│   │   │   ├── watch.ts                 # drift watch
│   │   │   ├── cross-platform.ts        # drift cross-platform
│   │   │   ├── grab.ts                  # drift grab (interactive element selection)
│   │   │   ├── inspect.ts              # drift inspect
│   │   │   ├── regression.ts           # drift regression
│   │   │   ├── approve.ts             # drift approve
│   │   │   ├── serve.ts               # drift serve --mcp
│   │   │   └── config.ts              # drift config
│   │   └── output/
│   │       ├── table.ts                # CLI pretty-print table formatter
│   │       ├── markdown.ts             # Markdown formatter for clipboard
│   │       ├── json.ts                 # JSON output formatter
│   │       └── renderer.ts            # Shared rendering logic
│   │
│   ├── core/
│   │   ├── types.ts                    # All shared types and interfaces
│   │   ├── config.ts                   # Config loading and validation (cosmiconfig + zod)
│   │   ├── errors.ts                   # Custom error classes
│   │   └── logger.ts                   # Pino logger setup
│   │
│   ├── devices/
│   │   ├── types.ts                    # Device-related types
│   │   ├── manager.ts                  # Device discovery, selection, persistence
│   │   ├── android/
│   │   │   ├── adb.ts                  # ADB wrapper (device list, screencap, forward)
│   │   │   ├── emulator.ts            # Android emulator lifecycle helpers
│   │   │   └── uiautomator.ts         # UIAutomator XML dump + parsing
│   │   ├── ios/
│   │   │   ├── simctl.ts              # xcrun simctl wrapper (list, screenshot, boot)
│   │   │   ├── idb.ts                 # Facebook idb wrapper (accessibility tree)
│   │   │   └── simulator.ts           # iOS Simulator lifecycle helpers
│   │   └── detection.ts               # Framework detection (RN, native Android, native iOS)
│   │
│   ├── capture/
│   │   ├── screenshot.ts              # Unified screenshot capture (delegates to platform)
│   │   ├── scroll.ts                  # Auto-scroll and stitch for full-page capture
│   │   └── settle.ts                  # Wait-for-idle / settle time logic
│   │
│   ├── inspect/
│   │   ├── types.ts                    # Unified component tree types
│   │   ├── tree.ts                     # Unified component tree abstraction
│   │   ├── react-devtools/
│   │   │   ├── bridge.ts              # WebSocket bridge to React DevTools backend
│   │   │   ├── protocol.ts            # Message encoding/decoding (operations, inspectElement)
│   │   │   └── walker.ts             # Tree walker: enumerate elements, batch inspect
│   │   ├── hermes/
│   │   │   └── cdp.ts                 # Chrome DevTools Protocol client for Hermes
│   │   ├── android/
│   │   │   └── hierarchy.ts           # UIAutomator XML -> unified tree
│   │   └── ios/
│   │       └── accessibility.ts       # idb accessibility tree -> unified tree
│   │
│   ├── compare/
│   │   ├── types.ts                    # Diff result types
│   │   ├── pipeline.ts                # Orchestrates the 3-stage comparison pipeline
│   │   ├── pixel/
│   │   │   ├── diff.ts                # pixelmatch wrapper + region extraction
│   │   │   ├── regions.ts            # Connected-component analysis to find diff regions
│   │   │   └── align.ts              # Image alignment (scale, offset correction)
│   │   ├── layout/
│   │   │   ├── diff.ts               # Layout tree comparison (spacing, sizing, alignment)
│   │   │   └── matcher.ts           # Match component tree nodes to diff regions
│   │   ├── semantic/
│   │   │   ├── vision.ts             # Claude Vision API integration
│   │   │   ├── prompt.ts             # Prompt templates for vision model
│   │   │   └── classifier.ts        # Classify diff type (color, spacing, font, missing, extra)
│   │   └── filters/
│   │       ├── dynamic.ts            # Dynamic content filters (text, images, timestamps)
│   │       └── rules.ts             # User-configurable filter rules
│   │
│   ├── source/
│   │   ├── mapper.ts                  # Component name -> source file:line mapping
│   │   ├── metro.ts                   # Metro bundler source map integration
│   │   └── resolve.ts               # File resolution (monorepo-aware)
│   │
│   ├── mcp/
│   │   ├── server.ts                  # MCP server setup (McpServer, transports)
│   │   ├── tools.ts                   # MCP tool registrations
│   │   ├── resources.ts              # MCP resource registrations
│   │   └── prompts.ts               # MCP prompt registrations
│   │
│   └── utils/
│       ├── image.ts                   # Image utility functions (load, save, crop, scale)
│       ├── process.ts                # Child process helpers (exec with timeout)
│       ├── clipboard.ts             # Clipboard write helper
│       ├── deeplink.ts              # Deep link construction per platform
│       └── platform.ts             # OS detection, path resolution
│
├── test/
│   ├── unit/
│   │   ├── compare/
│   │   ├── devices/
│   │   ├── inspect/
│   │   └── source/
│   ├── integration/
│   │   ├── capture.test.ts
│   │   ├── compare-pipeline.test.ts
│   │   └── mcp-server.test.ts
│   └── fixtures/
│       ├── screenshots/             # Reference screenshots for testing
│       ├── designs/                 # Reference design mockups
│       ├── trees/                   # Serialized component trees
│       └── diffs/                   # Expected diff outputs
│
└── docs/
    ├── architecture.md
    ├── device-setup.md
    └── mcp-integration.md
```

---

## 4. Core Modules and Responsibilities

### 4.1 Device Manager (`src/devices/manager.ts`)

Responsible for discovering, selecting, and persisting device configurations.

**Public API:**
```typescript
interface DeviceManager {
  discover(): Promise<Device[]>;
  selectInteractive(): Promise<Device>;
  getPrimary(): Promise<Device | null>;
  getGroup(name: string): Promise<Device[]>;
  getAll(): Promise<Device[]>;
  persist(config: DeviceConfig): Promise<void>;
}
```

**Device type:**
```typescript
interface Device {
  id: string;                    // adb serial or simctl UDID
  name: string;                  // Human-readable name
  platform: 'android' | 'ios';
  type: 'emulator' | 'simulator' | 'physical';
  state: 'booted' | 'offline' | 'unknown';
  sdk: string;                   // API level or iOS version
  framework: 'react-native' | 'android-native' | 'ios-native' | 'unknown';
  screenSize: { width: number; height: number };
  density: number;
}
```

### 4.2 Screenshot Capture (`src/capture/screenshot.ts`)

Abstracts platform-specific screenshot capture into a unified interface.

**Android:** `adb exec-out screencap -p` piped directly to a Buffer (no temp file on device). Falls back to `adb shell screencap -p /sdcard/screenshot.png && adb pull`.

**iOS:** `xcrun simctl io <UDID> screenshot <path.png>`

**Public API:**
```typescript
interface CaptureEngine {
  capture(device: Device, options?: CaptureOptions): Promise<Screenshot>;
  captureFullPage(device: Device, options?: ScrollCaptureOptions): Promise<Screenshot>;
}

interface Screenshot {
  buffer: Buffer;
  width: number;
  height: number;
  device: Device;
  timestamp: number;
  path?: string;   // if saved to disk
}
```

### 4.3 Component Tree Inspector (`src/inspect/tree.ts`)

Builds a unified component tree regardless of the framework.

**Unified tree node:**
```typescript
interface ComponentNode {
  id: string;
  type: 'view' | 'text' | 'image' | 'scroll' | 'input' | 'button' | 'custom';
  name: string;                           // Component name (e.g., "TouchableOpacity", "LinearLayout")
  displayName: string;                    // Display name in dev tools
  framework: 'react-native' | 'android-xml' | 'android-compose' | 'ios-uikit' | 'ios-swiftui';
  bounds: { x: number; y: number; width: number; height: number };
  styles: Record<string, string | number>;  // Flattened style values
  props: Record<string, unknown>;           // Relevant props
  source?: {
    fileName: string;
    lineNumber: number;
    columnNumber?: number;
  };
  children: ComponentNode[];
  parent?: ComponentNode;
  testID?: string;
  accessibilityLabel?: string;
}
```

### 4.4 Comparison Pipeline (`src/compare/pipeline.ts`)

Orchestrates the three-stage diff process.

**Public API:**
```typescript
interface ComparisonPipeline {
  compare(
    screenshot: Screenshot,
    design: DesignReference,
    tree: ComponentNode | null,
    options: CompareOptions
  ): Promise<DiffResult>;
}

interface DiffResult {
  summary: DiffSummary;
  regions: DiffRegion[];
  componentDiffs: ComponentDiff[];
  metadata: {
    screenshot: ScreenshotMeta;
    design: DesignReferenceMeta;
    timing: { pixelMs: number; layoutMs: number; visionMs: number };
  };
}

interface ComponentDiff {
  component: ComponentNode;
  category: 'spacing' | 'sizing' | 'color' | 'font' | 'alignment' | 'visibility' | 'order' | 'extra' | 'missing';
  severity: 'critical' | 'major' | 'minor' | 'info';
  current: Record<string, string | number>;
  expected: Record<string, string | number>;
  description: string;          // Human-readable description from vision model
  pixelRegion: BoundingBox;     // Region in the screenshot
  source?: SourceLocation;
  codeSnippet?: string;
}
```

### 4.5 Source Mapper (`src/source/mapper.ts`)

Resolves component names and React DevTools source info to actual file paths.

**Strategy (in order of preference):**
1. React DevTools `inspectElement` response includes `source.fileName` and `source.lineNumber` (available when `@babel/plugin-transform-react-jsx-source` is active — it is enabled by default in Metro).
2. Metro source maps: fetch `http://localhost:8081/index.map` and resolve component name to file.
3. File system search: grep for `function ComponentName` or `const ComponentName` in the project tree.

### 4.6 MCP Server (`src/mcp/server.ts`)

Exposes drift capabilities as MCP tools for AI coding agents.

---

## 5. Device Management Layer

### 5.1 Discovery

**Android devices:**
```bash
adb devices -l
```
Parse output lines: `<serial> device product:<product> model:<model> device:<device> transport_id:<id>`

**iOS simulators:**
```bash
xcrun simctl list devices --json
```
Parse JSON: `{ devices: { "com.apple.CoreSimulator.SimRuntime.iOS-17-0": [{ udid, name, state }] } }`

**Framework detection:**
- Check if Metro bundler is running: attempt HTTP GET to `http://localhost:8081/status` — if response is "packager-status:running", it is React Native.
- Check for RN: look for `node_modules/react-native` in the project root, or detect `__REACT_DEVTOOLS_GLOBAL_HOOK__` signal via the bridge.
- Android native: `adb shell dumpsys activity top` to find the top activity class name; check for Compose by looking for `androidx.compose` in the view hierarchy dump.
- iOS native: infer from project files (`.xcodeproj` without RN, SwiftUI presence).

### 5.2 Config Persistence

Stored in `.driftrc` (JSON) at project root:

```json
{
  "devices": {
    "primary": "emulator-5554",
    "groups": {
      "all": ["emulator-5554", "8A3F2B1C-..."],
      "android": ["emulator-5554"],
      "ios": ["8A3F2B1C-..."]
    }
  },
  "framework": "react-native",
  "metro": {
    "host": "localhost",
    "port": 8081
  },
  "compare": {
    "threshold": 0.1,
    "ignoreRegions": [],
    "dynamicContent": {
      "ignoreText": true,
      "ignoreImages": true,
      "ignoreTimestamps": true
    }
  },
  "capture": {
    "settleTimeMs": 1000,
    "format": "png"
  },
  "output": {
    "format": "clipboard",
    "screenshotDir": ".drift/screenshots",
    "goldenDir": ".drift/golden"
  },
  "vision": {
    "model": "claude-sonnet-4-20250514",
    "apiKey": "${ANTHROPIC_API_KEY}"
  }
}
```

---

## 6. Screenshot Capture Engine

### 6.1 Android Capture

```typescript
// Fast path: pipe directly to buffer
async function captureAndroid(serial: string): Promise<Buffer> {
  const { stdout } = await execFile('adb', ['-s', serial, 'exec-out', 'screencap', '-p']);
  return Buffer.from(stdout, 'binary');
}
```

Alternatively, using adbkit:
```typescript
import Adb from '@devicefarmer/adbkit';
const client = Adb.createClient();
const stream = await client.screencap(serial);
```

### 6.2 iOS Capture

```typescript
async function captureIOS(udid: string, outPath: string): Promise<Buffer> {
  await execFile('xcrun', ['simctl', 'io', udid, 'screenshot', outPath]);
  return fs.readFile(outPath);
}
```

### 6.3 Settle Time

Before capturing, wait for the UI to be idle:
- **Android:** `adb shell dumpsys window | grep mCurrentFocus` to verify correct activity, then check `dumpsys gfxinfo <package>` for frame rendering completion.
- **iOS:** Capture two screenshots 500ms apart; if pixelmatch reports zero diff pixels, the UI is settled.
- **Configurable:** `settleTimeMs` in config, default 1000ms. Also supports `waitForTestID` to wait until a specific testID is visible.

### 6.4 Full-Page Scroll Capture

1. Capture the initial viewport.
2. Determine scrollable container height via component tree (or fallback: `adb shell wm size` for viewport, estimate from content).
3. Send scroll gesture: `adb shell input swipe 500 1500 500 500 300` (Android) or `xcrun simctl io <udid> sendEvent` / `idb ui swipe` (iOS).
4. Capture next viewport. Use pixelmatch on the overlap region (bottom N pixels of previous = top N pixels of current) to find the exact stitch point.
5. Repeat until scroll position stops changing (last two captures are identical).
6. Stitch all captures vertically using sharp composite.

---

## 7. Component Tree Inspection

### 7.1 React Native: React DevTools Bridge Protocol

This is the primary inspection path for React Native apps.

**Connection flow:**
1. React Native apps in dev mode embed the React DevTools backend. The backend attempts to connect to a WebSocket server on port 8097 (the default React DevTools standalone port).
2. drift starts a WebSocket server on port 8097 (or configured port) that speaks the React DevTools protocol.
3. The backend connects and begins sending operations messages.

**Key implementation in `src/inspect/react-devtools/bridge.ts`:**

```typescript
import { WebSocketServer } from 'ws';

class ReactDevToolsBridge {
  private wss: WebSocketServer;
  private elements: Map<number, ElementData> = new Map();
  private roots: number[] = [];

  async start(port: number = 8097): Promise<void> {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws) => {
      ws.on('message', (data) => this.handleMessage(data));
    });
  }

  private handleMessage(raw: Buffer): void {
    const message = this.decode(raw);
    switch (message.type) {
      case 'operations':
        this.processOperations(message.payload);
        break;
      case 'inspectedElement':
        this.handleInspectedElement(message.payload);
        break;
    }
  }
}
```

**Operations message decoding** (based on the protocol from the OVERVIEW.md):

The operations payload is an array of numbers:
- First two numbers: `rendererID`, `rootFiberID`
- Then a string table: `[totalLength, str1Len, ...str1Codepoints, str2Len, ...str2Codepoints, ...]`
- Then operation sequences: `[opType, ...opData]`

Operation types:
- `1` (TREE_OPERATION_ADD): For root — `[1, fiberID, elementType, isStrictMode, profilingFlags, supportsStrictMode, hasOwnerMetadata]`. For non-root — `[1, fiberID, elementType, parentFiberID, ownerFiberID, displayNameStringTableIndex, keyStringTableIndex]`.
- `2` (TREE_OPERATION_REMOVE): `[2, numRemovedItems, ...fiberIDs]`
- `3` (TREE_OPERATION_REORDER_CHILDREN): `[3, fiberID, numChildren, ...childFiberIDs]`

**Element inspection** — to get props, styles, and source location:

```typescript
async inspectElement(elementID: number): Promise<InspectedElement> {
  return new Promise((resolve) => {
    this.pendingInspections.set(elementID, resolve);
    this.send({
      event: 'inspectElement',
      payload: { id: elementID, rendererID: this.rendererID }
    });
  });
}
```

The response includes:
- `props`: dehydrated props object (expandable on demand)
- `state`: component state
- `hooks`: hook values
- `source`: `{ fileName: string, lineNumber: number, columnNumber: number }` (when jsx-source transform is active)
- `context`: context values

**Batch inspection strategy:**
- First, receive the full tree via operations messages (fast, lightweight).
- Then, for each element that overlaps a diff region, call `inspectElement` to get detailed info.
- Parallelize inspection with a concurrency limit of 5 to avoid overwhelming the bridge.

### 7.2 Hermes CDP (Alternative/Supplement)

For apps using the new React Native DevTools (0.76+), drift can connect via Chrome DevTools Protocol:

```typescript
// Connect to Hermes via Metro's CDP proxy
const ws = new WebSocket('ws://localhost:8081/inspector/device?device=0&page=-1');

// Use CDP Runtime.evaluate to access React internals
ws.send(JSON.stringify({
  id: 1,
  method: 'Runtime.evaluate',
  params: {
    expression: 'window.__REACT_DEVTOOLS_GLOBAL_HOOK__',
    returnByValue: false
  }
}));
```

This is a secondary path. The React DevTools bridge is preferred because it provides a higher-level, structured API specifically designed for component tree traversal.

### 7.3 Android Native: UIAutomator

```typescript
async function getAndroidViewHierarchy(serial: string): Promise<string> {
  await execFile('adb', ['-s', serial, 'shell', 'uiautomator', 'dump', '/dev/tty']);
  // Returns XML to stdout
}
```

Parse the XML into unified `ComponentNode`:

```xml
<hierarchy rotation="0">
  <node index="0" text="" resource-id="com.app:id/root" class="android.widget.FrameLayout"
        bounds="[0,0][1080,1920]" ... >
    <node index="0" text="Hello" class="android.widget.TextView"
          bounds="[100,200][500,250]" ... />
  </node>
</hierarchy>
```

Mapping: `bounds="[left,top][right,bottom]"` -> `{ x: left, y: top, width: right-left, height: bottom-top }`.

For Compose, UIAutomator still works but nodes are flattened. Supplement with `adb shell dumpsys activity top` to identify Compose-specific semantics.

### 7.4 iOS: Accessibility Tree via idb

```typescript
async function getIOSAccessibilityTree(udid: string): Promise<string> {
  const { stdout } = await execFile('idb', ['ui', 'describe-all', '--udid', udid, '--json']);
  return stdout; // JSON format
}
```

Map accessibility elements to unified `ComponentNode` using:
- `AXFrame` -> bounds
- `AXLabel` -> accessibilityLabel
- `AXIdentifier` -> testID
- `AXType` -> type mapping

### 7.5 Unified Tree Builder (`src/inspect/tree.ts`)

All platform-specific trees are converted to the unified `ComponentNode` format. The builder:

1. Receives raw tree data from the appropriate inspector.
2. Normalizes bounds to screen coordinates (handling density scaling for Android).
3. Flattens or nests as appropriate.
4. Enriches with source locations where available.
5. Caches the tree for repeated queries within the same session.

---

## 8. Comparison Engine (Hybrid Pipeline)

### 8.1 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Comparison Pipeline                           │
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐      │
│  │  Step 1   │    │   Step 2      │    │     Step 3         │    │
│  │  Pixel    │───>│   Layout      │───>│     Vision Model   │    │
│  │  Diff     │    │   Tree Diff   │    │     (on-demand)    │    │
│  └──────────┘    └──────────────┘    └───────────────────┘      │
│       │                 │                      │                 │
│  Diff regions     Component        Semantic classification       │
│  (bounding       attribution      + human-readable descriptions  │
│   boxes)         + style values                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Step 1: Pixel Diff

**Input:** Screenshot buffer, design image buffer.

**Pre-processing (alignment):**
1. Resize design to match screenshot dimensions using sharp (bilinear interpolation).
2. If dimensions differ significantly (>5%), warn the user and attempt best-fit scaling.
3. Apply dynamic content masks: detect text regions via the component tree (all `text` type nodes), replace those regions in both images with a solid color before diffing. Same for image nodes, timestamp patterns.

**Core diff:**
```typescript
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';

async function pixelDiff(screenshot: Buffer, design: Buffer, options: PixelDiffOptions): Promise<PixelDiffResult> {
  const img1 = await sharp(screenshot).raw().toBuffer({ resolveWithObject: true });
  const img2 = await sharp(design).resize(img1.info.width, img1.info.height).raw().toBuffer({ resolveWithObject: true });

  const diffBuffer = Buffer.alloc(img1.data.length);
  const numDiffPixels = pixelmatch(
    img1.data, img2.data, diffBuffer,
    img1.info.width, img1.info.height,
    { threshold: options.threshold ?? 0.1, includeAA: false }
  );

  return {
    diffPixels: numDiffPixels,
    totalPixels: img1.info.width * img1.info.height,
    diffPercentage: numDiffPixels / (img1.info.width * img1.info.height),
    diffImage: diffBuffer,
    width: img1.info.width,
    height: img1.info.height
  };
}
```

**Region extraction** (connected-component analysis):
1. Threshold the diff image: any pixel with R > 128 in the diff output is a "diff pixel."
2. Run a flood-fill / connected-component labeling algorithm (union-find) on the binary diff mask.
3. For each connected component, compute the bounding box.
4. Merge overlapping or nearby bounding boxes (within 20px) to reduce fragmentation.
5. Filter out tiny regions (< 100 pixels) as noise.

Output: `DiffRegion[]` — each with a bounding box, pixel count, and cropped diff image.

### 8.3 Step 2: Layout Tree Diff

**Input:** Diff regions from Step 1, unified component tree.

**Process:**
1. For each diff region, find all component tree nodes whose bounds overlap the region (spatial query).
2. For each matched component, extract current style values from the tree: `{ width, height, margin, padding, backgroundColor, fontSize, fontWeight, color, borderRadius, opacity, flexDirection, alignItems, justifyContent }`.
3. Attempt to infer expected values from the design image at the same region:
   - Background color: sample dominant color in the design region.
   - Font size: estimate from text bounding box height if the node is a text element.
   - Spacing: compute gaps between adjacent components in both screenshot and design.
4. Produce a `LayoutDiff` for each component: `{ property, currentValue, expectedValue, delta }`.

**Spatial query optimization:**
Build an R-tree (or simpler: sorted array with binary search on Y then filter on X) from the component tree bounds. For each diff region bounding box, query all overlapping nodes.

### 8.4 Step 3: Vision Model (On-Demand)

**Trigger conditions:**
- Pixel diff detects regions but layout tree cannot fully explain them (no matching component, or style values match but visual difference remains).
- Explicit `--vision` flag passed by user.
- Diff regions are large or numerous, suggesting complex layout issues.

**Implementation:**

```typescript
import Anthropic from '@anthropic-ai/sdk';

async function classifyDiffRegion(
  screenshotCrop: Buffer,
  designCrop: Buffer,
  componentContext: ComponentNode[],
  options: VisionOptions
): Promise<VisionClassification> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: options.model ?? 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: screenshotCrop.toString('base64') }
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: designCrop.toString('base64') }
        },
        {
          type: 'text',
          text: buildClassificationPrompt(componentContext)
        }
      ]
    }]
  });

  return parseClassificationResponse(response);
}
```

**Prompt template** (`src/compare/semantic/prompt.ts`):

```
You are analyzing a visual difference between a running app screenshot (first image) and a design mockup (second image). These are cropped to the specific region where a difference was detected.

The following components exist in this region:
{{#each components}}
- {{name}} ({{type}}) at [{{bounds.x}},{{bounds.y}} {{bounds.width}}x{{bounds.height}}]
  {{#if source}}Source: {{source.fileName}}:{{source.lineNumber}}{{/if}}
  Current styles: {{json styles}}
{{/each}}

Classify this difference into one or more categories:
- spacing: Margins, padding, or gaps between elements differ
- sizing: Width, height, or aspect ratio of an element differs
- color: Background color, text color, or border color differs
- font: Font size, weight, family, or line height differs
- alignment: Element positioning or alignment differs
- visibility: An element is present in one but not the other
- order: Elements appear in a different order
- shape: Border radius, shadow, or shape differs
- content: (only if not filtered) Text or image content differs

For each difference found, respond in JSON:
{
  "differences": [
    {
      "category": "spacing",
      "component": "ComponentName",
      "description": "The margin-bottom on ProfileCard is 16px in the app but appears to be 24px in the design",
      "severity": "major",
      "currentValue": "16px",
      "expectedValue": "24px",
      "cssProperty": "marginBottom"
    }
  ]
}
```

**Cost optimization:**
- Only send cropped diff regions, not full screenshots (reduces token usage by 80-95%).
- Use `claude-sonnet-4-20250514` by default (fast, cheap), allow override to `claude-opus-4-20250514` for complex cases.
- Cache classification results for identical region crops (content-hash).
- Batch multiple small regions into a single API call when they are spatially close.

### 8.5 Dynamic Content Filtering

**Filter pipeline** (applied before pixel diff):

```typescript
interface ContentFilter {
  name: string;
  shouldMask(node: ComponentNode): boolean;
  mask(image: Buffer, region: BoundingBox): Buffer;
}

const defaultFilters: ContentFilter[] = [
  {
    name: 'text-content',
    shouldMask: (node) => node.type === 'text',
    mask: (image, region) => fillRegion(image, region, '#808080')
  },
  {
    name: 'loaded-images',
    shouldMask: (node) => node.type === 'image' && !node.props.source?.startsWith('require('),
    mask: (image, region) => fillRegion(image, region, '#C0C0C0')
  },
  {
    name: 'timestamps',
    shouldMask: (node) => node.type === 'text' && isTimestampPattern(node.props.children),
    mask: (image, region) => fillRegion(image, region, '#808080')
  }
];
```

The filters use the component tree to identify regions to mask. If no component tree is available (native Android without compose-semantics), fall back to heuristic detection (OCR-like bounding box detection for text regions).

---

## 9. Source Mapping

### 9.1 React Native Source Resolution

**Primary: React DevTools `inspectElement` response:**
The `source` field on the inspected element provides `{ fileName, lineNumber, columnNumber }`. This requires the `@babel/plugin-transform-react-jsx-source` Babel plugin, which is enabled by default in React Native's Metro bundler in development mode.

Note: Since React 19 / the PR #28351 in the React repo, `_debugSource` was removed from fibers. Source is now derived lazily from component stacks when an element is inspected in DevTools. drift must use the `inspectElement` bridge message, not attempt to read fiber internals directly.

**Secondary: Metro Source Maps:**
```typescript
async function fetchSourceMap(): Promise<SourceMap> {
  const response = await fetch('http://localhost:8081/index.map?platform=android');
  return response.json();
}
```

Use the `source-map` npm package to resolve generated positions back to original source files.

**Tertiary: File system search:**
For cases where neither DevTools nor source maps are available, search the project:
```typescript
import { glob } from 'glob';

async function findComponentFile(componentName: string, projectRoot: string): Promise<string | null> {
  const files = await glob('**/*.{tsx,jsx,ts,js}', { cwd: projectRoot, ignore: 'node_modules/**' });
  for (const file of files) {
    const content = await fs.readFile(path.join(projectRoot, file), 'utf-8');
    if (content.includes(`function ${componentName}`) ||
        content.includes(`const ${componentName}`) ||
        content.includes(`class ${componentName}`)) {
      return file;
    }
  }
  return null;
}
```

### 9.2 Android Native Source Resolution

For Android native, UIAutomator provides `resource-id` (e.g., `com.app:id/profile_card`). Map this to source:
1. Search `res/layout/*.xml` for the matching `android:id="@+id/profile_card"`.
2. For Compose: the resource-id may correspond to a `testTag` modifier. Search `*.kt` files for `.testTag("profile_card")`.

### 9.3 Code Snippet Extraction

Once a file and line number are resolved, extract a context window:

```typescript
async function extractSnippet(filePath: string, lineNumber: number, contextLines: number = 3): Promise<string> {
  const lines = (await fs.readFile(filePath, 'utf-8')).split('\n');
  const start = Math.max(0, lineNumber - contextLines - 1);
  const end = Math.min(lines.length, lineNumber + contextLines);
  return lines.slice(start, end).map((line, i) => {
    const num = start + i + 1;
    const marker = num === lineNumber ? '>' : ' ';
    return `${marker} ${num} | ${line}`;
  }).join('\n');
}
```

---

## 10. Output Formatters

### 10.1 CLI Table (`src/cli/output/table.ts`)

Pretty-printed table using `chalk` + `cli-table3`:

```
 drift comparison results
 Screenshot: Pixel 7 (emulator-5554) @ 2026-03-11T14:30:00
 Design: mockup.png

 ┌──────────┬────────────────────┬────────────┬────────────┬─────────────────────────────┐
 │ Severity │ Component          │ Property   │ Current    │ Expected   │ Source           │
 ├──────────┼────────────────────┼────────────┼────────────┼─────────────────────────────┤
 │ CRITICAL │ ProfileCard        │ marginTop  │ 8px        │ 16px       │ ProfileCard.tsx:42│
 │ MAJOR    │ HeaderText         │ fontSize   │ 18         │ 24         │ Header.tsx:15    │
 │ MINOR    │ AvatarImage        │ borderRad  │ 8          │ 12         │ Avatar.tsx:28    │
 └──────────┴────────────────────┴────────────┴────────────┴─────────────────────────────┘

 Summary: 3 differences (1 critical, 1 major, 1 minor)
 Pixel diff: 2.3% of viewport changed
```

### 10.2 Clipboard Markdown (`src/cli/output/markdown.ts`)

```markdown
## Visual Diff Report

**Device:** Pixel 7 (emulator-5554)
**Screen:** ProfileScreen
**Compared against:** mockup.png
**Date:** 2026-03-11T14:30:00

### Differences Found: 3

#### 1. [CRITICAL] ProfileCard — marginTop mismatch
- **File:** `src/components/ProfileCard.tsx:42`
- **Current:** `marginTop: 8`
- **Expected:** `marginTop: 16`
- **Description:** The top margin of the ProfileCard component is 8px but the design shows 16px spacing from the header.

```tsx
  39 | const ProfileCard = ({ user }) => {
  40 |   return (
  41 |     <View style={styles.card}>
> 42 |       <View style={{ marginTop: 8, padding: 16 }}>
  43 |         <Text style={styles.name}>{user.name}</Text>
```

#### 2. [MAJOR] HeaderText — fontSize mismatch
...
```

### 10.3 JSON (`src/cli/output/json.ts`)

Full structured output matching the `DiffResult` type for CI/CD pipelines.

### 10.4 Clipboard Write

```typescript
import clipboard from 'clipboardy';

async function copyToClipboard(content: string): Promise<void> {
  await clipboard.write(content);
}
```

Triggered with `--copy` flag or as default output mode.

---

## 11. Claude Code Plugin Integration

> **Note:** The original MCP server approach (Section 11.1-11.6) has been replaced by a Claude Code plugin architecture. The plugin exposes the same tools but as a native Claude Code integration rather than a standalone MCP server. See `docs/superpowers/specs/2026-03-12-analysis-plugin-system-design.md` Section 6 for the updated design.

### 11.1 Server Setup (`src/mcp/server.ts`) [SUPERSEDED — see Claude Code plugin]

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

function createVdiffMcpServer(): McpServer {
  const server = new McpServer({
    name: 'drift',
    version: '1.0.0',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

// For `drift serve --mcp`
async function startStdioServer(): Promise<void> {
  const server = createVdiffMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

### 11.2 MCP Tools (`src/mcp/tools.ts`)

```typescript
import { z } from 'zod';

function registerTools(server: McpServer): void {

  // Tool: capture_screenshot
  server.registerTool('capture_screenshot', {
    title: 'Capture Screenshot',
    description: 'Capture a screenshot from the specified device or the primary device',
    inputSchema: z.object({
      device: z.string().optional().describe('Device ID or "primary"'),
      scroll: z.boolean().optional().describe('Capture full scrollable page'),
      settleMs: z.number().optional().describe('Wait time before capture in ms')
    })
  }, async (args) => {
    const device = await resolveDevice(args.device);
    const screenshot = args.scroll
      ? await captureEngine.captureFullPage(device, { settleMs: args.settleMs })
      : await captureEngine.capture(device, { settleMs: args.settleMs });
    return {
      content: [{
        type: 'image',
        data: screenshot.buffer.toString('base64'),
        mimeType: 'image/png'
      }]
    };
  });

  // Tool: compare_with_design
  server.registerTool('compare_with_design', {
    title: 'Compare with Design',
    description: 'Compare the current screen with a design mockup and return structured diffs mapped to source files',
    inputSchema: z.object({
      designPath: z.string().describe('Path to design mockup image'),
      device: z.string().optional(),
      useVision: z.boolean().optional().describe('Use Claude Vision for semantic analysis')
    })
  }, async (args) => {
    const result = await runComparison(args);
    const markdown = formatMarkdown(result);
    return { content: [{ type: 'text', text: markdown }] };
  });

  // Tool: inspect_component_tree
  server.registerTool('inspect_component_tree', {
    title: 'Inspect Component Tree',
    description: 'Connect to the running app and return the component tree with source locations',
    inputSchema: z.object({
      device: z.string().optional(),
      filter: z.string().optional().describe('Filter by component name pattern')
    })
  }, async (args) => {
    const tree = await inspectTree(args);
    return { content: [{ type: 'text', text: JSON.stringify(tree, null, 2) }] };
  });

  // Tool: inspect_element
  server.registerTool('inspect_element', {
    title: 'Inspect Element',
    description: 'Get detailed props, styles, and source location for a specific component',
    inputSchema: z.object({
      componentName: z.string().optional(),
      testID: z.string().optional(),
      coordinates: z.object({ x: z.number(), y: z.number() }).optional()
    })
  }, async (args) => {
    const element = await inspectElement(args);
    return { content: [{ type: 'text', text: JSON.stringify(element, null, 2) }] };
  });

  // Tool: list_devices
  server.registerTool('list_devices', {
    title: 'List Devices',
    description: 'List all connected emulators and simulators',
    inputSchema: z.object({})
  }, async () => {
    const devices = await deviceManager.discover();
    return { content: [{ type: 'text', text: JSON.stringify(devices, null, 2) }] };
  });

  // Tool: get_diff_for_region
  server.registerTool('get_diff_for_region', {
    title: 'Get Diff for Region',
    description: 'Get detailed diff analysis for a specific screen region (by coordinates or component name)',
    inputSchema: z.object({
      region: z.object({
        x: z.number(), y: z.number(), width: z.number(), height: z.number()
      }).optional(),
      componentName: z.string().optional(),
      designPath: z.string()
    })
  }, async (args) => {
    const result = await getRegionDiff(args);
    return { content: [{ type: 'text', text: formatMarkdown(result) }] };
  });
}
```

### 11.3 MCP Resources (`src/mcp/resources.ts`)

```typescript
function registerResources(server: McpServer): void {
  // Latest screenshot as a resource
  server.registerResource('latest-screenshot', 'drift://screenshots/latest', {
    title: 'Latest Screenshot',
    description: 'The most recently captured screenshot',
    mimeType: 'image/png'
  }, async () => {
    const screenshot = await getLatestScreenshot();
    return {
      contents: [{
        uri: 'drift://screenshots/latest',
        blob: screenshot.buffer.toString('base64'),
        mimeType: 'image/png'
      }]
    };
  });

  // Latest diff result
  server.registerResource('latest-diff', 'drift://diffs/latest', {
    title: 'Latest Diff Result',
    description: 'The most recent comparison result as structured JSON'
  }, async () => {
    const diff = await getLatestDiff();
    return {
      contents: [{
        uri: 'drift://diffs/latest',
        text: JSON.stringify(diff, null, 2),
        mimeType: 'application/json'
      }]
    };
  });

  // Component tree
  server.registerResource('component-tree', 'drift://tree/current', {
    title: 'Current Component Tree',
    description: 'The current component tree from the running app'
  }, async () => {
    const tree = await getCurrentTree();
    return {
      contents: [{
        uri: 'drift://tree/current',
        text: JSON.stringify(tree, null, 2),
        mimeType: 'application/json'
      }]
    };
  });
}
```

### 11.4 MCP Prompts (`src/mcp/prompts.ts`)

```typescript
function registerPrompts(server: McpServer): void {
  server.registerPrompt('fix-diff', {
    title: 'Fix Visual Diff',
    description: 'Generate a prompt to fix a visual difference between the app and the design',
    argsSchema: z.object({
      designPath: z.string().describe('Path to design mockup')
    })
  }, async ({ designPath }) => {
    const result = await runComparison({ designPath });
    const markdown = formatMarkdown(result);
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `The following visual differences were found between the running app and the design mockup.\n\n${markdown}\n\nPlease fix these differences. For each issue, modify the source file at the indicated location to match the design.`
        }
      }]
    };
  });
}
```

### 11.5 MCP Server Configuration for Claude Desktop / Claude Code

The user adds to their MCP config:

```json
{
  "mcpServers": {
    "drift": {
      "command": "npx",
      "args": ["drift", "serve", "--mcp"],
      "cwd": "/path/to/project"
    }
  }
}
```

### 11.6 Recommended Multi-Server Setup (Design Sources via MCP Ecosystem)

drift does not build direct integrations with design tools. Instead, it relies on the MCP ecosystem — users configure design-source MCP servers alongside drift, and the AI agent orchestrates between them. This keeps drift focused on diffing and enables compatibility with any design tool that ships an MCP server.

**Example: drift + Figma MCP**

```json
{
  "mcpServers": {
    "drift": {
      "command": "npx",
      "args": ["drift", "serve", "--mcp"],
      "cwd": "/path/to/project"
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--stdio"]
    }
  }
}
```

**Workflow:** The AI agent fetches design frames from the Figma MCP server, saves them locally, then passes them to drift's `compare_with_design` tool. drift never needs to know about Figma — it just receives an image path.

This pattern extends to any design tool with an MCP server (Sketch, Zeplin, Penpot, etc.) without drift writing adapters for each one.

---

## 12. CLI Design

### 12.1 Command Structure

All commands implemented in `src/cli/commands/`. Each command file exports a function that receives the Commander `Command` object and configures it.

**`drift init`** — Interactive onboarding:
1. Discover devices, present selection.
2. Detect framework (RN, native Android, native iOS).
3. Verify Metro connection (for RN).
4. Create `.driftrc` with selected configuration.
5. Create `.drift/` directory for screenshots and golden images.

**`drift compare --design <path>`** — Core comparison:
1. Load config.
2. Capture screenshot from primary device (or `--device <id>`).
3. Connect and inspect component tree.
4. Run comparison pipeline.
5. Output results (CLI table by default, `--json`, `--copy`, `--output <file>`).

**`drift watch`** — Continuous mode:
1. Watch for file changes (chokidar on project source files).
2. On change, wait for settle, re-capture, re-compare.
3. Show updated diff in terminal (clear + reprint).

**`drift grab`** — Interactive element selection:
1. Capture screenshot, display in terminal (using `sixel` or open in default image viewer).
2. User specifies coordinates or testID.
3. Inspect that specific element, return full details.

**`drift regression`** — CI/CD mode:
1. Load golden screenshots from `.drift/golden/`.
2. Capture current screenshots.
3. Compare each pair.
4. Exit with non-zero status if diffs exceed threshold.
5. Output JUnit XML or JSON for CI integration.

**`drift approve`** — Approve current state:
1. Capture current screenshots.
2. Save to `.drift/golden/` with metadata.
3. Commit-friendly file names: `<screen-name>_<device>_<timestamp>.png`.

### 12.2 Global Flags

```
--device, -d <id>        Target device (default: primary from config)
--config, -c <path>      Config file path (default: .driftrc)
--verbose, -v            Verbose output
--json                   Output as JSON
--copy                   Copy result to clipboard
--no-vision              Skip vision model step
--vision                 Force vision model for all regions
```

---

## 13. Configuration System

Use `cosmiconfig` to search for config in standard locations:

1. `.driftrc` (JSON or YAML)
2. `.driftrc.json`
3. `.driftrc.yaml`
4. `drift.config.ts`
5. `drift.config.js`
6. `package.json` `"drift"` field

Validate with zod schema:

```typescript
const VdiffConfigSchema = z.object({
  devices: z.object({
    primary: z.string().optional(),
    groups: z.record(z.array(z.string())).optional()
  }).optional(),
  framework: z.enum(['react-native', 'android-native', 'ios-native', 'auto']).default('auto'),
  metro: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(8081)
  }).optional(),
  compare: z.object({
    threshold: z.number().min(0).max(1).default(0.1),
    ignoreRegions: z.array(z.object({
      x: z.number(), y: z.number(), width: z.number(), height: z.number()
    })).default([]),
    dynamicContent: z.object({
      ignoreText: z.boolean().default(true),
      ignoreImages: z.boolean().default(true),
      ignoreTimestamps: z.boolean().default(true),
      customPatterns: z.array(z.string()).default([])
    }).default({})
  }).default({}),
  capture: z.object({
    settleTimeMs: z.number().default(1000),
    format: z.enum(['png', 'jpg']).default('png')
  }).default({}),
  output: z.object({
    format: z.enum(['cli', 'clipboard', 'json', 'markdown']).default('clipboard'),
    screenshotDir: z.string().default('.drift/screenshots'),
    goldenDir: z.string().default('.drift/golden')
  }).default({}),
  vision: z.object({
    model: z.string().default('claude-sonnet-4-20250514'),
    apiKey: z.string().optional()
  }).optional()
});
```

---

## 14. Error Handling and Developer UX

The tool must provide clear, actionable error messages — not stack traces. Every external dependency (adb, xcrun, Metro, DevTools) should have a specific error path with fix instructions.

### Error Message Examples

| Failure | Message |
|---|---|
| adb not installed | `adb not found. Install Android SDK Platform Tools: https://developer.android.com/tools/releases/platform-tools` |
| No emulator running | `No running devices found. Start an emulator with: emulator -avd <name> or open Xcode Simulator` |
| Metro not running | `Metro bundler not reachable at localhost:8081. Start it with: npx react-native start` |
| DevTools connection failed | `Could not connect to React DevTools. Ensure the app is running in dev mode. Inspection will fall back to UIAutomator.` |
| Design file not found | `Design file not found: login-mockup.png. Check the path or run: drift designs to see available designs` |
| Screenshot capture timeout | `Screenshot capture timed out after 5s on emulator-5554. Device may be unresponsive. Try: adb -s emulator-5554 shell getprop sys.boot_completed` |

### Graceful Degradation

If a non-critical subsystem fails (e.g., inspection), the tool continues with reduced capabilities and informs the user what is limited rather than aborting entirely.

### Prerequisite Validation

Use a `DiagnosticsChecker` that validates prerequisites before running commands:

```typescript
interface PrerequisiteCheck {
  name: string;
  check: () => Promise<boolean>;
  errorMessage: string;
  fixCommand?: string;
  required: boolean; // false = warn and continue, true = abort
}
```

### Verbose Mode

All errors should include a `--verbose` flag path for debugging: "Run with `--verbose` for full error details."

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Diff found |
| 2 | Configuration error |
| 3 | Runtime error |
| 4 | Prerequisite missing |

---

## 15. Performance Budget

### Target

`drift compare` (local-only path without vision model) must complete in **under 3 seconds** end-to-end.

### Breakdown Budget

| Stage | Budget |
|---|---|
| Device discovery (cached) | < 100 ms |
| Screenshot capture (Android adb) | < 1000 ms |
| Screenshot capture (iOS simctl) | < 800 ms |
| Image loading and alignment | < 200 ms |
| Pixel diff (pixelmatch, 1080x2400) | < 300 ms |
| Region extraction | < 100 ms |
| Tree inspection (async, overlaps with pixel diff) | < 1500 ms |
| Output formatting | < 100 ms |

The vision model path adds 2–5 s per diff region (network-dependent, not included in the local budget).

### Caching Strategy

- Cache device list for 30 s (avoid repeated adb/simctl calls).
- Cache component tree for the duration of a session.
- Cache design image processing (resize, alignment params) between runs.

### Parallel Execution

- Screenshot capture and design image loading happen in parallel.
- Tree inspection runs concurrently with pixel diff.
- Multi-device captures are fully parallel.

### Measurement

Add internal timing to every pipeline stage, logged at `--verbose` level and included in run metadata.

### CI Mode

Set a `--timeout` flag (default 30 s) that aborts the entire run if exceeded.

---

## 16. Phase-by-Phase Implementation Order

### Phase 0: Project Bootstrap (Week 1)

**Goal:** Working project skeleton with build pipeline.

1. Initialize npm project with TypeScript.
2. Configure tsup for CLI build (single entry point, banner with shebang).
3. Configure vitest.
4. Set up Commander.js program with `--help` and `--version`.
5. Implement `src/core/config.ts` (cosmiconfig + zod schema).
6. Implement `src/core/logger.ts` (pino).
7. Implement `src/core/errors.ts` (custom error hierarchy).
8. Stub all CLI commands (just `console.log` placeholders).

**Deliverable:** `npx drift --help` prints usage. `npx drift init` runs (but does nothing yet).

### Phase 1: Device Management + Capture (Week 2-3) — P0

**Goal:** Discover devices, select them, capture screenshots.

1. `src/devices/android/adb.ts` — `listDevices()`, `getDeviceProps()`, `screencap()`.
2. `src/devices/ios/simctl.ts` — `listSimulators()`, `screenshot()`.
3. `src/devices/manager.ts` — `discover()`, `selectInteractive()`, `persist()`.
4. `src/devices/detection.ts` — Framework auto-detection.
5. `src/capture/screenshot.ts` — Unified capture API.
6. `src/capture/settle.ts` — Wait-for-idle.
7. Wire up `drift init` command.
8. Wire up `drift devices` command.
9. Write tests with mock ADB/simctl output.

**Deliverable:** `drift init` discovers devices, lets user select primary, saves config. `drift devices` lists them. Can capture a screenshot.

### Phase 2: Component Tree Inspection (Week 4-5) — P0

**Goal:** Connect to running apps and extract the component tree.

1. `src/inspect/react-devtools/bridge.ts` — WebSocket server, message handling.
2. `src/inspect/react-devtools/protocol.ts` — Operations decoding, string table parsing.
3. `src/inspect/react-devtools/walker.ts` — Tree enumeration, batch `inspectElement`.
4. `src/inspect/android/hierarchy.ts` — UIAutomator XML parsing.
5. `src/inspect/tree.ts` — Unified tree builder.
6. Wire up `drift inspect` command.
7. Test with real RN app + mock WebSocket messages.

**Deliverable:** `drift inspect` prints the component tree with names, bounds, and source locations.

### Phase 3: Hybrid Comparison Engine (Week 6-8) — P0

**Goal:** Full three-stage comparison pipeline.

1. `src/compare/pixel/diff.ts` — pixelmatch wrapper.
2. `src/compare/pixel/regions.ts` — Connected-component region extraction.
3. `src/compare/pixel/align.ts` — Image alignment/scaling.
4. `src/compare/filters/dynamic.ts` — Dynamic content masking.
5. `src/compare/layout/diff.ts` — Layout tree comparison.
6. `src/compare/layout/matcher.ts` — Spatial matching of regions to components.
7. `src/compare/semantic/vision.ts` — Claude Vision API integration.
8. `src/compare/semantic/prompt.ts` — Prompt templates.
9. `src/compare/semantic/classifier.ts` — Response parsing.
10. `src/compare/pipeline.ts` — Pipeline orchestrator.
11. `src/source/mapper.ts` — Source file resolution.
12. `src/source/metro.ts` — Metro source map fetching.
13. Wire up `drift compare` command.
14. Extensive testing with fixture screenshots and designs.

**Deliverable:** `drift compare --design mockup.png` produces a full diff result with component names, file:line, current vs expected values.

### Phase 4: Output Formatters + Source Mapping (Week 9) — P0/P1

**Goal:** All output formats working.

1. `src/cli/output/table.ts` — CLI table.
2. `src/cli/output/markdown.ts` — Markdown with code snippets.
3. `src/cli/output/json.ts` — JSON output.
4. `src/source/resolve.ts` — File resolution, code snippet extraction.
5. `src/utils/clipboard.ts` — Clipboard integration.
6. Complete `drift compare` with all output flags.

**Deliverable:** `drift compare --design mockup.png --copy` copies AI-ready markdown to clipboard.

### Phase 5: Analysis Plugin System — Core Framework — P0

**Goal:** Pluggable multi-analysis architecture. Transform drift compare from a single pixel-diff tool into a composable analysis platform.

1. `src/analyses/types.ts` — AnalysisPlugin, AnalysisResult, CompareContext, CompareReport, DriftImage.
2. `src/analyses/context.ts` — `buildCompareContext()` (shared resource builder).
3. `src/analyses/registry.ts` — AnalysisRegistry (plugin discovery + management).
4. `src/analyses/orchestrator.ts` — AnalysisOrchestrator (`Promise.allSettled`, error handling, result merging).
5. `src/analyses/plugins/pixel.ts` — PixelAnalysis (refactor existing `src/diff/compare.ts` into plugin).
6. Refactor `src/commands/compare.ts` to use orchestrator instead of direct pipeline.
7. Extend `DriftConfig` with `analyses` config section.
8. Update `compareFormatter` for new `CompareReport` type.
9. RunStore extensions: `readArtifact()`, `getLatestRun()`.

**Deliverable:** `drift compare --design mockup.png` works as before but runs through the new plugin architecture. `--with pixel` flag works.

See: `docs/superpowers/specs/2026-03-12-analysis-plugin-system-design.md`

### Phase 6: Analysis Plugins — Accessibility + Regression — P0

**Goal:** First new analyses beyond pixel diff.

1. `src/analyses/plugins/a11y.ts` — AccessibilityAnalysis (missing labels, tap targets, contrast).
2. `src/analyses/plugins/regression.ts` — LayoutRegressionAnalysis (diff against previous run baseline).
3. Extend `DiffFinding.category` and `DiffEvidence.type` unions for new analysis types.
4. CLI: `--baseline` flag, `--with a11y` flag.
5. Smart defaults: auto-enable a11y when tree available, auto-enable regression when baseline exists.

**Deliverable:** `drift compare --design mockup.png --with a11y` audits accessibility. `drift compare --baseline` compares against previous run.

### Phase 7: Analysis Plugins — Semantic + Tokens — P1

**Goal:** Cross-device comparison and design token extraction.

1. `src/analyses/plugins/semantic.ts` — SemanticAnalysis (text/structure comparison, works across device sizes).
2. `src/analyses/plugins/tokens.ts` — DesignTokenAnalysis (color palette extraction + comparison, experimental).
3. OCR integration for design image text extraction (approach TBD — tesseract.js or alternative).

**Deliverable:** `drift compare --design mockup.png --with semantic` works across different device form factors. `--with tokens` extracts and compares color palettes.

### Phase 8: Multi-Device Matrix + CLI Polish — P1

**Goal:** Run analyses across multiple devices in one command.

1. `src/analyses/plugins/multi-device.ts` — MultiDeviceAnalysis (MetaAnalysisPlugin, fans out to sub-contexts).
2. CLI: `--devices "iPhone SE,iPhone 16 Pro"` flag.
3. Matrix summary formatter (device x analysis = pass/fail table).
4. Concurrency control for parallel device capture.

**Deliverable:** `drift compare --design mockup.png --devices "iPhone SE,iPhone 16 Pro"` runs comparison across devices and shows a matrix report.

### Phase 9: Claude Code Plugin — P1

**Goal:** drift as a Claude Code plugin for seamless AI agent integration.

1. `drift-claude-plugin/plugin.json` — Plugin manifest.
2. `drift-claude-plugin/src/tools/` — Tool wrappers (compare, inspect, capture, devices, report).
3. Each tool calls drift's internal APIs directly (same code as CLI).
4. Documentation and setup guide.

**Deliverable:** Claude Code can invoke drift tools directly without CLI parsing. AI agents get structured responses.

### Phase 10: Screen State + Scroll + Polish — P2

**Goal:** Handle real-world complexity.

1. `src/capture/scroll.ts` — Full-page scroll capture with stitching.
2. Screen state detection and deep linking.
3. Settle time improvements (animation-aware waiting).
4. `drift watch` with file watching for continuous comparison.

### Phase 11: CI/CD + Golden Screenshots — P2

**Goal:** Regression testing in CI pipelines.

1. `drift regression` command.
2. `drift approve` command.
3. Golden screenshot storage and versioning.
4. JUnit XML output for CI.
5. GitHub Actions integration example.

---

## 17. Technical Challenges and Solutions

### Challenge 1: React DevTools Bridge Connection Timing

**Problem:** The RN app's DevTools backend tries to connect to port 8097 at startup. If drift's WebSocket server isn't already running, the connection fails and the app may not retry.

**Solution:**
1. drift starts the WebSocket server first, then instructs the user to reload the app (or triggers a reload via Metro's `/reload` endpoint).
2. Alternative: use Metro's existing debugger proxy at `ws://localhost:8081/debugger-proxy?role=debugger&name=drift` — this is always available and the app already connects to it.
3. Implement reconnection logic: if the initial connection fails, poll every 2 seconds for up to 30 seconds.

### Challenge 2: Operations Message Decoding Complexity

**Problem:** The React DevTools operations payload is a dense array of numbers with a custom encoding scheme (string tables, operation type flags) that is not documented as a stable API.

**Solution:**
1. Port the decoding logic from the React DevTools frontend source code (`packages/react-devtools-shared/src/devtools/store.js`).
2. Pin to a specific version of the protocol and document which React DevTools versions are supported.
3. Add protocol version detection: the initial handshake includes a version number that can be used to switch decoders.
4. Comprehensive test fixtures: capture real operations payloads from known apps and use them as regression tests.

### Challenge 3: Image Alignment Between Screenshot and Design

**Problem:** Design mockups may be at different resolutions, aspect ratios, or may include device chrome that the screenshot does not.

**Solution:**
1. Require the user to provide clean design exports (no device chrome). Document this requirement.
2. Smart scaling: detect the design's logical resolution (e.g., from Figma export at 1x, 2x, 3x) and scale to match the screenshot's pixel dimensions.
3. Offer a `--scale` flag for manual override.
4. For significantly different aspect ratios, align from the top-left and warn about the mismatch.

### Challenge 4: Component Tree Not Available

**Problem:** For native Android apps without Compose semantics, or when the DevTools connection fails, the component tree may be unavailable or incomplete.

**Solution:**
1. Graceful degradation: the pixel diff step works without a tree. Skip layout diff and proceed directly to vision model.
2. UIAutomator dump provides a basic hierarchy even for native apps.
3. For iOS, fall back to `xcrun simctl ui describe` for basic accessibility info.
4. Clearly indicate in the output which components could not be source-mapped.

### Challenge 5: Dynamic Content False Positives

**Problem:** User avatars, fetched images, real-time data, and animations cause pixel diffs that are not design bugs.

**Solution:**
1. Default filters mask text content and loaded images before pixel diff.
2. Animation handling: capture two screenshots 500ms apart; if a region differs between them but consistently differs from the design, it is animation. Mask it.
3. User-configurable ignore regions in `.driftrc`.
4. `testID`-based exclusion: `ignoreTestIDs: ["dynamic-content", "ad-banner"]`.

### Challenge 6: Performance of Batch Element Inspection

**Problem:** Calling `inspectElement` for every component in the tree is slow (each call involves a bridge round-trip with ~100ms latency).

**Solution:**
1. Only inspect components that overlap diff regions (typically 5-20 components, not hundreds).
2. Parallelize with concurrency limit of 5.
3. Cache inspection results for the session.
4. Use the lightweight operations data (name, type, parent) for initial matching; only call `inspectElement` for the final selected components.

### Challenge 7: Cross-Platform Consistency

**Problem:** The same RN component renders differently on iOS and Android (platform-specific defaults for shadows, fonts, etc).

**Solution:**
1. The `drift cross-platform` command captures from both platforms and diffs them against each other (not against a design).
2. Maintain a known-differences list for platform defaults (e.g., `elevation` on Android vs `shadowOffset` on iOS).
3. Filter out known platform differences by default, with a `--strict` flag to include them.

---

## 18. Testing Strategy

### Unit Tests

- **Protocol decoding:** Test operations message parsing with fixture payloads.
- **Region extraction:** Test connected-component analysis with known diff images.
- **Layout diff:** Test spatial matching with mock component trees and regions.
- **Source mapping:** Test file resolution with mock file systems.
- **Config validation:** Test zod schema with valid and invalid configs.
- **Output formatters:** Test markdown, JSON, and table generation.

### Integration Tests

- **Capture pipeline:** Mock ADB/simctl commands and verify screenshot capture flow.
- **Comparison pipeline:** Feed fixture screenshots + designs + trees through the full pipeline.
- **MCP server:** Start the server, connect a client, invoke tools, verify responses.

### E2E Tests (Manual / CI with Emulators)

- Run against a sample RN app in an Android emulator.
- Capture, inspect, and compare with a known design.
- Verify the full output matches expectations.

### Test Fixtures

Store in `test/fixtures/`:
- `screenshots/`: Real emulator screenshots (various devices, states).
- `designs/`: Matching design mockups (with known differences introduced).
- `trees/`: Serialized component trees from real inspections.
- `operations/`: Raw React DevTools operations payloads.
- `diffs/`: Expected diff outputs for snapshot testing.

---

## 19. Package and Distribution

### package.json (key fields)

```json
{
  "name": "drift",
  "version": "0.1.0",
  "description": "Visual diff agent for React Native and Android — compare running app UI against design mockups",
  "bin": {
    "drift": "./dist/index.js"
  },
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "test:ci": "vitest run",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "...",
    "@inquirer/prompts": "...",
    "@modelcontextprotocol/sdk": "...",
    "chalk": "...",
    "cli-table3": "...",
    "clipboardy": "...",
    "commander": "...",
    "cosmiconfig": "...",
    "pino": "...",
    "pixelmatch": "...",
    "sharp": "...",
    "source-map": "...",
    "ws": "...",
    "zod": "..."
  }
}
```

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: true,
  banner: { js: '#!/usr/bin/env node' },
  splitting: false,
  sourcemap: true
});
```

### Installation

```bash
# Global install
npm install -g drift

# Run without install
npx drift init

# As dev dependency
npm install -D drift
```

---

### Critical Files for Implementation

- `/Users/nomanr/Documents/Workspace/workspace-react-native/drift/src/compare/pipeline.ts` - Core orchestrator for the three-stage hybrid comparison engine; the most architecturally critical file that ties pixel diff, layout diff, and vision model together
- `/Users/nomanr/Documents/Workspace/workspace-react-native/drift/src/inspect/react-devtools/bridge.ts` - WebSocket bridge to React DevTools backend; implements the custom binary protocol for receiving the component tree and inspecting elements for source locations
- `/Users/nomanr/Documents/Workspace/workspace-react-native/drift/src/devices/manager.ts` - Device discovery and management layer; the foundation that all capture and inspect operations depend on
- `/Users/nomanr/Documents/Workspace/workspace-react-native/drift/src/mcp/tools.ts` - MCP tool registrations that expose drift capabilities to AI coding agents; defines the contract between drift and external AI systems
- `/Users/nomanr/Documents/Workspace/workspace-react-native/drift/src/core/types.ts` - Shared type definitions (Device, ComponentNode, DiffResult, ComponentDiff) that establish the data model flowing through every module