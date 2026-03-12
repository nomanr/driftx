# Phase 12: Device Interaction Layer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give AI agents hands — tree-aware interaction primitives (tap, swipe, type, navigate) that let agents interact with the running app on simulators/emulators.

**Architecture:** A target resolver translates component names/testIDs into screen coordinates using the component tree. Platform-specific backends (adb for Android, xcrun simctl + osascript for iOS) execute the actual input events. A high-level gesture API provides a clean interface. CLI commands expose the primitives for debugging. Each interaction returns the new screen state (screenshot + tree) for immediate feedback.

**Tech Stack:** Existing stack (adb, xcrun simctl, osascript). Zero new dependencies.

---

## File Structure

### New files:
| File | Responsibility |
|------|---------------|
| `src/interact/types.ts` | Interaction types (TapTarget, SwipeDirection, InteractionResult) |
| `src/interact/resolver.ts` | Tree-aware target resolution: name/testID → coordinates |
| `src/interact/android.ts` | Android input via `adb shell input` |
| `src/interact/ios.ts` | iOS input via `xcrun simctl` + `osascript` |
| `src/interact/gestures.ts` | High-level gesture API: tap, longPress, swipe, type, goBack, openUrl |
| `test/unit/interact/resolver.test.ts` | Resolver tests |
| `test/unit/interact/android.test.ts` | Android backend tests (mocked shell) |
| `test/unit/interact/ios.test.ts` | iOS backend tests (mocked shell) |
| `test/unit/interact/gestures.test.ts` | Gesture API tests |

### Modified files:
| File | Change |
|------|--------|
| `src/cli.ts` | Add `drift tap`, `drift type`, `drift swipe`, `drift go-back`, `drift open-url` commands |
| `drift-plugin/skills/drift.md` | Add interaction commands to the skill |

---

## Chunk 1: Core Types + Resolver + Backends

### Task 1: Interaction Types

**Files:**
- Create: `src/interact/types.ts`

- [ ] **Step 1: Create type definitions**

```typescript
// src/interact/types.ts
import type { Shell, DeviceInfo, ComponentNode, BoundingBox } from '../types.js';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface TapTarget {
  x: number;
  y: number;
  resolvedFrom?: string;
}

export interface InteractionResult {
  success: boolean;
  action: string;
  target?: TapTarget;
  durationMs: number;
  error?: string;
}

export interface InteractionBackend {
  tap(device: DeviceInfo, point: Point): Promise<void>;
  longPress(device: DeviceInfo, point: Point, durationMs: number): Promise<void>;
  swipe(device: DeviceInfo, from: Point, to: Point, durationMs: number): Promise<void>;
  type(device: DeviceInfo, text: string): Promise<void>;
  keyEvent(device: DeviceInfo, key: string): Promise<void>;
  openUrl(device: DeviceInfo, url: string): Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/interact/types.ts
git commit -m "feat: interaction type definitions for device interaction layer"
```

---

### Task 2: Target Resolver

**Files:**
- Create: `src/interact/resolver.ts`
- Create: `test/unit/interact/resolver.test.ts`

The resolver finds a component in the tree by testID or name and returns its center coordinates.

- [ ] **Step 1: Write tests**

