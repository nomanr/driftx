import { describe, it, expect } from 'vitest';
import { matchRegionsToComponents } from '../../../src/inspect/component-matcher.js';
import type { DiffRegion, ComponentNode, BoundingBox } from '../../../src/types.js';

function makeRegion(id: string, bounds: BoundingBox): DiffRegion {
  return { id, bounds, pixelCount: bounds.width * bounds.height, percentage: 1 };
}

function makeNode(id: string, name: string, bounds: BoundingBox, children: ComponentNode[] = [], testID?: string): ComponentNode {
  return { id, name, nativeName: name, bounds, children, inspectionTier: 'basic', testID };
}

describe('matchRegionsToComponents', () => {
  it('matches a region to the deepest overlapping component', () => {
    const tree: ComponentNode[] = [
      makeNode('1', 'FrameLayout', { x: 0, y: 0, width: 1080, height: 2400 }, [
        makeNode('2', 'LinearLayout', { x: 0, y: 0, width: 1080, height: 2400 }, [
          makeNode('3', 'Button', { x: 60, y: 1600, width: 960, height: 130 }),
        ]),
      ]),
    ];
    const regions = [makeRegion('r-0', { x: 100, y: 1620, width: 200, height: 80 })];
    const matches = matchRegionsToComponents(regions, tree);
    expect(matches).toHaveLength(1);
    expect(matches[0].component.name).toBe('Button');
    expect(matches[0].component.depth).toBe(2);
  });

  it('returns no match when region does not overlap any component', () => {
    const tree: ComponentNode[] = [
      makeNode('1', 'Button', { x: 500, y: 500, width: 100, height: 50 }),
    ];
    const regions = [makeRegion('r-0', { x: 0, y: 0, width: 10, height: 10 })];
    const matches = matchRegionsToComponents(regions, tree);
    expect(matches).toHaveLength(0);
  });

  it('assigns confidence 0.4-0.6 for basic tier matches', () => {
    const tree: ComponentNode[] = [
      makeNode('1', 'Button', { x: 10, y: 10, width: 200, height: 50 }),
    ];
    const regions = [makeRegion('r-0', { x: 20, y: 15, width: 100, height: 30 })];
    const matches = matchRegionsToComponents(regions, tree);
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.4);
    expect(matches[0].confidence).toBeLessThanOrEqual(0.6);
  });

  it('assigns higher confidence for detailed tier matches', () => {
    const tree: ComponentNode[] = [
      makeNode('1', 'Button', { x: 10, y: 10, width: 200, height: 50 }),
    ];
    tree[0].inspectionTier = 'detailed';
    tree[0].reactName = 'SubmitButton';
    const regions = [makeRegion('r-0', { x: 20, y: 15, width: 100, height: 30 })];
    const matches = matchRegionsToComponents(regions, tree);
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.6);
    expect(matches[0].confidence).toBeLessThanOrEqual(0.8);
  });

  it('prefers deeper (more specific) component', () => {
    const tree: ComponentNode[] = [
      makeNode('1', 'ViewGroup', { x: 0, y: 0, width: 500, height: 500 }, [
        makeNode('2', 'ViewGroup', { x: 10, y: 10, width: 200, height: 200 }, [
          makeNode('3', 'TextView', { x: 20, y: 20, width: 100, height: 50 }),
        ]),
      ]),
    ];
    const regions = [makeRegion('r-0', { x: 25, y: 25, width: 50, height: 30 })];
    const matches = matchRegionsToComponents(regions, tree);
    expect(matches[0].component.name).toBe('TextView');
    expect(matches[0].component.depth).toBe(2);
  });

  it('handles multiple regions with different component matches', () => {
    const tree: ComponentNode[] = [
      makeNode('1', 'Layout', { x: 0, y: 0, width: 1080, height: 2400 }, [
        makeNode('2', 'Button', { x: 10, y: 10, width: 200, height: 50 }),
        makeNode('3', 'Text', { x: 10, y: 500, width: 200, height: 50 }),
      ]),
    ];
    const regions = [
      makeRegion('r-0', { x: 20, y: 15, width: 100, height: 30 }),
      makeRegion('r-1', { x: 20, y: 510, width: 100, height: 30 }),
    ];
    const matches = matchRegionsToComponents(regions, tree);
    expect(matches).toHaveLength(2);
    expect(matches[0].component.name).toBe('Button');
    expect(matches[1].component.name).toBe('Text');
  });

  it('rejects match when overlap is below 50%', () => {
    const tree: ComponentNode[] = [
      makeNode('1', 'Button', { x: 0, y: 0, width: 100, height: 100 }),
    ];
    const regions = [makeRegion('r-0', { x: 90, y: 90, width: 100, height: 100 })];
    const matches = matchRegionsToComponents(regions, tree);
    expect(matches).toHaveLength(0);
  });

  it('accepts match when overlap exceeds 50%', () => {
    const tree: ComponentNode[] = [
      makeNode('1', 'Button', { x: 0, y: 0, width: 200, height: 200 }),
    ];
    const regions = [makeRegion('r-0', { x: 10, y: 10, width: 50, height: 50 })];
    const matches = matchRegionsToComponents(regions, tree);
    expect(matches).toHaveLength(1);
  });

  it('includes testID in ComponentMatch when available', () => {
    const tree: ComponentNode[] = [
      makeNode('1', 'Button', { x: 10, y: 10, width: 200, height: 50 }, [], 'submit-btn'),
    ];
    const regions = [makeRegion('r-0', { x: 20, y: 15, width: 100, height: 30 })];
    const matches = matchRegionsToComponents(regions, tree);
    expect(matches[0].component.testID).toBe('submit-btn');
  });
});
