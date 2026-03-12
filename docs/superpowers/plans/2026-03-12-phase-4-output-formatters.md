# Phase 4: Output Formatters + Clipboard — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unified output formatting across all drift commands with three formats (terminal, markdown, JSON) and clipboard integration, completing v1.

**Architecture:** An `OutputFormatter<T>` interface with per-command implementations (compare, inspect, devices, doctor). Commands return data; the CLI layer picks the formatter via `--format` and `--copy` flags. `picocolors` for terminal colors. Shell-based clipboard (no npm dependency).

**Tech Stack:** TypeScript, picocolors, vitest, Commander.js

**Spec:** `docs/superpowers/specs/2026-03-12-phase-4-output-formatters.md`

---

## File Structure

```
src/formatters/
  types.ts              # OutputFormat, FormatterContext, OutputFormatter, CompareFormatData
  format.ts             # formatOutput() — picks format + handles copy
  clipboard.ts          # copyToClipboard(text: string)
  compare.ts            # CompareFormatter
  inspect.ts            # InspectFormatter
  devices.ts            # DevicesFormatter
  doctor.ts             # DoctorFormatter

test/unit/formatters/
  compare.test.ts
  inspect.test.ts
  devices.test.ts
  doctor.test.ts
  clipboard.test.ts
  format.test.ts
```

**Modified files:**
- `src/cli.ts` — add global `--format`/`--copy` flags, rewire all command handlers
- `src/commands/compare.ts` — return `CompareFormatData` instead of formatting inline; remove `formatCompareOutput`
- `src/commands/doctor.ts` — remove `formatPrerequisiteTable`, export only exit code logic
- `package.json` — add `picocolors` dependency

**Deleted exports (moved to formatters):**
- `formatCompareOutput` from `src/commands/compare.ts`
- `formatPrerequisiteTable` from `src/commands/doctor.ts`
- `formatDeviceTable` from `src/commands/devices.ts`
- `formatTree`, `formatCapabilities`, `formatStrategy`, `formatHints` from `src/commands/inspect.ts`

---

## Chunk 1: Foundation

### Task 1: Install picocolors + create formatter types

**Files:**
- Modify: `package.json`
- Create: `src/formatters/types.ts`
- Test: `test/unit/formatters/format.test.ts` (placeholder for later)

- [ ] **Step 1: Install picocolors**

```bash
npm install picocolors
```

- [ ] **Step 2: Create formatter types**

Create `src/formatters/types.ts`:

```typescript
import type { DiffResult, DeviceInfo, PrerequisiteCheck, ComponentNode } from '../types.js';
import type { InspectResult } from '../inspect/tree-inspector.js';

export type OutputFormat = 'terminal' | 'markdown' | 'json';

export interface FormatterContext {
  format: OutputFormat;
  copy: boolean;
  quiet: boolean;
}

export interface OutputFormatter<T> {
  terminal(data: T): string;
  markdown(data: T): string;
  json(data: T): string;
}

export interface CompareFormatData {
  result: DiffResult;
  device?: { name: string; platform: 'android' | 'ios' };
  artifactDir: string;
  tree?: ComponentNode[];
  inspectHints?: string[];
}
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/formatters/types.ts
git commit -m "feat: add picocolors and formatter type definitions"
```

---

### Task 2: Clipboard utility

**Files:**
- Create: `src/formatters/clipboard.ts`
- Create: `test/unit/formatters/clipboard.test.ts`

- [ ] **Step 1: Write tests**

Create `test/unit/formatters/clipboard.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getClipboardCommand } from '../../src/formatters/clipboard.js';

describe('getClipboardCommand', () => {
  it('returns pbcopy on darwin', () => {
    expect(getClipboardCommand('darwin')).toBe('pbcopy');
  });

  it('returns clip on win32', () => {
    expect(getClipboardCommand('win32')).toBe('clip');
  });

  it('returns xclip on linux', () => {
    expect(getClipboardCommand('linux')).toBe('xclip -selection clipboard');
  });

  it('returns undefined on unsupported platform', () => {
    expect(getClipboardCommand('freebsd')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/unit/formatters/clipboard.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement clipboard**

Create `src/formatters/clipboard.ts`:

```typescript
import { exec } from 'node:child_process';
import { getLogger } from '../logger.js';

export function getClipboardCommand(platform: string): string | undefined {
  if (platform === 'darwin') return 'pbcopy';
  if (platform === 'win32') return 'clip';
  if (platform === 'linux') return 'xclip -selection clipboard';
  return undefined;
}

