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

  const lowerQuery = query.toLowerCase();

  const startsWithMatches = nodes.filter((n) =>
    n.text && hasSize(n) && (n.text.toLowerCase().startsWith(lowerQuery + ',') || n.text.toLowerCase().startsWith(lowerQuery + ' ')),
  );
  const byTextStartsWith = smallest(startsWithMatches);
  if (byTextStartsWith) return centerOf(byTextStartsWith, `text~:${query}`);

  const containsMatches = nodes.filter((n) =>
    n.text && hasSize(n) && n.text.toLowerCase().includes(lowerQuery),
  );
  const byTextContains = smallest(containsMatches);
  if (byTextContains) return centerOf(byTextContains, `text~:${query}`);

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

function area(node: ComponentNode): number {
  return node.bounds.width * node.bounds.height;
}

function smallest(nodes: ComponentNode[]): ComponentNode | undefined {
  if (nodes.length === 0) return undefined;
  return nodes.reduce((best, n) => area(n) < area(best) ? n : best);
}

function centerOf(node: ComponentNode, resolvedFrom: string): TapTarget {
  return {
    x: Math.round(node.bounds.x + node.bounds.width / 2),
    y: Math.round(node.bounds.y + node.bounds.height / 2),
    resolvedFrom,
  };
}