```typescript
// test/unit/interact/resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTarget } from '../../src/interact/resolver.js';
import type { ComponentNode } from '../../src/types.js';

function makeNode(overrides: Partial<ComponentNode> & { name: string }): ComponentNode {
  return {
    id: '0',
    bounds: { x: 0, y: 0, width: 100, height: 50 },
    children: [],
    inspectionTier: 'detailed',
    ...overrides,
  };
}

describe('resolveTarget', () => {
  it('resolves by testID', () => {
    const tree: ComponentNode[] = [
      makeNode({ name: 'View', children: [
        makeNode({ name: 'Button', testID: 'login-btn', bounds: { x: 50, y: 100, width: 200, height: 44 } }),
      ]}),
    ];
    const result = resolveTarget(tree, 'login-btn');
    expect(result).toEqual({ x: 150, y: 122, resolvedFrom: 'testID:login-btn' });
  });

  it('resolves by component name', () => {
    const tree: ComponentNode[] = [
      makeNode({ name: 'LoginButton', bounds: { x: 10, y: 20, width: 100, height: 40 } }),
    ];
    const result = resolveTarget(tree, 'LoginButton');
    expect(result).toEqual({ x: 60, y: 40, resolvedFrom: 'name:LoginButton' });
  });

  it('resolves by text content', () => {
    const tree: ComponentNode[] = [
      makeNode({ name: 'Text', text: 'Submit', bounds: { x: 0, y: 0, width: 80, height: 30 } }),
    ];
    const result = resolveTarget(tree, 'Submit');
    expect(result).toEqual({ x: 40, y: 15, resolvedFrom: 'text:Submit' });
  });

  it('returns null when not found', () => {
    const tree: ComponentNode[] = [makeNode({ name: 'View' })];
    expect(resolveTarget(tree, 'nonexistent')).toBeNull();
  });

  it('prefers testID over name over text', () => {
    const tree: ComponentNode[] = [
      makeNode({ name: 'Submit', testID: 'submit-btn', text: 'Submit', bounds: { x: 0, y: 0, width: 100, height: 50 } }),
    ];
    const result = resolveTarget(tree, 'Submit');
    expect(result?.resolvedFrom).toBe('testID:submit-btn');
  });

  it('skips nodes with zero-size bounds', () => {
    const tree: ComponentNode[] = [
      makeNode({ name: 'Ghost', testID: 'ghost', bounds: { x: 0, y: 0, width: 0, height: 0 } }),
      makeNode({ name: 'Real', testID: 'ghost', bounds: { x: 10, y: 10, width: 50, height: 50 } }),
    ];
    const result = resolveTarget(tree, 'ghost');
    expect(result).toEqual({ x: 35, y: 35, resolvedFrom: 'testID:ghost' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/interact/resolver.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement resolver**

```typescript
// src/interact/resolver.ts
import type { ComponentNode } from '../types.js';
import type { TapTarget } from './types.js';

export function resolveTarget(tree: ComponentNode[], query: string): TapTarget | null {
  const nodes = flattenTree(tree);

  const byTestID = nodes.find((n) => n.testID === query && hasSize(n));
  if (byTestID) return centerOf(byTestID, `testID:${query}`);

  const byName = nodes.find((n) => n.name === query && hasSize(n));
  if (byName) return centerOf(byName, `name:${query}`);

  const byText = nodes.find((n) => n.text === query && hasSize(n));
  if (byText) return centerOf(byText, `text:${query}`);

  return null;
}

function flattenTree(nodes: ComponentNode[]): ComponentNode[] {
  const result: ComponentNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push(node);
    for (const child of node.children) stack.push(child);
  }
  return result;
}

function hasSize(node: ComponentNode): boolean {
  return node.bounds.width > 0 && node.bounds.height > 0;
}

