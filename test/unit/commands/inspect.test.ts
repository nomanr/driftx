import { describe, it, expect } from 'vitest';
import { formatTree, formatCapabilities } from '../../../src/commands/inspect.js';
import type { ComponentNode, InspectionCapabilities } from '../../../src/types.js';

describe('formatTree', () => {
  it('renders node names with bounds', () => {
    const nodes: ComponentNode[] = [
      {
        id: 'n1', name: 'View', bounds: { x: 0, y: 0, width: 100, height: 50 },
        children: [], inspectionTier: 'basic',
      },
    ];
    const output = formatTree(nodes);
    expect(output).toContain('View');
    expect(output).toContain('(0,0 100x50)');
  });

  it('renders nested children with indentation', () => {
    const nodes: ComponentNode[] = [
      {
        id: 'n1', name: 'View', bounds: { x: 0, y: 0, width: 100, height: 50 },
        inspectionTier: 'basic',
        children: [
          {
            id: 'n2', name: 'Text', text: 'Hello', bounds: { x: 10, y: 10, width: 80, height: 20 },
            children: [], inspectionTier: 'basic',
          },
        ],
      },
    ];
    const output = formatTree(nodes);
    expect(output).toContain('  Text "Hello"');
  });

  it('shows reactName when available and tier icon for detailed', () => {
    const nodes: ComponentNode[] = [
      {
        id: 'n1', name: 'View', reactName: 'MyComponent',
        bounds: { x: 0, y: 0, width: 100, height: 50 },
        children: [], inspectionTier: 'detailed',
      },
    ];
    const output = formatTree(nodes);
    expect(output).toContain('MyComponent');
    expect(output).toContain('⚛');
  });

  it('shows testID in brackets', () => {
    const nodes: ComponentNode[] = [
      {
        id: 'n1', name: 'Button', testID: 'submit-btn',
        bounds: { x: 0, y: 0, width: 100, height: 50 },
        children: [], inspectionTier: 'basic',
      },
    ];
    const output = formatTree(nodes);
    expect(output).toContain('[submit-btn]');
  });
});

describe('formatCapabilities', () => {
  it('renders all capability fields', () => {
    const caps: InspectionCapabilities = {
      tree: 'native' as any, sourceMapping: 'none', styles: 'none', protocol: 'uiautomator',
    };
    const output = formatCapabilities(caps);
    expect(output).toContain('Tree:');
    expect(output).toContain('native');
    expect(output).toContain('Protocol:');
    expect(output).toContain('uiautomator');
  });
});
