import type { ComponentNode, InspectionCapabilities } from '../types.js';
import type { InspectResult } from '../inspect/tree-inspector.js';

const STRATEGY_LABELS: Record<string, string> = {
  cdp: 'CDP via Metro (React DevTools)',
  uiautomator: 'UIAutomator (native Android)',
  idb: 'idb (native iOS)',
  none: 'None',
};

export function formatTree(nodes: ComponentNode[], indent: number = 0): string {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = '  '.repeat(indent);
    const name = node.reactName ?? node.name;
    const testId = node.testID ? ` [${node.testID}]` : '';
    const text = node.text ? ` "${node.text}"` : '';
    const tier = node.inspectionTier === 'detailed' ? ' ⚛' : '';
    const b = node.bounds;
    const bounds = b.width > 0 ? ` (${b.x},${b.y} ${b.width}x${b.height})` : '';
    lines.push(`${prefix}${name}${testId}${text}${bounds}${tier}`);
    lines.push(formatTree(node.children, indent + 1));
  }
  return lines.filter(Boolean).join('\n');
}

export function formatCapabilities(caps: InspectionCapabilities): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('  Capabilities');
  lines.push('  ' + '-'.repeat(40));
  lines.push(`  Tree:           ${caps.tree}`);
  lines.push(`  Source mapping:  ${caps.sourceMapping}`);
  lines.push(`  Styles:         ${caps.styles}`);
  lines.push(`  Protocol:       ${caps.protocol}`);
  lines.push('');
  return lines.join('\n');
}

export function formatStrategy(result: InspectResult): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`  Device:    ${result.device.name} (${result.device.platform})`);
  lines.push(`  Strategy:  ${STRATEGY_LABELS[result.strategy.method] ?? result.strategy.method}`);
  if (result.strategy.appId) {
    lines.push(`  App:       ${result.strategy.appId}`);
  }
  lines.push('');
  return lines.join('\n');
}
