import type { AnalysisPlugin, AnalysisResult, CompareContext } from '../types.js';
import type { ComponentNode, DiffFinding } from '../../types.js';

const INTERACTIVE_NAMES = new Set([
  'Pressable',
  'TouchableOpacity',
  'Button',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
]);

function isInteractive(name: string): boolean {
  if (INTERACTIVE_NAMES.has(name)) return true;
  return name.includes('Button') || name.includes('Pressable');
}

function collectNodes(nodes: ComponentNode[]): ComponentNode[] {
  const result: ComponentNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push(node);
    for (const child of node.children) {
      stack.push(child);
    }
  }
  return result;
}

export class AccessibilityAnalysis implements AnalysisPlugin {
  name = 'a11y';
  description = 'Accessibility audit of component tree';

  isAvailable(ctx: CompareContext): boolean {
    return !!ctx.tree?.length;
  }

  async run(ctx: CompareContext): Promise<AnalysisResult> {
    const start = Date.now();
    const nodes = collectNodes(ctx.tree ?? []);
    const platform = ctx.config.platform;
    const tapThreshold = platform === 'ios' ? 44 : 48;

    const findings: DiffFinding[] = [];
    let labelCount = 0;
    let tapTargetCount = 0;
    let imageCount = 0;
    let emptyTextCount = 0;

    for (const node of nodes) {
      if (isInteractive(node.name) && !node.testID) {
        const styles = node.styles ?? {};
        const hasLabel =
          'accessibilityLabel' in styles ||
          'aria-label' in styles;

        if (!hasLabel) {
          findings.push({
            id: `a11y-label-${labelCount++}`,
            category: 'accessibility',
            severity: 'major',
            confidence: 1.0,
            region: node.bounds,
            component: { name: node.name, testID: node.testID, bounds: node.bounds, depth: 0 },
            evidence: [{ type: 'accessibility', score: 1.0, note: `Interactive component "${node.name}" is missing an accessibilityLabel` }],
            description: `Interactive component "${node.name}" is missing an accessibilityLabel`,
          });
        }
      }

      if (node.bounds.width > 0 && node.bounds.height > 0) {
        if (node.bounds.width < tapThreshold || node.bounds.height < tapThreshold) {
          if (isInteractive(node.name)) {
            findings.push({
              id: `a11y-tap-${tapTargetCount++}`,
              category: 'accessibility',
              severity: 'minor',
              confidence: 1.0,
              region: node.bounds,
              component: { name: node.name, testID: node.testID, bounds: node.bounds, depth: 0 },
              evidence: [{ type: 'accessibility', score: 1.0, note: `Tap target "${node.name}" is ${node.bounds.width}x${node.bounds.height}, smaller than ${tapThreshold}x${tapThreshold}` }],
              description: `Tap target "${node.name}" is ${node.bounds.width}x${node.bounds.height}, smaller than the recommended ${tapThreshold}x${tapThreshold}`,
            });
          }
        }
      }

      if (node.name.includes('Image')) {
        const styles = node.styles ?? {};
        const hasAlt =
          'accessibilityLabel' in styles ||
          'aria-label' in styles ||
          'alt' in styles;

        if (!hasAlt) {
          findings.push({
            id: `a11y-image-${imageCount++}`,
            category: 'accessibility',
            severity: 'major',
            confidence: 1.0,
            region: node.bounds,
            component: { name: node.name, testID: node.testID, bounds: node.bounds, depth: 0 },
            evidence: [{ type: 'accessibility', score: 1.0, note: `Image component "${node.name}" is missing an accessibilityLabel or alt text` }],
            description: `Image component "${node.name}" is missing an accessibilityLabel or alt text`,
          });
        }
      }

      if (node.text === '') {
        findings.push({
          id: `a11y-empty-${emptyTextCount++}`,
          category: 'accessibility',
          severity: 'info',
          confidence: 1.0,
          region: node.bounds,
          component: { name: node.name, testID: node.testID, bounds: node.bounds, depth: 0 },
          evidence: [{ type: 'accessibility', score: 1.0, note: `Component "${node.name}" has an empty text node` }],
          description: `Component "${node.name}" has an empty text node`,
        });
      }
    }

    const totalIssues = findings.length;
    const summary = totalIssues === 0 ? 'No accessibility issues' : `${totalIssues} accessibility issue${totalIssues === 1 ? '' : 's'} found`;

    return {
      analysisName: this.name,
      findings,
      summary,
      metadata: {
        totalChecked: nodes.length,
        issuesByType: {
          label: labelCount,
          tapTarget: tapTargetCount,
          image: imageCount,
          emptyText: emptyTextCount,
        },
      },
      durationMs: Date.now() - start,
    };
  }
}
