import { describe, it, expect } from 'vitest';
import { AccessibilityAnalysis } from '../../../../src/analyses/plugins/a11y.js';
import type { CompareContext } from '../../../../src/analyses/types.js';
import type { ComponentNode } from '../../../../src/types.js';

function makeNode(overrides: Partial<ComponentNode> = {}): ComponentNode {
  return {
    id: 'node-1',
    name: 'View',
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    children: [],
    inspectionTier: 'basic',
    ...overrides,
  };
}

function makeContext(overrides: Partial<CompareContext> = {}): CompareContext {
  return {
    screenshot: { buffer: Buffer.from(''), rawPixels: Buffer.from(''), width: 100, height: 200, aspectRatio: 0.5, path: '/tmp/s.png' },
    config: {
      threshold: 0.1,
      diffThreshold: 0.01,
      regionMergeGap: 8,
      regionMinArea: 100,
      diffMaskColor: [255, 0, 0, 128],
      ignoreRules: [],
      platform: 'ios',
    } as any,
    analysisConfig: { enabled: [], disabled: [], options: {} },
    runId: 'test-run',
    store: { getRunPath: () => '/tmp/runs/test-run', writeArtifact: () => Promise.resolve() } as any,
    ...overrides,
  };
}

describe('AccessibilityAnalysis', () => {
  const a11y = new AccessibilityAnalysis();

  it('has correct name and description', () => {
    expect(a11y.name).toBe('a11y');
    expect(a11y.description).toBe('Accessibility audit of component tree');
  });

  it('is available when tree exists', () => {
    const ctx = makeContext({ tree: [makeNode()] });
    expect(a11y.isAvailable(ctx)).toBe(true);
  });

  it('is not available without tree', () => {
    expect(a11y.isAvailable(makeContext())).toBe(false);
    expect(a11y.isAvailable(makeContext({ tree: [] }))).toBe(false);
  });

  it('detects missing accessibility labels on interactive components', async () => {
    const tree = [
      makeNode({ id: '1', name: 'Pressable', bounds: { x: 0, y: 0, width: 100, height: 100 } }),
      makeNode({ id: '2', name: 'TouchableOpacity', bounds: { x: 0, y: 0, width: 100, height: 100 } }),
      makeNode({ id: '3', name: 'Button', bounds: { x: 0, y: 0, width: 100, height: 100 } }),
    ];
    const ctx = makeContext({ tree });
    const result = await a11y.run(ctx);

    const labelFindings = result.findings.filter(f => f.id.startsWith('a11y-label-'));
    expect(labelFindings.length).toBe(3);
    expect(labelFindings[0].severity).toBe('major');
    expect(labelFindings[0].category).toBe('accessibility');
    expect(labelFindings[0].confidence).toBe(1.0);
    expect(result.metadata).toMatchObject({
      issuesByType: expect.objectContaining({ label: 3 }),
    });
  });

  it('detects small tap targets', async () => {
    const tree = [
      makeNode({ id: '1', name: 'Pressable', bounds: { x: 0, y: 0, width: 40, height: 40 } }),
      makeNode({ id: '2', name: 'TouchableOpacity', bounds: { x: 0, y: 0, width: 50, height: 50 } }),
    ];
    const ctx = makeContext({ tree, config: { platform: 'ios' } as any });
    const result = await a11y.run(ctx);

    const tapFindings = result.findings.filter(f => f.id.startsWith('a11y-tap-'));
    expect(tapFindings.length).toBe(1);
    expect(tapFindings[0].severity).toBe('minor');
    expect(tapFindings[0].id).toBe('a11y-tap-0');
  });

  it('detects images without alt text', async () => {
    const tree = [
      makeNode({ id: '1', name: 'Image', bounds: { x: 0, y: 0, width: 100, height: 100 } }),
      makeNode({ id: '2', name: 'FastImage', bounds: { x: 0, y: 0, width: 100, height: 100 } }),
      makeNode({ id: '3', name: 'Image', bounds: { x: 0, y: 0, width: 100, height: 100 }, styles: { accessibilityLabel: 'profile photo' } }),
    ];
    const ctx = makeContext({ tree });
    const result = await a11y.run(ctx);

    const imageFindings = result.findings.filter(f => f.id.startsWith('a11y-image-'));
    expect(imageFindings.length).toBe(2);
    expect(imageFindings[0].severity).toBe('major');
    expect(imageFindings[0].category).toBe('accessibility');
  });

  it('detects empty text nodes', async () => {
    const tree = [
      makeNode({ id: '1', name: 'Text', text: '', bounds: { x: 0, y: 0, width: 100, height: 20 } }),
      makeNode({ id: '2', name: 'Text', text: 'Hello', bounds: { x: 0, y: 0, width: 100, height: 20 } }),
    ];
    const ctx = makeContext({ tree });
    const result = await a11y.run(ctx);

    const emptyFindings = result.findings.filter(f => f.id.startsWith('a11y-empty-'));
    expect(emptyFindings.length).toBe(1);
    expect(emptyFindings[0].severity).toBe('info');
    expect(emptyFindings[0].category).toBe('accessibility');
    expect(result.metadata).toMatchObject({
      issuesByType: expect.objectContaining({ emptyText: 1 }),
    });
  });

  it('returns no findings for accessible tree', async () => {
    const tree = [
      makeNode({ id: '1', name: 'View', bounds: { x: 0, y: 0, width: 200, height: 200 } }),
      makeNode({ id: '2', name: 'Text', text: 'Hello', bounds: { x: 0, y: 0, width: 100, height: 20 } }),
    ];
    const ctx = makeContext({ tree });
    const result = await a11y.run(ctx);

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toBe('No accessibility issues');
    expect(result.analysisName).toBe('a11y');
  });
});
