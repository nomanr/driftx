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
