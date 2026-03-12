import { describe, it, expect } from 'vitest';
import { parseIosAccessibility, dumpIosAccessibility } from '../../../src/inspect/ios-accessibility.js';
import { createMockShell } from '../../helpers/mock-shell.js';
import { iosAccessibilityFixtures } from '../../fixtures/ios-accessibility-output.js';

describe('parseIosAccessibility', () => {
  it('parses accessibility JSON into ComponentNode tree', () => {
    const nodes = parseIosAccessibility(iosAccessibilityFixtures.simpleHierarchy);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('AXApplication');
  });

  it('extracts identifier as testID', () => {
    const nodes = parseIosAccessibility(iosAccessibilityFixtures.simpleHierarchy);
    const flat = flattenNodes(nodes);
    const btn = flat.find((n) => n.testID === 'login-button');
    expect(btn).toBeDefined();
    expect(btn!.text).toBe('Sign In');
  });

  it('converts frame to BoundingBox', () => {
    const nodes = parseIosAccessibility(iosAccessibilityFixtures.simpleHierarchy);
    const flat = flattenNodes(nodes);
    const btn = flat.find((n) => n.testID === 'login-button');
    expect(btn!.bounds).toEqual({ x: 20, y: 100, width: 353, height: 44 });
  });

  it('preserves parent-child hierarchy', () => {
    const nodes = parseIosAccessibility(iosAccessibilityFixtures.simpleHierarchy);
    const app = nodes[0];
    expect(app.children).toHaveLength(1);
    const window = app.children[0];
    expect(window.children).toHaveLength(2);
  });

  it('sets inspectionTier to basic', () => {
    const nodes = parseIosAccessibility(iosAccessibilityFixtures.simpleHierarchy);
    const flat = flattenNodes(nodes);
    expect(flat.every((n) => n.inspectionTier === 'basic')).toBe(true);
  });

  it('returns empty array for empty hierarchy', () => {
    const nodes = parseIosAccessibility(iosAccessibilityFixtures.emptyHierarchy);
    expect(nodes).toHaveLength(0);
  });

  it('throws for malformed JSON', () => {
    expect(() => parseIosAccessibility(iosAccessibilityFixtures.malformed)).toThrow();
  });
});

describe('dumpIosAccessibility', () => {
  it('calls idb ui describe-all via shell', async () => {
    const shell = createMockShell({
      'idb ui describe-all --udid ABC-DEF-123': {
        stdout: iosAccessibilityFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const nodes = await dumpIosAccessibility(shell, 'ABC-DEF-123');
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('throws when idb is not available', async () => {
    const shell = createMockShell({});
    await expect(dumpIosAccessibility(shell, 'ABC-DEF-123')).rejects.toThrow();
  });
});

function flattenNodes(nodes: import('../../../src/types.js').ComponentNode[]): import('../../../src/types.js').ComponentNode[] {
  const result: import('../../../src/types.js').ComponentNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenNodes(node.children));
  }
  return result;
}