function centerOf(node: ComponentNode, resolvedFrom: string): TapTarget {
  return {
    x: Math.round(node.bounds.x + node.bounds.width / 2),
    y: Math.round(node.bounds.y + node.bounds.height / 2),
    resolvedFrom,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/interact/resolver.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/interact/resolver.ts test/unit/interact/resolver.test.ts
git commit -m "feat: tree-aware target resolver for device interaction"
```

---

### Task 3: Android Interaction Backend

**Files:**
- Create: `src/interact/android.ts`
- Create: `test/unit/interact/android.test.ts`

All Android interactions use `adb -s <deviceId> shell input <event>`.

- [ ] **Step 1: Write tests**

```typescript
// test/unit/interact/android.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AndroidBackend } from '../../src/interact/android.js';
import type { Shell, DeviceInfo } from '../../src/types.js';

function makeDevice(id = 'emulator-5554'): DeviceInfo {
  return { id, name: 'Pixel 8', platform: 'android', osVersion: '14', state: 'booted' };
}

describe('AndroidBackend', () => {
  let shell: Shell;
  let backend: AndroidBackend;

  beforeEach(() => {
    shell = { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }) };
    backend = new AndroidBackend(shell);
  });

  it('taps at coordinates', async () => {
    await backend.tap(makeDevice(), { x: 150, y: 300 });
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'tap', '150', '300']);
  });

  it('long presses at coordinates', async () => {
    await backend.longPress(makeDevice(), { x: 100, y: 200 }, 1000);
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'swipe', '100', '200', '100', '200', '1000']);
  });

  it('swipes between points', async () => {
    await backend.swipe(makeDevice(), { x: 200, y: 500 }, { x: 200, y: 100 }, 300);
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'swipe', '200', '500', '200', '100', '300']);
  });

  it('types text', async () => {
    await backend.type(makeDevice(), 'hello');
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'text', 'hello']);
  });

  it('escapes spaces in text input', async () => {
    await backend.type(makeDevice(), 'hello world');
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'text', 'hello%sworld']);
  });

  it('sends key events', async () => {
    await backend.keyEvent(makeDevice(), 'KEYCODE_BACK');
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  });

  it('opens URLs via am start', async () => {
    await backend.openUrl(makeDevice(), 'myapp://home');
    expect(shell.exec).toHaveBeenCalledWith('adb', ['-s', 'emulator-5554', 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'myapp://home']);
  });
});
```

- [ ] **Step 2: Implement Android backend**

```typescript
// src/interact/android.ts
import type { Shell, DeviceInfo } from '../types.js';
import type { Point, InteractionBackend } from './types.js';

export class AndroidBackend implements InteractionBackend {
  constructor(private shell: Shell) {}

  async tap(device: DeviceInfo, point: Point): Promise<void> {
    await this.adb(device, ['input', 'tap', String(point.x), String(point.y)]);
  }

  async longPress(device: DeviceInfo, point: Point, durationMs: number): Promise<void> {
    await this.adb(device, ['input', 'swipe', String(point.x), String(point.y), String(point.x), String(point.y), String(durationMs)]);
  }

  async swipe(device: DeviceInfo, from: Point, to: Point, durationMs: number): Promise<void> {
    await this.adb(device, ['input', 'swipe', String(from.x), String(from.y), String(to.x), String(to.y), String(durationMs)]);
  }

  async type(device: DeviceInfo, text: string): Promise<void> {
    const escaped = text.replace(/ /g, '%s');
    await this.adb(device, ['input', 'text', escaped]);
  }

  async keyEvent(device: DeviceInfo, key: string): Promise<void> {
    await this.adb(device, ['input', 'keyevent', key]);
  }

  async openUrl(device: DeviceInfo, url: string): Promise<void> {
    await this.shell.exec('adb', ['-s', device.id, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url]);
  }

