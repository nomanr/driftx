import pc from 'picocolors';
import type { ComponentNode, InspectionCapabilities } from '../types.js';
import type { InspectResult } from '../inspect/tree-inspector.js';
import type { OutputFormatter } from './types.js';

const STRATEGY_LABELS: Record<string, string> = {
  cdp: 'CDP via Metro (React DevTools)',
  uiautomator: 'UIAutomator (native Android)',
  idb: 'idb (native iOS)',
  none: 'None',
};

function formatTreeText(nodes: ComponentNode[], indent: number = 0): string {
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
    const childStr = formatTreeText(node.children, indent + 1);
    if (childStr) lines.push(childStr);
  }
  return lines.join('\n');
}

function formatStrategySection(result: InspectResult, colored: boolean): string {
  const lines: string[] = [];
  const label = STRATEGY_LABELS[result.strategy.method] ?? result.strategy.method;
  const strategyText = colored
    ? (result.strategy.method === 'none' ? pc.dim(label) : pc.cyan(label))
    : label;
  lines.push('');
  lines.push(`  Device:    ${result.device.name} (${result.device.platform})`);
  lines.push(`  Strategy:  ${strategyText}`);
  if (result.strategy.appId) {
    lines.push(`  App:       ${result.strategy.appId}`);
  }
  lines.push('');
  return lines.join('\n');
}

function formatCapsSection(caps: InspectionCapabilities): string {
  const lines: string[] = [];
  lines.push('  Capabilities');
  lines.push('  ' + '-'.repeat(40));
  lines.push(`  Tree:           ${caps.tree}`);
  lines.push(`  Source mapping:  ${caps.sourceMapping}`);
  lines.push(`  Styles:         ${caps.styles}`);
  lines.push(`  Protocol:       ${caps.protocol}`);
  lines.push('');
  return lines.join('\n');
}

function formatHintsSection(hints: string[], colored: boolean): string {
  if (hints.length === 0) return '';
  const lines = ['', '  Hints', '  ' + '-'.repeat(40)];
  for (const hint of hints) {
    lines.push(colored ? `  ${pc.yellow(hint)}` : `  ${hint}`);
  }
  lines.push('');
  return lines.join('\n');
}

export const inspectFormatter: OutputFormatter<InspectResult> = {
  terminal(result) {
    const parts: string[] = [formatStrategySection(result, true)];

    if (result.tree.length === 0) {
      parts.push('  No component tree available. Try running with React DevTools enabled.');
      parts.push(formatHintsSection(result.hints, true));
      return parts.filter(Boolean).join('\n');
    }

    parts.push(formatTreeText(result.tree));
    parts.push('');
    parts.push(formatCapsSection(result.capabilities));
    parts.push(formatHintsSection(result.hints, true));
    return parts.filter(Boolean).join('\n');
  },

  markdown(result) {
    const lines: string[] = [
      '# Drift Inspect Report',
      '',
      `**Device:** ${result.device.name} (${result.device.platform})`,
      `**Strategy:** ${STRATEGY_LABELS[result.strategy.method] ?? result.strategy.method}`,
    ];
    if (result.strategy.appId) {
      lines.push(`**App:** ${result.strategy.appId}`);
    }

    if (result.tree.length > 0) {
      lines.push('', '## Component Tree', '', '```', formatTreeText(result.tree), '```');
    } else {
      lines.push('', 'No component tree available.');
    }

    lines.push('', '## Capabilities', '', '| Capability | Level |', '|------------|-------|');
    lines.push(`| Tree | ${result.capabilities.tree} |`);
    lines.push(`| Source mapping | ${result.capabilities.sourceMapping} |`);
    lines.push(`| Styles | ${result.capabilities.styles} |`);
    lines.push(`| Protocol | ${result.capabilities.protocol} |`);

    if (result.hints.length > 0) {
      lines.push('', '## Hints', '');
      for (const hint of result.hints) {
        lines.push(`- ${hint}`);
      }
    }

    return lines.join('\n');
  },

  json(result) {
    return JSON.stringify({
      tree: result.tree,
      capabilities: result.capabilities,
      strategy: result.strategy,
      device: result.device,
      hints: result.hints,
    }, null, 2);
  },
};
