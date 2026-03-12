import { describe, it, expect } from 'vitest';
import { parseUiAutomatorXml, dumpUiAutomator } from '../../../src/inspect/uiautomator.js';
import { createMockShell } from '../../helpers/mock-shell.js';
import { uiautomatorFixtures } from '../../fixtures/uiautomator-output.js';

describe('parseUiAutomatorXml', () => {
  it('parses a simple hierarchy into ComponentNode tree', () => {
    const nodes = parseUiAutomatorXml(uiautomatorFixtures.simpleHierarchy);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('android.widget.FrameLayout');
    expect(nodes[0].bounds).toEqual({ x: 0, y: 0, width: 1080, height: 2400 });
  });

  it('extracts resource-id as testID', () => {
    const nodes = parseUiAutomatorXml(uiautomatorFixtures.simpleHierarchy);
    const flat = flattenNodes(nodes);
    const btn = flat.find((n) => n.testID === 'com.example.app:id/btnLogin');
    expect(btn).toBeDefined();
    expect(btn!.text).toBe('Sign In');
    expect(btn!.name).toBe('android.widget.Button');
  });

  it('parses bounds [minX,minY][maxX,maxY] to BoundingBox', () => {
    const nodes = parseUiAutomatorXml(uiautomatorFixtures.simpleHierarchy);
    const flat = flattenNodes(nodes);
    const btn = flat.find((n) => n.testID === 'com.example.app:id/btnLogin');
    expect(btn!.bounds).toEqual({ x: 63, y: 1626, width: 954, height: 126 });
  });

  it('preserves parent-child hierarchy', () => {
    const nodes = parseUiAutomatorXml(uiautomatorFixtures.simpleHierarchy);
    const root = nodes[0];
    expect(root.children).toHaveLength(1);
    const content = root.children[0];
    expect(content.children).toHaveLength(1);
    const container = content.children[0];
    expect(container.children).toHaveLength(3);
  });

  it('handles React Native view hierarchy', () => {
    const nodes = parseUiAutomatorXml(uiautomatorFixtures.reactNativeHierarchy);
    const flat = flattenNodes(nodes);
    const avatar = flat.find((n) => n.testID === 'header-avatar');
    expect(avatar).toBeDefined();
    expect(avatar!.name).toBe('android.widget.ImageView');
  });

  it('sets inspectionTier to basic', () => {
    const nodes = parseUiAutomatorXml(uiautomatorFixtures.simpleHierarchy);
    const flat = flattenNodes(nodes);
    expect(flat.every((n) => n.inspectionTier === 'basic')).toBe(true);
  });

  it('returns empty array for empty hierarchy', () => {
    const nodes = parseUiAutomatorXml(uiautomatorFixtures.noNodes);
    expect(nodes).toHaveLength(0);
  });

  it('throws for malformed XML', () => {
    expect(() => parseUiAutomatorXml(uiautomatorFixtures.malformedXml)).toThrow();
  });
});

describe('dumpUiAutomator', () => {
  it('calls adb uiautomator dump via shell', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': {
        stdout: uiautomatorFixtures.simpleHierarchy,
        stderr: '',
      },
    });
    const nodes = await dumpUiAutomator(shell, 'emulator-5554');
    expect(nodes.length).toBeGreaterThan(0);
    expect(shell.calls).toHaveLength(1);
  });

  it('throws when adb command fails', async () => {
    const shell = createMockShell({
      'adb -s emulator-5554 exec-out uiautomator dump /dev/tty': async () => {
        throw new Error('device offline');
      },
    });
    await expect(dumpUiAutomator(shell, 'emulator-5554')).rejects.toThrow('device offline');
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
