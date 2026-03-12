import type { ComponentNode, BoundingBox, Shell } from '../types.js';

function parseBounds(boundsStr: string): BoundingBox {
  const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return { x: 0, y: 0, width: 0, height: 0 };
  const [, x1, y1, x2, y2] = match.map(Number);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function parseNode(nodeStr: string, idCounter: { n: number }): { node: ComponentNode; remaining: string } | null {
  const attrMatch = nodeStr.match(/^<node\s+([^>]*?)(\/?>)/);
  if (!attrMatch) return null;

  const attrs = attrMatch[1];
  const selfClosing = attrMatch[2] === '/>';
  const afterTag = nodeStr.slice(attrMatch[0].length);

  const get = (name: string): string => {
    const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
    return m ? m[1] : '';
  };

  const id = String(idCounter.n++);
  const resourceId = get('resource-id');
  const className = get('class');

  const node: ComponentNode = {
    id,
    name: className || 'unknown',
    nativeName: className || undefined,
    testID: resourceId || undefined,
    bounds: parseBounds(get('bounds')),
    text: get('text') || undefined,
    children: [],
    inspectionTier: 'basic',
  };

  if (selfClosing) {
    return { node, remaining: afterTag };
  }

  let rest = afterTag;
  while (true) {
    rest = rest.replace(/^\s+/, '');
    if (rest.startsWith('</node>')) {
      rest = rest.slice('</node>'.length);
      break;
    }
    const child = parseNode(rest, idCounter);
    if (!child) break;
    node.children.push(child.node);
    rest = child.remaining;
  }

  return { node, remaining: rest };
}

export function parseUiAutomatorXml(xml: string): ComponentNode[] {
  if (!xml.includes('<hierarchy')) {
    throw new Error('Invalid UIAutomator XML: missing <hierarchy> element');
  }

  const hierarchyMatch = xml.match(/<hierarchy[^>]*>([\s\S]*)<\/hierarchy>/);
  if (!hierarchyMatch) return [];

  const content = hierarchyMatch[1].trim();
  if (!content) return [];

  const nodes: ComponentNode[] = [];
  const idCounter = { n: 0 };
  let remaining = content;

  while (remaining.trim()) {
    remaining = remaining.replace(/^\s+/, '');
    if (!remaining.startsWith('<node')) break;
    const result = parseNode(remaining, idCounter);
    if (!result) break;
    nodes.push(result.node);
    remaining = result.remaining;
  }

  return nodes;
}

export async function dumpUiAutomator(shell: Shell, deviceId: string, timeout?: number): Promise<ComponentNode[]> {
  const { stdout } = await shell.exec('adb', ['-s', deviceId, 'exec-out', 'uiautomator', 'dump', '/dev/tty'], timeout ? { timeout } : undefined);
  return parseUiAutomatorXml(stdout);
}
