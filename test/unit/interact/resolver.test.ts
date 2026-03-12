import { describe, it, expect } from 'vitest';
import { resolveTarget } from '../../../src/interact/resolver.js';
import type { ComponentNode } from '../../../src/types.js';

function makeNode(
  id: string,
  name: string,
  bounds: { x: number; y: number; width: number; height: number },
  opts: { testID?: string; text?: string; children?: ComponentNode[] } = {},
): ComponentNode {
  return {
    id,
    name,
    nativeName: name,
    bounds,
    testID: opts.testID,
    text: opts.text,
    children: opts.children ?? [],
    inspectionTier: 'basic',
  };
}

describe('resolveTarget', () => {
  it('resolves by testID', () => {
    const tree = [makeNode('1', 'Button', { x: 10, y: 20, width: 100, height: 40 }, { testID: 'submit-btn' })];
    const result = resolveTarget(tree, 'submit-btn');
    expect(result).toEqual({ x: 60, y: 40, resolvedFrom: 'testID:submit-btn' });
  });

  it('resolves by component name', () => {
    const tree = [makeNode('1', 'LoginButton', { x: 0, y: 100, width: 200, height: 50 })];
    const result = resolveTarget(tree, 'LoginButton');
    expect(result).toEqual({ x: 100, y: 125, resolvedFrom: 'name:LoginButton' });
  });

  it('resolves by text content', () => {
    const tree = [makeNode('1', 'Text', { x: 5, y: 5, width: 90, height: 30 }, { text: 'Sign in' })];
    const result = resolveTarget(tree, 'Sign in');
    expect(result).toEqual({ x: 50, y: 20, resolvedFrom: 'text:Sign in' });
  });

  it('returns null when not found', () => {
    const tree = [makeNode('1', 'View', { x: 0, y: 0, width: 100, height: 100 })];
    const result = resolveTarget(tree, 'nonexistent');
    expect(result).toBeNull();
  });

  it('prefers name over text when querying "Submit"', () => {
    const tree = [
      makeNode('1', 'View', { x: 0, y: 0, width: 300, height: 300 }, {
        children: [
          makeNode('2', 'Submit', { x: 10, y: 10, width: 100, height: 40 }),
          makeNode('3', 'Text', { x: 10, y: 60, width: 100, height: 40 }, { text: 'Submit' }),
        ],
      }),
    ];
    const result = resolveTarget(tree, 'Submit');
    expect(result?.resolvedFrom).toBe('name:Submit');
  });

  it('skips nodes with zero-size bounds', () => {
    const tree = [
      makeNode('1', 'Ghost', { x: 10, y: 20, width: 0, height: 0 }, { testID: 'ghost' }),
      makeNode('2', 'Real', { x: 10, y: 20, width: 100, height: 40 }, { testID: 'real' }),
    ];
    expect(resolveTarget(tree, 'ghost')).toBeNull();
    expect(resolveTarget(tree, 'real')).not.toBeNull();
  });
});
