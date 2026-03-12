import type { ComponentNode, Shell } from '../types.js';

interface AXElement {
  frame?: { x: number; y: number; width: number; height: number };
  role?: string;
  label?: string;
  identifier?: string;
  children?: AXElement[];
}

function parseElement(el: AXElement, idCounter: { n: number }): ComponentNode {
  const id = String(idCounter.n++);
  return {
    id,
    name: el.role ?? 'unknown',
    nativeName: el.role,
    testID: el.identifier || undefined,
    bounds: el.frame
      ? { x: el.frame.x, y: el.frame.y, width: el.frame.width, height: el.frame.height }
      : { x: 0, y: 0, width: 0, height: 0 },
    text: el.label || undefined,
    children: (el.children ?? []).map((c) => parseElement(c, idCounter)),
    inspectionTier: 'basic',
  };
}

export function parseIosAccessibility(json: string): ComponentNode[] {
  const data = JSON.parse(json);
  const elements: AXElement[] = data.AXElements ?? [];
  const idCounter = { n: 0 };
  return elements.map((el) => parseElement(el, idCounter));
}

export async function dumpIosAccessibility(shell: Shell, deviceId: string, timeout?: number): Promise<ComponentNode[]> {
  const { stdout } = await shell.exec('xcrun', ['simctl', 'accessibility_info', deviceId], timeout ? { timeout } : undefined);
  return parseIosAccessibility(stdout);
}