  private async adb(device: DeviceInfo, inputArgs: string[]): Promise<void> {
    await this.shell.exec('adb', ['-s', device.id, 'shell', ...inputArgs]);
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/unit/interact/android.test.ts`
Expected: 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/interact/android.ts test/unit/interact/android.test.ts
git commit -m "feat: Android interaction backend via adb shell input"
```

---

### Task 4: iOS Interaction Backend

**Files:**
- Create: `src/interact/ios.ts`
- Create: `test/unit/interact/ios.test.ts`

iOS uses `xcrun simctl` for URLs/keyboard and `osascript` for tap/swipe (AppleScript coordinates the Simulator.app window).

- [ ] **Step 1: Write tests**

```typescript
// test/unit/interact/ios.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IosBackend } from '../../src/interact/ios.js';
import type { Shell, DeviceInfo } from '../../src/types.js';

function makeDevice(id = 'ABCD-1234'): DeviceInfo {
  return { id, name: 'iPhone 16 Pro', platform: 'ios', osVersion: '18.0', state: 'booted' };
}

describe('IosBackend', () => {
  let shell: Shell;
  let backend: IosBackend;

  beforeEach(() => {
    shell = { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }) };
    backend = new IosBackend(shell);
  });

  it('taps via osascript', async () => {
    await backend.tap(makeDevice(), { x: 150, y: 300 });
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'tap', '150', '300']);
  });

  it('long presses via osascript', async () => {
    await backend.longPress(makeDevice(), { x: 100, y: 200 }, 1000);
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'longpress', '100', '200']);
  });

  it('swipes via simctl', async () => {
    await backend.swipe(makeDevice(), { x: 200, y: 500 }, { x: 200, y: 100 }, 300);
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'swipe', '200', '500', '200', '100']);
  });

  it('types text via simctl keyboard', async () => {
    await backend.type(makeDevice(), 'hello');
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'type', 'hello']);
  });

  it('sends key via simctl', async () => {
    await backend.keyEvent(makeDevice(), 'home');
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'io', 'ABCD-1234', 'sendkey', 'home']);
  });

  it('opens URLs via simctl openurl', async () => {
    await backend.openUrl(makeDevice(), 'myapp://home');
    expect(shell.exec).toHaveBeenCalledWith('xcrun', ['simctl', 'openurl', 'ABCD-1234', 'myapp://home']);
  });
});
```

- [ ] **Step 2: Implement iOS backend**

```typescript
// src/interact/ios.ts
import type { Shell, DeviceInfo } from '../types.js';
import type { Point, InteractionBackend } from './types.js';

export class IosBackend implements InteractionBackend {
  constructor(private shell: Shell) {}

  async tap(device: DeviceInfo, point: Point): Promise<void> {
    await this.simctlIo(device, ['tap', String(point.x), String(point.y)]);
  }

  async longPress(device: DeviceInfo, point: Point, _durationMs: number): Promise<void> {
    await this.simctlIo(device, ['longpress', String(point.x), String(point.y)]);
  }

  async swipe(device: DeviceInfo, from: Point, to: Point, _durationMs: number): Promise<void> {
    await this.simctlIo(device, ['swipe', String(from.x), String(from.y), String(to.x), String(to.y)]);
  }

  async type(device: DeviceInfo, text: string): Promise<void> {
    await this.simctlIo(device, ['type', text]);
  }

  async keyEvent(device: DeviceInfo, key: string): Promise<void> {
    await this.simctlIo(device, ['sendkey', key]);
  }

  async openUrl(device: DeviceInfo, url: string): Promise<void> {
    await this.shell.exec('xcrun', ['simctl', 'openurl', device.id, url]);
  }

  private async simctlIo(device: DeviceInfo, args: string[]): Promise<void> {
    await this.shell.exec('xcrun', ['simctl', 'io', device.id, ...args]);
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/unit/interact/ios.test.ts`
Expected: 6 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/interact/ios.ts test/unit/interact/ios.test.ts
git commit -m "feat: iOS interaction backend via xcrun simctl"
```

---

## Chunk 2: Gesture API + CLI Commands

### Task 5: High-Level Gesture API

**Files:**
- Create: `src/interact/gestures.ts`
- Create: `test/unit/interact/gestures.test.ts`

The gesture API is the public interface. It resolves targets from tree, picks the right backend, executes, and returns results with timing.

- [ ] **Step 1: Write tests**

```typescript
// test/unit/interact/gestures.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GestureExecutor } from '../../src/interact/gestures.js';
import type { Shell, DeviceInfo, ComponentNode } from '../../src/types.js';
import type { InteractionBackend } from '../../src/interact/types.js';

function makeDevice(platform: 'android' | 'ios' = 'android'): DeviceInfo {
  return { id: 'dev-1', name: 'Test', platform, osVersion: '14', state: 'booted' };
}

function makeTree(): ComponentNode[] {
  return [{
    id: '1', name: 'LoginButton', testID: 'login-btn',
    bounds: { x: 50, y: 100, width: 200, height: 44 },
    children: [], inspectionTier: 'detailed',
  }];
}

function makeMockBackend(): InteractionBackend {
  return {
    tap: vi.fn().mockResolvedValue(undefined),
    longPress: vi.fn().mockResolvedValue(undefined),
    swipe: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    keyEvent: vi.fn().mockResolvedValue(undefined),
    openUrl: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GestureExecutor', () => {
  let backend: InteractionBackend;
  let executor: GestureExecutor;

  beforeEach(() => {
    backend = makeMockBackend();
    executor = new GestureExecutor(backend);
  });

  it('taps a target by testID', async () => {
    const result = await executor.tap(makeDevice(), makeTree(), 'login-btn');
    expect(result.success).toBe(true);
    expect(result.action).toBe('tap');
    expect(result.target).toEqual({ x: 150, y: 122, resolvedFrom: 'testID:login-btn' });
    expect(backend.tap).toHaveBeenCalledWith(makeDevice(), { x: 150, y: 122 });
  });

  it('returns error when target not found', async () => {
    const result = await executor.tap(makeDevice(), makeTree(), 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(backend.tap).not.toHaveBeenCalled();
  });

  it('taps by raw coordinates', async () => {
    const result = await executor.tapXY(makeDevice(), 100, 200);
    expect(result.success).toBe(true);
    expect(backend.tap).toHaveBeenCalledWith(makeDevice(), { x: 100, y: 200 });
  });

  it('swipes in a direction', async () => {
    const device = makeDevice();
    device.screenSize = { width: 1080, height: 2400, density: 2 };
    const result = await executor.swipe(makeDevice(), 'up');
    expect(result.success).toBe(true);
    expect(backend.swipe).toHaveBeenCalled();
  });

  it('types text into a target', async () => {
    const result = await executor.typeInto(makeDevice(), makeTree(), 'login-btn', 'hello');
    expect(result.success).toBe(true);
    expect(backend.tap).toHaveBeenCalled();
    expect(backend.type).toHaveBeenCalledWith(makeDevice(), 'hello');
  });

  it('goes back', async () => {
    const result = await executor.goBack(makeDevice());
    expect(result.success).toBe(true);
    expect(backend.keyEvent).toHaveBeenCalled();
  });

  it('opens a URL', async () => {
    const result = await executor.openUrl(makeDevice(), 'myapp://home');
    expect(result.success).toBe(true);
    expect(backend.openUrl).toHaveBeenCalledWith(makeDevice(), 'myapp://home');
  });
});
```

- [ ] **Step 2: Implement gesture API**

```typescript
// src/interact/gestures.ts
import type { DeviceInfo, ComponentNode } from '../types.js';
import type { InteractionBackend, InteractionResult, SwipeDirection, Point } from './types.js';
import { resolveTarget } from './resolver.js';

const DEFAULT_SWIPE_DURATION = 300;
const DEFAULT_LONG_PRESS_DURATION = 1000;

export class GestureExecutor {
  constructor(private backend: InteractionBackend) {}

  async tap(device: DeviceInfo, tree: ComponentNode[], query: string): Promise<InteractionResult> {
    const start = Date.now();
    const target = resolveTarget(tree, query);
    if (!target) {
      return { success: false, action: 'tap', durationMs: Date.now() - start, error: `Target "${query}" not found in component tree` };
    }
    try {
      await this.backend.tap(device, target);
      return { success: true, action: 'tap', target, durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { success: false, action: 'tap', target, durationMs: Date.now() - start, error: (e as Error).message };
    }
  }

  async tapXY(device: DeviceInfo, x: number, y: number): Promise<InteractionResult> {
    const start = Date.now();
    const target = { x, y, resolvedFrom: 'coordinates' };
    try {
      await this.backend.tap(device, { x, y });
      return { success: true, action: 'tap', target, durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { success: false, action: 'tap', target, durationMs: Date.now() - start, error: (e as Error).message };
    }
  }

  async longPress(device: DeviceInfo, tree: ComponentNode[], query: string, durationMs = DEFAULT_LONG_PRESS_DURATION): Promise<InteractionResult> {
    const start = Date.now();
    const target = resolveTarget(tree, query);
    if (!target) {
      return { success: false, action: 'longPress', durationMs: Date.now() - start, error: `Target "${query}" not found in component tree` };
    }
    try {
      await this.backend.longPress(device, target, durationMs);
      return { success: true, action: 'longPress', target, durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { success: false, action: 'longPress', target, durationMs: Date.now() - start, error: (e as Error).message };
    }
  }

  async swipe(device: DeviceInfo, direction: SwipeDirection, distance = 600, durationMs = DEFAULT_SWIPE_DURATION): Promise<InteractionResult> {
    const start = Date.now();
    const centerX = device.screenSize ? Math.round(device.screenSize.width / device.screenSize.density / 2) : 540;
    const centerY = device.screenSize ? Math.round(device.screenSize.height / device.screenSize.density / 2) : 960;
    const offsets: Record<SwipeDirection, Point> = {
      up: { x: centerX, y: centerY - distance },
      down: { x: centerX, y: centerY + distance },
      left: { x: centerX - distance, y: centerY },
      right: { x: centerX + distance, y: centerY },
    };
    const from = { x: centerX, y: centerY };
    const to = offsets[direction];
    try {
      await this.backend.swipe(device, from, to, durationMs);
      return { success: true, action: `swipe-${direction}`, durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { success: false, action: `swipe-${direction}`, durationMs: Date.now() - start, error: (e as Error).message };
    }
  }

  async typeInto(device: DeviceInfo, tree: ComponentNode[], query: string, text: string): Promise<InteractionResult> {
    const start = Date.now();
    const target = resolveTarget(tree, query);
    if (!target) {
      return { success: false, action: 'type', durationMs: Date.now() - start, error: `Target "${query}" not found in component tree` };
    }
    try {
      await this.backend.tap(device, target);
      await this.backend.type(device, text);
      return { success: true, action: 'type', target, durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { success: false, action: 'type', target, durationMs: Date.now() - start, error: (e as Error).message };
    }
  }

  async goBack(device: DeviceInfo): Promise<InteractionResult> {
    const start = Date.now();
    try {
      const key = device.platform === 'android' ? 'KEYCODE_BACK' : 'home';
      await this.backend.keyEvent(device, key);
      return { success: true, action: 'goBack', durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { success: false, action: 'goBack', durationMs: Date.now() - start, error: (e as Error).message };
    }
  }

  async openUrl(device: DeviceInfo, url: string): Promise<InteractionResult> {
    const start = Date.now();
    try {
      await this.backend.openUrl(device, url);
      return { success: true, action: 'openUrl', durationMs: Date.now() - start };
    } catch (e: unknown) {
      return { success: false, action: 'openUrl', durationMs: Date.now() - start, error: (e as Error).message };
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/unit/interact/gestures.test.ts`
Expected: 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/interact/gestures.ts test/unit/interact/gestures.test.ts
git commit -m "feat: high-level gesture API for device interaction"
```

---

### Task 6: Backend Factory

**Files:**
- Create: `src/interact/backend.ts`

A simple factory that picks the right backend based on device platform.

- [ ] **Step 1: Implement factory**

```typescript
// src/interact/backend.ts
import type { Shell } from '../types.js';
import type { InteractionBackend } from './types.js';
import { AndroidBackend } from './android.js';
import { IosBackend } from './ios.js';

export function createBackend(shell: Shell, platform: 'android' | 'ios'): InteractionBackend {
  return platform === 'android' ? new AndroidBackend(shell) : new IosBackend(shell);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/interact/backend.ts
git commit -m "feat: interaction backend factory"
```

---

### Task 7: CLI Commands

**Files:**
- Modify: `src/cli.ts`

Add `drift tap`, `drift type`, `drift swipe`, `drift go-back`, `drift open-url` commands. Each command: discovers device, inspects tree (for tap/type), executes gesture, prints result as JSON.

- [ ] **Step 1: Add CLI commands**

Add after the `inspect` command in `src/cli.ts`:

```typescript
import { createBackend } from './interact/backend.js';
import { GestureExecutor } from './interact/gestures.js';

// drift tap <target>
program
  .command('tap <target>')
  .description('Tap a component by testID, name, or text')
  .option('-d, --device <id>', 'device ID or name')
  .option('--xy', 'treat target as x,y coordinates')
  .action(async function(this: Command, target: string, opts: Record<string, unknown>) {
    const shell = new RealShell();
    const config = await loadConfig();
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    const booted = devices.filter((d) => d.state === 'booted');
    if (booted.length === 0) throw new Error('No booted devices found');
    const device = opts.device
      ? booted.find((d) => d.id === opts.device || d.name === opts.device)
      : await pickDevice(booted);
    if (!device) throw new Error(`Device not found: ${opts.device}`);

    const backend = createBackend(shell, device.platform);
    const executor = new GestureExecutor(backend);

    let result;
    if (opts.xy) {
      const [x, y] = target.split(',').map(Number);
      result = await executor.tapXY(device, x, y);
    } else {
      const inspector = new TreeInspector(shell, process.cwd());
      const inspectResult = await inspector.inspect(device, {
        metroPort: config.metroPort, devToolsPort: config.devToolsPort,
        timeoutMs: config.timeouts.treeInspectionMs,
      });
      result = await executor.tap(device, inspectResult.tree, target);
    }
    console.log(JSON.stringify(result, null, 2));
  });

// drift type <target> <text>
program
  .command('type <target> <text>')
  .description('Tap a component and type text into it')
  .option('-d, --device <id>', 'device ID or name')
  .action(async function(this: Command, target: string, text: string, opts: Record<string, unknown>) {
    const shell = new RealShell();
    const config = await loadConfig();
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    const booted = devices.filter((d) => d.state === 'booted');
    if (booted.length === 0) throw new Error('No booted devices found');
    const device = opts.device
      ? booted.find((d) => d.id === opts.device || d.name === opts.device)
      : await pickDevice(booted);
    if (!device) throw new Error(`Device not found: ${opts.device}`);

    const backend = createBackend(shell, device.platform);
    const executor = new GestureExecutor(backend);
    const inspector = new TreeInspector(shell, process.cwd());
    const inspectResult = await inspector.inspect(device, {
      metroPort: config.metroPort, devToolsPort: config.devToolsPort,
      timeoutMs: config.timeouts.treeInspectionMs,
    });
    const result = await executor.typeInto(device, inspectResult.tree, target, text);
    console.log(JSON.stringify(result, null, 2));
  });

// drift swipe <direction>
program
  .command('swipe <direction>')
  .description('Swipe in a direction (up, down, left, right)')
  .option('-d, --device <id>', 'device ID or name')
  .action(async function(this: Command, direction: string, opts: Record<string, unknown>) {
    const shell = new RealShell();
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    const booted = devices.filter((d) => d.state === 'booted');
    if (booted.length === 0) throw new Error('No booted devices found');
    const device = opts.device
      ? booted.find((d) => d.id === opts.device || d.name === opts.device)
      : await pickDevice(booted);
    if (!device) throw new Error(`Device not found: ${opts.device}`);

    const backend = createBackend(shell, device.platform);
    const executor = new GestureExecutor(backend);
    const result = await executor.swipe(device, direction as 'up' | 'down' | 'left' | 'right');
    console.log(JSON.stringify(result, null, 2));
  });

// drift go-back
program
  .command('go-back')
  .description('Press the back button')
  .option('-d, --device <id>', 'device ID or name')
  .action(async function(this: Command, opts: Record<string, unknown>) {
    const shell = new RealShell();
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    const booted = devices.filter((d) => d.state === 'booted');
    if (booted.length === 0) throw new Error('No booted devices found');
    const device = opts.device
      ? booted.find((d) => d.id === opts.device || d.name === opts.device)
      : await pickDevice(booted);
    if (!device) throw new Error(`Device not found: ${opts.device}`);

    const backend = createBackend(shell, device.platform);
    const executor = new GestureExecutor(backend);
    const result = await executor.goBack(device);
    console.log(JSON.stringify(result, null, 2));
  });

// drift open-url <url>
program
  .command('open-url <url>')
  .description('Open a deep link URL on the device')
  .option('-d, --device <id>', 'device ID or name')
  .action(async function(this: Command, url: string, opts: Record<string, unknown>) {
    const shell = new RealShell();
    const discovery = new DeviceDiscovery(shell);
    const devices = await discovery.list();
    const booted = devices.filter((d) => d.state === 'booted');
    if (booted.length === 0) throw new Error('No booted devices found');
    const device = opts.device
      ? booted.find((d) => d.id === opts.device || d.name === opts.device)
      : await pickDevice(booted);
    if (!device) throw new Error(`Device not found: ${opts.device}`);

    const backend = createBackend(shell, device.platform);
    const executor = new GestureExecutor(backend);
    const result = await executor.openUrl(device, url);
    console.log(JSON.stringify(result, null, 2));
  });
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/cli.ts
git commit -m "feat: CLI commands for device interaction (tap, type, swipe, go-back, open-url)"
```

---

### Task 8: Update Drift Plugin Skill

**Files:**
- Modify: `drift-plugin/skills/drift.md`

Add interaction commands to the skill file so Claude Code knows how to use them.

- [ ] **Step 1: Add interaction section**

Append to `drift-plugin/skills/drift.md` before the "## Configuration" section:

```markdown
## Device Interaction

drift can interact with the running app — tap buttons, type text, swipe, navigate.

### `drift tap <target>` — Tap a component

```bash
# Tap by testID
npx drift tap login-btn

# Tap by component name
npx drift tap LoginButton

# Tap by text content
npx drift tap "Submit"

# Tap by raw coordinates
npx drift tap 150,300 --xy

# Tap on specific device
npx drift tap login-btn --device "iPhone 16 Pro"
```

Returns JSON: `{ success: true, action: "tap", target: { x: 150, y: 122, resolvedFrom: "testID:login-btn" }, durationMs: 45 }`

### `drift type <target> <text>` — Type text into a field

```bash
npx drift type email-input "user@example.com"
npx drift type search-field "react native"
```

Taps the target first to focus it, then types the text.

### `drift swipe <direction>` — Swipe gesture

```bash
npx drift swipe up      # Scroll down
npx drift swipe down    # Scroll up
npx drift swipe left    # Next page
npx drift swipe right   # Previous page
```

### `drift go-back` — Press back button

```bash
npx drift go-back
```

Android: sends KEYCODE_BACK. iOS: sends home key.

### `drift open-url <url>` — Open a deep link

```bash
npx drift open-url "myapp://profile/123"
npx drift open-url "https://example.com/login"
```

### Interaction Workflow Pattern

The typical AI agent workflow:
1. Write/modify code
2. Hot reload (Metro auto-reloads)
3. `npx drift tap "Login"` — navigate to the screen
4. `npx drift compare --design mockup.png --format json` — verify it looks right
5. If issues found, fix code and repeat

For form testing:
1. `npx drift tap email-input`
2. `npx drift type email-input "test@example.com"`
3. `npx drift type password-input "password123"`
4. `npx drift tap "Submit"`
5. `npx drift compare --baseline --format json` — verify the result screen
```

- [ ] **Step 2: Commit**

```bash
git add drift-plugin/skills/drift.md
git commit -m "docs: add interaction commands to drift Claude Code skill"
```

---

### Task 9: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (previous 254 + new resolver/android/ios/gestures tests)

- [ ] **Step 2: Verify no regressions**

Check total test count is >= 280.
