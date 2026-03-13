import type { ComponentNode } from '../types.js';
import type { CompanionHierarchyNode } from './client.js';

function cleanElementType(elementType: string): string {
  const prefix = 'XCUIElementType';
  if (elementType.startsWith(prefix)) {
    return elementType.slice(prefix.length);
  }
  return elementType.charAt(0).toUpperCase() + elementType.slice(1);
}

function isZeroSize(frame: { width: number; height: number }): boolean {
  return frame.width === 0 && frame.height === 0;
}

function convertNode(node: CompanionHierarchyNode, idCounter: { n: number }): ComponentNode | null {
  const children: ComponentNode[] = [];

  for (const child of node.children) {
    const converted = convertNode(child, idCounter);
    if (converted) children.push(converted);
  }

  if (children.length === 0 && isZeroSize(node.frame)) {
    return null;
  }

  return {
    id: String(idCounter.n++),
    name: cleanElementType(node.elementType),
    nativeName: node.elementType,
    testID: node.identifier || undefined,
    bounds: { x: node.frame.x, y: node.frame.y, width: node.frame.width, height: node.frame.height },
    text: node.label || undefined,
    children,
    inspectionTier: 'basic',
  };
}

export function parseCompanionHierarchy(nodes: CompanionHierarchyNode[]): ComponentNode[] {
  const idCounter = { n: 0 };
  const result: ComponentNode[] = [];

  for (const node of nodes) {
    const converted = convertNode(node, idCounter);
    if (converted) result.push(converted);
  }

  return result;
}