export async function copyToClipboard(text: string): Promise<void> {
  const logger = getLogger();
  const cmd = getClipboardCommand(process.platform);

  if (!cmd) {
    logger.debug(`Clipboard not supported on ${process.platform}`);
    return;
  }

  return new Promise((resolve) => {
    const proc = exec(cmd, (err) => {
      if (err) {
        logger.debug(`Clipboard copy failed: ${err.message}`);
      }
      resolve();
    });
    proc.stdin?.write(text);
    proc.stdin?.end();
  });
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/formatters/clipboard.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/formatters/clipboard.ts test/unit/formatters/clipboard.test.ts
git commit -m "feat: clipboard utility with platform detection"
```

---

### Task 3: formatOutput orchestrator

**Files:**
- Create: `src/formatters/format.ts`
- Create: `test/unit/formatters/format.test.ts`

- [ ] **Step 1: Write tests**

Create `test/unit/formatters/format.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { formatOutput } from '../../../src/formatters/format.js';
import type { OutputFormatter, FormatterContext } from '../../../src/formatters/types.js';

const mockFormatter: OutputFormatter<string> = {
  terminal: (data) => `TERM:${data}`,
  markdown: (data) => `MD:${data}`,
  json: (data) => `JSON:${data}`,
};

describe('formatOutput', () => {
  it('uses terminal format by default', async () => {
    const ctx: FormatterContext = { format: 'terminal', copy: false, quiet: false };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await formatOutput(mockFormatter, 'test', ctx);
    expect(consoleSpy).toHaveBeenCalledWith('TERM:test');
    consoleSpy.mockRestore();
  });

  it('uses markdown format when specified', async () => {
    const ctx: FormatterContext = { format: 'markdown', copy: false, quiet: false };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await formatOutput(mockFormatter, 'test', ctx);
    expect(consoleSpy).toHaveBeenCalledWith('MD:test');
    consoleSpy.mockRestore();
  });

  it('uses json format when specified', async () => {
    const ctx: FormatterContext = { format: 'json', copy: false, quiet: false };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await formatOutput(mockFormatter, 'test', ctx);
    expect(consoleSpy).toHaveBeenCalledWith('JSON:test');
    consoleSpy.mockRestore();
  });

  it('suppresses stdout when quiet', async () => {
    const ctx: FormatterContext = { format: 'terminal', copy: false, quiet: true };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await formatOutput(mockFormatter, 'test', ctx);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns formatted string', async () => {
    const ctx: FormatterContext = { format: 'markdown', copy: false, quiet: true };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await formatOutput(mockFormatter, 'test', ctx);
    expect(result).toBe('MD:test');
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/unit/formatters/format.test.ts
```

- [ ] **Step 3: Implement formatOutput**

Create `src/formatters/format.ts`:

```typescript
import type { OutputFormatter, FormatterContext } from './types.js';
import { copyToClipboard } from './clipboard.js';

export async function formatOutput<T>(
  formatter: OutputFormatter<T>,
  data: T,
  ctx: FormatterContext,
): Promise<string> {
  const output = formatter[ctx.format](data);

  if (!ctx.quiet) {
    console.log(output);
  }

  if (ctx.copy) {
    const clipboardContent = ctx.format === 'terminal'
      ? formatter.markdown(data)
      : output;
    await copyToClipboard(clipboardContent);
  }

  return output;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/formatters/format.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/formatters/format.ts test/unit/formatters/format.test.ts
git commit -m "feat: formatOutput orchestrator with copy support"
```

---

## Chunk 2: Formatters

### Task 4: Devices formatter

**Files:**
- Create: `src/formatters/devices.ts`
- Create: `test/unit/formatters/devices.test.ts`
- Modify: `src/commands/devices.ts` (remove old `formatDeviceTable` later in Task 8)

- [ ] **Step 1: Write tests**

Create `test/unit/formatters/devices.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { devicesFormatter } from '../../../src/formatters/devices.js';
import type { DeviceInfo } from '../../../src/types.js';

const devices: DeviceInfo[] = [
  { id: 'emulator-5554', name: 'Pixel_8', platform: 'android', osVersion: '34', state: 'booted' },
  { id: 'ABC-DEF-123', name: 'iPhone 16 Pro', platform: 'ios', osVersion: '18.0', state: 'booted' },
];

describe('devicesFormatter', () => {
  describe('terminal', () => {
    it('renders device table with state indicators', () => {
      const output = devicesFormatter.terminal(devices);
      expect(output).toContain('Pixel_8');
      expect(output).toContain('iPhone 16 Pro');
      expect(output).toContain('booted');
    });

    it('shows message for empty list', () => {
      const output = devicesFormatter.terminal([]);
      expect(output).toContain('No devices found');
    });
  });

  describe('markdown', () => {
    it('renders markdown table', () => {
      const output = devicesFormatter.markdown(devices);
      expect(output).toContain('# Drift Devices');
      expect(output).toContain('| emulator-5554');
      expect(output).toContain('| ABC-DEF-123');
    });

    it('shows message for empty list', () => {
      const output = devicesFormatter.markdown([]);
      expect(output).toContain('No devices found');
    });
  });

  describe('json', () => {
    it('outputs valid JSON array', () => {
      const output = devicesFormatter.json(devices);
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('emulator-5554');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/unit/formatters/devices.test.ts
```

- [ ] **Step 3: Implement devices formatter**

Create `src/formatters/devices.ts`:

```typescript
import pc from 'picocolors';
import type { DeviceInfo } from '../types.js';
import type { OutputFormatter } from './types.js';

function stateLabel(state: DeviceInfo['state']): string {
  if (state === 'booted') return pc.green('● booted');
  if (state === 'offline') return pc.yellow('○ offline');
  return pc.red('✗ unauthorized');
}

function stateText(state: DeviceInfo['state']): string {
  if (state === 'booted') return 'booted';
  if (state === 'offline') return 'offline';
  return 'unauthorized';
}

export const devicesFormatter: OutputFormatter<DeviceInfo[]> = {
  terminal(devices) {
    if (devices.length === 0) {
      return 'No devices found. Start an emulator or connect a device.';
    }
    const lines: string[] = [];
    const header = `  ${'ID'.padEnd(20)} ${'Name'.padEnd(20)} ${'Platform'.padEnd(10)} ${'OS'.padEnd(10)} ${'State'}`;
    lines.push('');
    lines.push(header);
    lines.push('  ' + '-'.repeat(70));
    for (const d of devices) {
      lines.push(`  ${d.id.padEnd(20)} ${d.name.padEnd(20)} ${d.platform.padEnd(10)} ${(d.osVersion || '-').padEnd(10)} ${stateLabel(d.state)}`);
    }
    lines.push('');
    return lines.join('\n');
  },

  markdown(devices) {
    if (devices.length === 0) {
      return '# Drift Devices\n\nNo devices found. Start an emulator or connect a device.';
    }
    const lines: string[] = ['# Drift Devices', '', '| ID | Name | Platform | OS | State |', '|----|------|----------|-----|-------|'];
    for (const d of devices) {
      lines.push(`| ${d.id} | ${d.name} | ${d.platform} | ${d.osVersion || '-'} | ${stateText(d.state)} |`);
    }
    return lines.join('\n');
  },

  json(devices) {
    return JSON.stringify(devices, null, 2);
  },
};
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/formatters/devices.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/formatters/devices.ts test/unit/formatters/devices.test.ts
git commit -m "feat: devices formatter with terminal, markdown, json output"
```

---

### Task 5: Doctor formatter

**Files:**
- Create: `src/formatters/doctor.ts`
- Create: `test/unit/formatters/doctor.test.ts`

- [ ] **Step 1: Write tests**

Create `test/unit/formatters/doctor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { doctorFormatter } from '../../../src/formatters/doctor.js';
import type { PrerequisiteCheck } from '../../../src/types.js';

const checks: PrerequisiteCheck[] = [
  { name: 'node', required: true, available: true, version: '20.11.0' },
  { name: 'adb', required: false, available: true, version: '34.0.5' },
  { name: 'metro', required: false, available: false, fix: 'npx react-native start' },
];

describe('doctorFormatter', () => {
  describe('terminal', () => {
    it('shows pass/fail icons with colors', () => {
      const output = doctorFormatter.terminal(checks);
      expect(output).toContain('node');
      expect(output).toContain('20.11.0');
      expect(output).toContain('metro');
      expect(output).toContain('missing');
    });

    it('includes fix instructions for missing tools', () => {
      const output = doctorFormatter.terminal(checks);
      expect(output).toContain('npx react-native start');
    });
  });

  describe('markdown', () => {
    it('renders markdown table with fix column', () => {
      const output = doctorFormatter.markdown(checks);
      expect(output).toContain('# Drift Doctor');
      expect(output).toContain('| node');
      expect(output).toContain('available');
      expect(output).toContain('unavailable');
    });
  });

  describe('json', () => {
    it('outputs valid JSON array', () => {
      const output = doctorFormatter.json(checks);
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(3);
      expect(parsed[2].available).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/unit/formatters/doctor.test.ts
```

- [ ] **Step 3: Implement doctor formatter**

Create `src/formatters/doctor.ts`:

```typescript
import pc from 'picocolors';
import type { PrerequisiteCheck } from '../types.js';
import type { OutputFormatter } from './types.js';

export const doctorFormatter: OutputFormatter<PrerequisiteCheck[]> = {
  terminal(checks) {
    const lines: string[] = [];
    lines.push('Prerequisite Check');
    lines.push('─'.repeat(60));
    for (const check of checks) {
      const icon = check.available ? pc.green('+') : pc.red('-');
      const status = check.available ? 'ok' : pc.red('missing');
      const version = check.version ?? '';
      const required = check.required ? 'required' : 'optional';
      lines.push(`  [${icon}] ${check.name.padEnd(12)} ${String(status).padEnd(10)} ${version.padEnd(16)} (${required})`);
      if (!check.available && check.fix) {
        lines.push(`      Fix: ${check.fix}`);
      }
    }
    lines.push('─'.repeat(60));
    return lines.join('\n');
  },

  markdown(checks) {
    const lines: string[] = ['# Drift Doctor', '', '| Tool | Status | Version | Required | Fix |', '|------|--------|---------|----------|-----|'];
    for (const check of checks) {
      const status = check.available ? 'available' : 'unavailable';
      const version = check.version || '—';
      const required = check.required ? 'yes' : 'no';
      const fix = check.fix || '—';
      lines.push(`| ${check.name} | ${status} | ${version} | ${required} | ${fix} |`);
    }
    return lines.join('\n');
  },

  json(checks) {
    return JSON.stringify(checks, null, 2);
  },
};
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/formatters/doctor.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/formatters/doctor.ts test/unit/formatters/doctor.test.ts
git commit -m "feat: doctor formatter with terminal, markdown, json output"
```

---

### Task 6: Inspect formatter

**Files:**
- Create: `src/formatters/inspect.ts`
- Create: `test/unit/formatters/inspect.test.ts`

The inspect formatter replaces `formatTree`, `formatCapabilities`, `formatStrategy`, `formatHints` from `src/commands/inspect.ts`. It handles three modes: full tree, capabilities-only, and the full output.

- [ ] **Step 1: Write tests**

Create `test/unit/formatters/inspect.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { inspectFormatter } from '../../../src/formatters/inspect.js';
import type { InspectResult } from '../../../src/inspect/tree-inspector.js';

const result: InspectResult = {
  tree: [
    {
      id: 'n1', name: 'View', bounds: { x: 0, y: 0, width: 100, height: 50 },
      children: [
        {
          id: 'n2', name: 'Text', reactName: 'MyText', text: 'Hello', testID: 'greeting',
          bounds: { x: 10, y: 10, width: 80, height: 20 },
          children: [], inspectionTier: 'detailed',
        },
      ],
      inspectionTier: 'basic',
    },
  ],
  capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'uiautomator' },
  strategy: { method: 'uiautomator', reason: 'Android native inspection' },
  device: { name: 'Pixel_8', platform: 'android' },
  hints: [],
};

const emptyResult: InspectResult = {
  tree: [],
  capabilities: { tree: 'none', sourceMapping: 'none', styles: 'none', protocol: 'none' },
  strategy: { method: 'none', reason: 'No inspection method available' },
  device: { name: 'iPhone 16 Pro', platform: 'ios' },
  hints: ['Install idb for native iOS tree inspection: brew install idb-companion && pip install fb-idb'],
};

describe('inspectFormatter', () => {
  describe('terminal', () => {
    it('renders tree with strategy header', () => {
      const output = inspectFormatter.terminal(result);
      expect(output).toContain('Pixel_8');
      expect(output).toContain('UIAutomator');
      expect(output).toContain('View');
      expect(output).toContain('MyText');
      expect(output).toContain('[greeting]');
    });

    it('shows empty tree message and hints', () => {
      const output = inspectFormatter.terminal(emptyResult);
      expect(output).toContain('No component tree available');
      expect(output).toContain('idb');
    });
  });

  describe('markdown', () => {
    it('renders full markdown report', () => {
      const output = inspectFormatter.markdown(result);
      expect(output).toContain('# Drift Inspect Report');
      expect(output).toContain('Pixel_8');
      expect(output).toContain('## Component Tree');
      expect(output).toContain('## Capabilities');
    });

    it('includes hints section when present', () => {
      const output = inspectFormatter.markdown(emptyResult);
      expect(output).toContain('## Hints');
      expect(output).toContain('idb');
    });
  });

  describe('json', () => {
    it('outputs tree, capabilities, strategy, device, hints', () => {
      const output = inspectFormatter.json(result);
      const parsed = JSON.parse(output);
      expect(parsed.tree).toHaveLength(1);
      expect(parsed.capabilities.protocol).toBe('uiautomator');
      expect(parsed.strategy.method).toBe('uiautomator');
      expect(parsed.device.name).toBe('Pixel_8');
      expect(parsed.hints).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/unit/formatters/inspect.test.ts
```

- [ ] **Step 3: Implement inspect formatter**

Create `src/formatters/inspect.ts`:

```typescript
import pc from 'picocolors';
import type { ComponentNode, InspectionCapabilities } from '../types.js';
import type { InspectResult } from '../inspect/tree-inspector.js';
import type { OutputFormatter } from './types.js';

const STRATEGY_LABELS: Record<string, string> = {
  cdp: 'CDP via Metro (React DevTools)',
  uiautomator: 'UIAutomator (native Android)',
  idb: 'idb (native iOS)',
  none: 'None',
};

function formatTreeText(nodes: ComponentNode[], indent: number = 0): string {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = '  '.repeat(indent);
    const name = node.reactName ?? node.name;
    const testId = node.testID ? ` [${node.testID}]` : '';
    const text = node.text ? ` "${node.text}"` : '';
    const tier = node.inspectionTier === 'detailed' ? ' ⚛' : '';
    const b = node.bounds;
    const bounds = b.width > 0 ? ` (${b.x},${b.y} ${b.width}x${b.height})` : '';
    lines.push(`${prefix}${name}${testId}${text}${bounds}${tier}`);
    const childStr = formatTreeText(node.children, indent + 1);
    if (childStr) lines.push(childStr);
  }
  return lines.join('\n');
}

function formatStrategySection(result: InspectResult, colored: boolean): string {
  const lines: string[] = [];
  const label = STRATEGY_LABELS[result.strategy.method] ?? result.strategy.method;
  const strategyText = colored
    ? (result.strategy.method === 'none' ? pc.dim(label) : pc.cyan(label))
    : label;
  lines.push('');
  lines.push(`  Device:    ${result.device.name} (${result.device.platform})`);
  lines.push(`  Strategy:  ${strategyText}`);
  if (result.strategy.appId) {
    lines.push(`  App:       ${result.strategy.appId}`);
  }
  lines.push('');
  return lines.join('\n');
}

function formatCapsSection(caps: InspectionCapabilities): string {
  const lines: string[] = [];
  lines.push('  Capabilities');
  lines.push('  ' + '-'.repeat(40));
  lines.push(`  Tree:           ${caps.tree}`);
  lines.push(`  Source mapping:  ${caps.sourceMapping}`);
  lines.push(`  Styles:         ${caps.styles}`);
  lines.push(`  Protocol:       ${caps.protocol}`);
  lines.push('');
  return lines.join('\n');
}

function formatHintsSection(hints: string[], colored: boolean): string {
  if (hints.length === 0) return '';
  const lines = ['', '  Hints', '  ' + '-'.repeat(40)];
  for (const hint of hints) {
    lines.push(colored ? `  ${pc.yellow(hint)}` : `  ${hint}`);
  }
  lines.push('');
  return lines.join('\n');
}

export const inspectFormatter: OutputFormatter<InspectResult> = {
  terminal(result) {
    const parts: string[] = [formatStrategySection(result, true)];

    if (result.tree.length === 0) {
      parts.push('  No component tree available. Try running with React DevTools enabled.');
      parts.push(formatHintsSection(result.hints, true));
      return parts.filter(Boolean).join('\n');
    }

    parts.push(formatTreeText(result.tree));
    parts.push('');
    parts.push(formatCapsSection(result.capabilities));
    parts.push(formatHintsSection(result.hints, true));
    return parts.filter(Boolean).join('\n');
  },

  markdown(result) {
    const lines: string[] = [
      '# Drift Inspect Report',
      '',
      `**Device:** ${result.device.name} (${result.device.platform})`,
      `**Strategy:** ${STRATEGY_LABELS[result.strategy.method] ?? result.strategy.method}`,
    ];
    if (result.strategy.appId) {
      lines.push(`**App:** ${result.strategy.appId}`);
    }

    if (result.tree.length > 0) {
      lines.push('', '## Component Tree', '', '```', formatTreeText(result.tree), '```');
    } else {
      lines.push('', 'No component tree available.');
    }

    lines.push('', '## Capabilities', '', '| Capability | Level |', '|------------|-------|');
    lines.push(`| Tree | ${result.capabilities.tree} |`);
    lines.push(`| Source mapping | ${result.capabilities.sourceMapping} |`);
    lines.push(`| Styles | ${result.capabilities.styles} |`);
    lines.push(`| Protocol | ${result.capabilities.protocol} |`);

    if (result.hints.length > 0) {
      lines.push('', '## Hints', '');
      for (const hint of result.hints) {
        lines.push(`- ${hint}`);
      }
    }

    return lines.join('\n');
  },

  json(result) {
    return JSON.stringify({
      tree: result.tree,
      capabilities: result.capabilities,
      strategy: result.strategy,
      device: result.device,
      hints: result.hints,
    }, null, 2);
  },
};
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/formatters/inspect.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/formatters/inspect.ts test/unit/formatters/inspect.test.ts
git commit -m "feat: inspect formatter with terminal, markdown, json output"
```

---

### Task 7: Compare formatter

**Files:**
- Create: `src/formatters/compare.ts`
- Create: `test/unit/formatters/compare.test.ts`

This is the most complex formatter. It renders findings (not just regions), with severity colors, confidence labels, and component context.

- [ ] **Step 1: Write tests**

Create `test/unit/formatters/compare.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { compareFormatter } from '../../../src/formatters/compare.js';
import type { CompareFormatData } from '../../../src/formatters/types.js';
import type { DiffResult } from '../../../src/types.js';

const baseDiffResult: DiffResult = {
  runId: 'abc123',
  metadata: {
    runId: 'abc123',
    startedAt: '2026-03-12T00:00:00Z',
    completedAt: '2026-03-12T00:00:01Z',
    projectRoot: '/test',
    deviceId: 'emulator-5554',
    platform: 'android',
    framework: 'react-native',
    orientation: 'portrait',
    driftVersion: '0.1.0',
    configHash: '',
  },
  totalPixels: 100000,
  diffPixels: 2340,
  diffPercentage: 2.34,
  regions: [
    { id: 'r-0', bounds: { x: 120, y: 340, width: 200, height: 44 }, pixelCount: 1500, percentage: 1.5 },
    { id: 'r-1', bounds: { x: 0, y: 0, width: 393, height: 48 }, pixelCount: 840, percentage: 0.84 },
  ],
  findings: [
    {
      id: 'diff-0', category: 'unknown', severity: 'major', confidence: 0.72,
      region: { x: 120, y: 340, width: 200, height: 44 },
      component: { name: 'SubmitButton', testID: 'submit-btn', bounds: { x: 100, y: 330, width: 240, height: 64 }, depth: 5 },
      evidence: [
        { type: 'pixel', score: 0.85, note: '14.2% pixel difference in region' },
        { type: 'tree', score: 0.72, note: 'Matched to SubmitButton via bounds overlap (68%)' },
      ],
    },
    {
      id: 'diff-1', category: 'unknown', severity: 'minor', confidence: 0.3,
      region: { x: 0, y: 0, width: 393, height: 48 },
      evidence: [{ type: 'pixel', score: 0.3, note: '0.84% pixel difference' }],
    },
  ],
  capabilities: {
    inspection: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'uiautomator' },
    scrollCapture: { supported: false, reason: 'Not implemented', mode: 'none' },
    sourceMapping: false,
    prerequisites: [],
  },
  durationMs: 412,
};

const formatData: CompareFormatData = {
  result: baseDiffResult,
  device: { name: 'Pixel_8', platform: 'android' },
  artifactDir: '.drift/runs/abc123',
};

const emptyData: CompareFormatData = {
  result: { ...baseDiffResult, diffPixels: 0, diffPercentage: 0, regions: [], findings: [] },
  device: { name: 'Pixel_8', platform: 'android' },
  artifactDir: '.drift/runs/abc123',
};

describe('compareFormatter', () => {
  describe('terminal', () => {
    it('renders diff summary and findings', () => {
      const output = compareFormatter.terminal(formatData);
      expect(output).toContain('2.34%');
      expect(output).toContain('412ms');
      expect(output).toContain('MAJOR');
      expect(output).toContain('SubmitButton');
      expect(output).toContain('submit-btn');
      expect(output).toContain('MINOR');
    });

    it('shows summary line with severity counts', () => {
      const output = compareFormatter.terminal(formatData);
      expect(output).toContain('1 major');
      expect(output).toContain('1 minor');
    });

    it('shows confidence labels', () => {
      const output = compareFormatter.terminal(formatData);
      expect(output).toContain('probable');
      expect(output).toContain('approximate');
    });

    it('shows no-diff message when empty', () => {
      const output = compareFormatter.terminal(emptyData);
      expect(output).toContain('No differences found');
    });

    it('shows run ID', () => {
      const output = compareFormatter.terminal(formatData);
      expect(output).toContain('abc123');
    });
  });

  describe('markdown', () => {
    it('renders full report', () => {
      const output = compareFormatter.markdown(formatData);
      expect(output).toContain('# Drift Compare Report');
      expect(output).toContain('Pixel_8');
      expect(output).toContain('## Findings');
      expect(output).toContain('SubmitButton');
      expect(output).toContain('.drift/runs/abc123/diff-mask.png');
    });

    it('includes artifact paths', () => {
      const output = compareFormatter.markdown(formatData);
      expect(output).toContain('.drift/runs/abc123/screenshot.png');
      expect(output).toContain('.drift/runs/abc123/regions/r-0.png');
    });

    it('includes git info when available', () => {
      const data: CompareFormatData = {
        ...formatData,
        result: {
          ...baseDiffResult,
          metadata: { ...baseDiffResult.metadata, gitCommit: 'abc1234', gitBranch: 'main' },
        },
      };
      const output = compareFormatter.markdown(data);
      expect(output).toContain('abc1234');
      expect(output).toContain('main');
    });

    it('handles no-diff case', () => {
      const output = compareFormatter.markdown(emptyData);
      expect(output).toContain('No differences found');
      expect(output).not.toContain('## Findings');
    });
  });

  describe('json', () => {
    it('outputs full format data as JSON', () => {
      const output = compareFormatter.json(formatData);
      const parsed = JSON.parse(output);
      expect(parsed.result.runId).toBe('abc123');
      expect(parsed.device.name).toBe('Pixel_8');
      expect(parsed.artifactDir).toBe('.drift/runs/abc123');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/unit/formatters/compare.test.ts
```

- [ ] **Step 3: Implement compare formatter**

Create `src/formatters/compare.ts`:

```typescript
import pc from 'picocolors';
import type { DiffFinding } from '../types.js';
import type { OutputFormatter, CompareFormatData } from './types.js';

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'probable';
  return 'approximate';
}

function severityColor(severity: DiffFinding['severity'], text: string): string {
  if (severity === 'critical') return pc.red(pc.bold(text));
  if (severity === 'major') return pc.yellow(text);
  if (severity === 'minor') return pc.cyan(text);
  return pc.dim(text);
}

function severityCounts(findings: DiffFinding[]): string {
  const counts: Record<string, number> = {};
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }
  const parts: string[] = [];
  for (const sev of ['critical', 'major', 'minor', 'info'] as const) {
    if (counts[sev]) parts.push(`${counts[sev]} ${sev}`);
  }
  return parts.join(', ');
}

export const compareFormatter: OutputFormatter<CompareFormatData> = {
  terminal(data) {
    const { result } = data;
    const lines: string[] = [];
    lines.push('');
    lines.push(`  Diff: ${result.diffPercentage.toFixed(2)}% (${result.diffPixels.toLocaleString()}/${result.totalPixels.toLocaleString()} pixels)`);
    if (result.regions.length > 0) lines.push(`  Regions: ${result.regions.length}`);
    lines.push(`  Duration: ${result.durationMs}ms`);

    if (result.findings.length === 0) {
      lines.push('');
      lines.push(pc.green('  No differences found.'));
      lines.push('');
      lines.push(`  Run: ${result.runId}`);
      lines.push('');
      return lines.join('\n');
    }

    lines.push('');
    lines.push('  Findings');
    lines.push('  ' + '─'.repeat(70));

    for (const f of result.findings) {
      const tag = severityColor(f.severity, `[${f.severity.toUpperCase()}]`);
      const comp = f.component
        ? `${f.component.name}${f.component.testID ? ` [${f.component.testID}]` : ''}`
        : pc.dim('(unmatched)');
      const region = `(${f.region.x},${f.region.y} ${f.region.width}x${f.region.height})`;
      const conf = `(${confidenceLabel(f.confidence)})`;
      lines.push(`  ${tag}  ${f.id}  ${comp}  ${region}  ${conf}`);
    }

    lines.push('');
    lines.push(`  Summary: Found ${result.findings.length} differences (${severityCounts(result.findings)})`);
    const insp = result.capabilities.inspection;
    lines.push(`  Inspection: ${insp.tree} (${insp.protocol}) | Source mapping: ${insp.sourceMapping}`);
    lines.push('');
    lines.push(`  Run: ${result.runId}`);
    lines.push('');
    return lines.join('\n');
  },

  markdown(data) {
    const { result, device, artifactDir } = data;
    const lines: string[] = ['# Drift Compare Report', ''];

    if (device) lines.push(`**Device:** ${device.name} (${device.platform})`);
    const meta = result.metadata;
    if (meta.gitCommit || meta.gitBranch) {
      const git = [meta.gitCommit, meta.gitBranch].filter(Boolean).join(' on ');
      lines.push(`**Git:** ${git}`);
    }
    if (meta.framework && meta.framework !== 'unknown') lines.push(`**Framework:** ${meta.framework}`);
    lines.push(`**Diff:** ${result.diffPercentage.toFixed(2)}% (${result.diffPixels.toLocaleString()} / ${result.totalPixels.toLocaleString()} pixels)`);
    if (result.regions.length > 0) lines.push(`**Regions:** ${result.regions.length}`);
    lines.push(`**Duration:** ${result.durationMs}ms`);
    lines.push(`**Run ID:** ${result.runId}`);

    if (result.findings.length === 0) {
      lines.push('', 'No differences found.');
      return lines.join('\n');
    }

    lines.push('', '## Artifacts', '');
    lines.push(`- Screenshot: \`${artifactDir}/screenshot.png\``);
    lines.push(`- Design: \`${artifactDir}/design.png\``);
    lines.push(`- Diff mask: \`${artifactDir}/diff-mask.png\``);

    lines.push('', '## Findings');

    result.findings.forEach((f, i) => {
      const compName = f.component?.name ?? 'Unmatched region';
      lines.push('', `### ${i + 1}. [${f.severity.toUpperCase()}] ${compName} (${f.id})`, '');
      if (f.component) {
        lines.push(`- **Component:** ${f.component.name}`);
        if (f.component.testID) lines.push(`- **testID:** ${f.component.testID}`);
      }
      lines.push(`- **Category:** ${f.category}`);
      lines.push(`- **Region:** (${f.region.x}, ${f.region.y}) ${f.region.width}x${f.region.height}`);
      lines.push(`- **Confidence:** ${confidenceLabel(f.confidence)}`);
      if (f.evidence.length > 0) {
        lines.push('- **Evidence:**');
        for (const e of f.evidence) {
          lines.push(`  - ${e.type}: ${Math.round(e.score * 100)}% score — "${e.note}"`);
        }
      }
      const regionId = result.regions[i]?.id;
      if (regionId) lines.push(`- **Region crop:** \`${artifactDir}/regions/${regionId}.png\``);
    });

    const insp = result.capabilities.inspection;
    lines.push('', '## Capabilities', '', '| Capability | Level |', '|------------|-------|');
    lines.push(`| Tree | ${insp.tree} |`);
    lines.push(`| Source mapping | ${insp.sourceMapping} |`);
    lines.push(`| Styles | ${insp.styles} |`);
    lines.push(`| Protocol | ${insp.protocol} |`);

    if (data.tree && data.tree.length > 0) {
      lines.push('', '## Component Tree Context', '', '```');
      lines.push(formatTreePlain(data.tree));
      lines.push('```');
    }

    if (data.inspectHints && data.inspectHints.length > 0) {
      lines.push('', '## Hints', '');
      for (const hint of data.inspectHints) {
        lines.push(`- ${hint}`);
      }
    }

    return lines.join('\n');
  },

  json(data) {
    return JSON.stringify({
      result: data.result,
      device: data.device,
      artifactDir: data.artifactDir,
    }, null, 2);
  },
};

function formatTreePlain(nodes: import('../types.js').ComponentNode[], indent: number = 0): string {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = '  '.repeat(indent);
    const name = node.reactName ?? node.name;
    const testId = node.testID ? ` [${node.testID}]` : '';
    const text = node.text ? ` "${node.text}"` : '';
    const b = node.bounds;
    const bounds = b.width > 0 ? ` (${b.x},${b.y} ${b.width}x${b.height})` : '';
    lines.push(`${prefix}${name}${testId}${text}${bounds}`);
    const childStr = formatTreePlain(node.children, indent + 1);
    if (childStr) lines.push(childStr);
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/formatters/compare.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/formatters/compare.ts test/unit/formatters/compare.test.ts
git commit -m "feat: compare formatter with findings, severity colors, and markdown report"
```

---

## Chunk 3: CLI Wiring + Migration

### Task 8: Rewire CLI to use formatters

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/commands/compare.ts` — update `runCompare` to return `CompareFormatData`; remove `formatCompareOutput`
- Modify: `src/commands/doctor.ts` — remove `formatPrerequisiteTable`, export `computeExitCode`
- Delete exports: `formatDeviceTable` from `src/commands/devices.ts`, `formatTree`/`formatCapabilities`/`formatStrategy`/`formatHints` from `src/commands/inspect.ts`

This is the integration task. It rewires all four commands to use the new formatters.

- [ ] **Step 1: Update `src/commands/doctor.ts`**

Replace the entire file with:

```typescript
import type { PrerequisiteCheck } from '../types.js';
import { ExitCode } from '../exit-codes.js';

export function computeDoctorExitCode(checks: PrerequisiteCheck[]): number {
  return checks.some((c) => c.required && !c.available)
    ? ExitCode.PrerequisiteMissing
    : ExitCode.Success;
}
```

- [ ] **Step 2: Update `src/commands/compare.ts`**

Add `CompareFormatData` return alongside existing `DiffResult`. After the `runCompare` function, update to also return the format data. Remove `formatCompareOutput`.

At the end of `runCompare`, after building `diffResult`, add `formatData` to the return:

```typescript
// Add to the return value (after line 140):
const formatData: CompareFormatData = {
  result: diffResult,
  device: deviceInfo ? { name: deviceInfo.name, platform: deviceInfo.platform } : undefined,
  artifactDir: store.getRunPath(run.runId),
  tree: inspectResult?.tree,
  inspectHints: inspectResult?.hints,
};

return { result: diffResult, exitCode, formatData };
```

This requires capturing `inspectResult` in a variable visible to the return. Move the inspect result outside the `if` block.

Remove the `formatCompareOutput` function entirely.

- [ ] **Step 3: Update `src/commands/devices.ts`**

Remove the `formatDeviceTable` function (it's replaced by `devicesFormatter`). Keep the file if there's other logic, or delete if it only contained the formatter.

- [ ] **Step 4: Update `src/commands/inspect.ts`**

Remove `formatTree`, `formatCapabilities`, `formatStrategy`, `formatHints`. The file can be deleted entirely as all formatting logic moves to `src/formatters/inspect.ts`.

- [ ] **Step 5: Rewire `src/cli.ts`**

Replace all imports of old formatters with new ones. Add `--format` and `--copy` global options. Update all command handlers.

```typescript
import { Command } from 'commander';
import { createRequire } from 'module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RealShell } from './shell.js';
import { loadConfig } from './config.js';
import { createLogger, setLogger } from './logger.js';
import { checkPrerequisites } from './prerequisites.js';
import { computeDoctorExitCode } from './commands/doctor.js';
import { detectFramework, generateConfig } from './commands/init.js';
import { DeviceDiscovery } from './devices/discovery.js';
import { runCapture } from './commands/capture.js';
import { runCompare } from './commands/compare.js';
import { TreeInspector } from './inspect/tree-inspector.js';
import { pickDevice } from './commands/device-picker.js';
import { ExitCode } from './exit-codes.js';
import { formatOutput } from './formatters/format.js';
import { devicesFormatter } from './formatters/devices.js';
import { doctorFormatter } from './formatters/doctor.js';
import { inspectFormatter } from './formatters/inspect.js';
import { compareFormatter } from './formatters/compare.js';
import type { FormatterContext } from './formatters/types.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

function getFormatterContext(opts: Record<string, unknown>): FormatterContext {
  return {
    format: (opts.format as string as FormatterContext['format']) ?? 'terminal',
    copy: !!opts.copy,
    quiet: !!opts.quiet,
  };
}

export function createProgram(): Command {
  const program = new Command();
  program
    .name('drift')
    .description('Visual diff tool for React Native and Android development')
    .version(pkg.version)
    .option('--verbose', 'enable debug logging')
    .option('--quiet', 'suppress all output except errors')
    .option('--format <type>', 'output format: terminal, markdown, json', 'terminal')
    .option('--copy', 'copy output to clipboard');

  program.hook('preAction', (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    const level = opts.verbose ? 'debug' : opts.quiet ? 'silent' : 'info';
    setLogger(createLogger(level));
  });

  // doctor command
  program
    .command('doctor')
    .description('Check system prerequisites for drift')
    .action(async function(this: Command) {
      const shell = new RealShell();
      const config = await loadConfig();
      const checks = await checkPrerequisites(shell, config.metroPort);
      const ctx = getFormatterContext(this.optsWithGlobals());
      await formatOutput(doctorFormatter, checks, ctx);
      process.exitCode = computeDoctorExitCode(checks);
    });

  // init command (no formatter — trivial output)
  program
    .command('init')
    .description('Initialize drift configuration for this project')
    .action(async () => {
      const cwd = process.cwd();
      const files = readdirSync(cwd);
      let packageJson: Record<string, unknown> | undefined;
      try {
        packageJson = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'));
      } catch {}
      const framework = detectFramework(files, packageJson);
      const config = generateConfig(framework);
      const configPath = join(cwd, '.driftrc.json');
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      console.log(`Created ${configPath} (framework: ${framework})`);
    });

  // devices command
  program
    .command('devices')
    .description('List connected devices and simulators')
    .action(async function(this: Command) {
      const shell = new RealShell();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      const ctx = getFormatterContext(this.optsWithGlobals());
      await formatOutput(devicesFormatter, devices, ctx);
    });

  // capture command (no formatter — trivial output)
  program
    .command('capture')
    .description('Capture a screenshot from a device')
    .option('-d, --device <id>', 'device ID or name')
    .option('-o, --output <path>', 'output file path')
    .option('--settle', 'enable settle-time check')
    .option('--no-settle', 'disable settle-time check')
    .action(async (opts) => {
      const shell = new RealShell();
      const config = await loadConfig();
      const result = await runCapture(shell, config, {
        device: opts.device,
        output: opts.output,
        settleCheck: opts.settle,
      });
      console.log(`Screenshot saved: ${result.path}`);
      if (result.runId) {
        console.log(`Run ID: ${result.runId}`);
      }
    });

  // compare command
  program
    .command('compare')
    .description('Compare a screenshot against a design')
    .requiredOption('--design <path>', 'path to design image')
    .option('-d, --device <id>', 'device ID or name')
    .option('--threshold <n>', 'diff percentage threshold', parseFloat)
    .option('--screenshot <path>', 'use existing screenshot instead of capturing')
    .action(async function(this: Command, opts: Record<string, unknown>) {
      const shell = new RealShell();
      const config = await loadConfig();
      const { exitCode, formatData } = await runCompare(shell, config, {
        design: opts.design as string,
        device: opts.device as string | undefined,
        threshold: opts.threshold as number | undefined,
        screenshot: opts.screenshot as string | undefined,
      });
      const ctx = getFormatterContext(this.optsWithGlobals());
      await formatOutput(compareFormatter, formatData, ctx);
      process.exitCode = exitCode;
    });

  // inspect command
  program
    .command('inspect')
    .description('Inspect component tree on device')
    .option('-d, --device <id>', 'device ID or name')
    .option('--json', 'output as JSON (alias for --format json)')
    .option('--capabilities', 'show inspection capabilities only')
    .action(async function(this: Command, opts: Record<string, unknown>) {
      const shell = new RealShell();
      const config = await loadConfig();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      const booted = devices.filter((d) => d.state === 'booted');
      if (booted.length === 0) throw new Error('No booted devices found');

      let device;
      if (opts.device) {
        device = booted.find((d) => d.id === opts.device || d.name === opts.device);
        if (!device) throw new Error(`Device not found: ${opts.device}`);
      } else {
        device = await pickDevice(booted);
      }

      const inspector = new TreeInspector(shell, process.cwd());
      const result = await inspector.inspect(device, {
        metroPort: config.metroPort,
        devToolsPort: config.devToolsPort,
        timeoutMs: config.timeouts.treeInspectionMs,
      });

      const globalOpts = this.optsWithGlobals();
      if (opts.json) globalOpts.format = 'json';
      const ctx = getFormatterContext(globalOpts);
      await formatOutput(inspectFormatter, result, ctx);
    });

  return program;
}

export function run(argv: string[]): void {
  const program = createProgram();
  program.parseAsync(argv);
}
```

- [ ] **Step 6: Run type check**

```bash
npx tsc --noEmit
```

Fix any type errors that arise from the refactor.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Existing tests in `test/unit/commands/doctor.test.ts` and `test/unit/commands/inspect.test.ts` will need updating since the old functions are removed. Update them to test the new formatters instead, or remove the old test files if the formatter tests already cover the behavior.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: rewire CLI to use unified formatters with --format and --copy flags"
```

---

### Task 9: Persist report.md in compare runs

**Files:**
- Modify: `src/commands/compare.ts`

- [ ] **Step 1: Add report.md persistence**

In `runCompare`, after building `formatData`, generate and persist the markdown report:

```typescript
import { compareFormatter } from '../formatters/compare.js';

// After building formatData:
const reportMarkdown = compareFormatter.markdown(formatData);
await store.writeArtifact(run.runId, 'report.md', Buffer.from(reportMarkdown));
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

- [ ] **Step 3: Commit**

```bash
git add src/commands/compare.ts
git commit -m "feat: persist report.md in compare run artifacts"
```

---

### Task 10: Update existing tests + final verification

**Files:**
- Modify: `test/unit/commands/doctor.test.ts`
- Modify: `test/unit/commands/inspect.test.ts`
- Delete: `src/commands/devices.ts` (if only contained formatDeviceTable)
- Delete: `src/commands/inspect.ts` (if only contained formatting functions)

- [ ] **Step 1: Update doctor tests**

Replace `test/unit/commands/doctor.test.ts` to test `computeDoctorExitCode`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeDoctorExitCode } from '../../../src/commands/doctor.js';
import type { PrerequisiteCheck } from '../../../src/types.js';
import { ExitCode } from '../../../src/exit-codes.js';

describe('computeDoctorExitCode', () => {
  it('returns Success when all required tools available', () => {
    const checks: PrerequisiteCheck[] = [
      { name: 'node', required: true, available: true, version: '20.11.0' },
      { name: 'adb', required: false, available: false },
    ];
    expect(computeDoctorExitCode(checks)).toBe(ExitCode.Success);
  });

  it('returns PrerequisiteMissing when required tool missing', () => {
    const checks: PrerequisiteCheck[] = [
      { name: 'node', required: true, available: false, fix: 'Install Node.js' },
    ];
    expect(computeDoctorExitCode(checks)).toBe(ExitCode.PrerequisiteMissing);
  });

  it('returns Success for empty list', () => {
    expect(computeDoctorExitCode([])).toBe(ExitCode.Success);
  });
});
```

- [ ] **Step 2: Update inspect tests**

Replace `test/unit/commands/inspect.test.ts` to import from the new formatter:

```typescript
import { describe, it, expect } from 'vitest';
import { inspectFormatter } from '../../../src/formatters/inspect.js';
import type { InspectResult } from '../../../src/inspect/tree-inspector.js';

const result: InspectResult = {
  tree: [
    {
      id: 'n1', name: 'View', bounds: { x: 0, y: 0, width: 100, height: 50 },
      children: [
        {
          id: 'n2', name: 'Text', reactName: 'MyComponent', testID: 'submit-btn',
          bounds: { x: 10, y: 10, width: 80, height: 20 },
          text: 'Hello', children: [], inspectionTier: 'detailed',
        },
      ],
      inspectionTier: 'basic',
    },
  ],
  capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'uiautomator' },
  strategy: { method: 'uiautomator', reason: 'Android native inspection' },
  device: { name: 'Pixel_8', platform: 'android' },
  hints: [],
};

describe('inspect formatter (migrated)', () => {
  it('renders node names with bounds', () => {
    const output = inspectFormatter.terminal(result);
    expect(output).toContain('View');
    expect(output).toContain('(0,0 100x50)');
  });

  it('renders nested children', () => {
    const output = inspectFormatter.terminal(result);
    expect(output).toContain('MyComponent');
    expect(output).toContain('"Hello"');
  });

  it('shows testID in brackets', () => {
    const output = inspectFormatter.terminal(result);
    expect(output).toContain('[submit-btn]');
  });

  it('shows tier icon for detailed', () => {
    const output = inspectFormatter.terminal(result);
    expect(output).toContain('⚛');
  });

  it('renders capabilities', () => {
    const output = inspectFormatter.terminal(result);
    expect(output).toContain('uiautomator');
  });
});
```

- [ ] **Step 3: Clean up old command files**

If `src/commands/devices.ts` only contains `formatDeviceTable`, delete it. If `src/commands/inspect.ts` only contains formatting functions, delete it. Update any remaining imports.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: ALL PASS

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: Clean

- [ ] **Step 6: Build**

```bash
npx tsup
```

Expected: Success

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: complete Phase 4 output formatters migration"
```

---

## Verification

After all tasks are complete:

1. `drift doctor` — colored output with green/red icons
2. `drift doctor --format markdown` — markdown table
3. `drift doctor --format json` — JSON array
4. `drift devices` — colored state indicators
5. `drift devices --format markdown` — markdown table
6. `drift inspect -d Pixel_8` — colored tree with strategy
7. `drift inspect -d Pixel_8 --json` — JSON (backward compat)
8. `drift inspect -d Pixel_8 --format markdown` — markdown report with hints
9. `drift compare --design <path>` — findings with severity colors, summary line
10. `drift compare --design <path> --format markdown` — full markdown report
11. `drift compare --design <path> --copy` — terminal output + markdown on clipboard
12. `.drift/runs/<id>/report.md` exists after compare
