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
      expect(output).toContain('# Driftx Inspect Report');
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
