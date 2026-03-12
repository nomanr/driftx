import pc from 'picocolors';
import type { DiffFinding, DiffRegion, ComponentNode } from '../types.js';
import type { OutputFormatter, CompareFormatData } from './types.js';
import type { AnalysisResult } from '../analyses/types.js';

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'probable';
  return 'approximate';
}

function severityColor(severity: DiffFinding['severity'], text: string): string {
  if (severity === 'critical') return pc.red(pc.bold(text));
  if (severity === 'major') return pc.yellow(text);
  if (severity === 'minor') return pc.cyan(text);
  return pc.dim(text);
}

function severityCounts(findings: DiffFinding[]): string {
  const counts: Record<string, number> = {};
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }
  const parts: string[] = [];
  for (const sev of ['critical', 'major', 'minor', 'info'] as const) {
    if (counts[sev]) parts.push(`${counts[sev]} ${sev}`);
  }
  return parts.join(', ');
}

function formatTreePlain(nodes: ComponentNode[], indent: number = 0): string {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = '  '.repeat(indent);
    const name = node.reactName ?? node.name;
    const testId = node.testID ? ` [${node.testID}]` : '';
    const text = node.text ? ` "${node.text}"` : '';
    const b = node.bounds;
    const bounds = b.width > 0 ? ` (${b.x},${b.y} ${b.width}x${b.height})` : '';
    lines.push(`${prefix}${name}${testId}${text}${bounds}`);
    const childStr = formatTreePlain(node.children, indent + 1);
    if (childStr) lines.push(childStr);
  }
  return lines.join('\n');
}

function getPixelMeta(analyses: AnalysisResult[]): {
  diffPercentage: number;
  diffPixels: number;
  totalPixels: number;
  regions: DiffRegion[];
} {
  const pixel = analyses.find((a) => a.analysisName === 'pixel');
  const meta = pixel?.metadata as Record<string, unknown> | undefined;
  return {
    diffPercentage: (meta?.diffPercentage as number) ?? 0,
    diffPixels: (meta?.diffPixels as number) ?? 0,
    totalPixels: (meta?.totalPixels as number) ?? 0,
    regions: (meta?.regions as DiffRegion[]) ?? [],
  };
}

export const compareFormatter: OutputFormatter<CompareFormatData> = {
  terminal(data) {
    const { report } = data;
    const pm = getPixelMeta(report.analyses);
    const lines: string[] = [];
    lines.push('');
    lines.push(`  Diff: ${pm.diffPercentage.toFixed(2)}% (${pm.diffPixels.toLocaleString()}/${pm.totalPixels.toLocaleString()} pixels)`);
    if (pm.regions.length > 0) lines.push(`  Regions: ${pm.regions.length}`);
    lines.push(`  Duration: ${report.durationMs}ms`);

    for (const a of report.analyses) {
      lines.push(`  [${a.analysisName}] ${a.summary}`);
    }

    if (report.findings.length === 0) {
      lines.push('');
      lines.push(pc.green('  No differences found.'));
      lines.push('');
      lines.push(`  Run: ${report.runId}`);
      lines.push('');
      return lines.join('\n');
    }

    lines.push('');
    lines.push('  Findings');
    lines.push('  ' + '─'.repeat(70));

    for (const f of report.findings) {
      const tag = severityColor(f.severity, `[${f.severity.toUpperCase()}]`);
      const comp = f.component
        ? `${f.component.name}${f.component.testID ? ` [${f.component.testID}]` : ''}`
        : pc.dim('(unmatched)');
      const region = `(${f.region.x},${f.region.y} ${f.region.width}x${f.region.height})`;
      const conf = `(${confidenceLabel(f.confidence)})`;
      lines.push(`  ${tag}  ${f.id}  ${comp}  ${region}  ${conf}`);
    }

    lines.push('');
    lines.push(`  Summary: Found ${report.findings.length} differences (${severityCounts(report.findings)})`);
    lines.push('');
    lines.push(`  Run: ${report.runId}`);
    lines.push('');
    return lines.join('\n');
  },

  markdown(data) {
    const { report, device, artifactDir } = data;
    const pm = getPixelMeta(report.analyses);
    const lines: string[] = ['# Drift Compare Report', ''];

    if (device) lines.push(`**Device:** ${device.name} (${device.platform})`);
    const meta = report.metadata;
    if (meta.gitCommit || meta.gitBranch) {
      const git = [meta.gitCommit, meta.gitBranch].filter(Boolean).join(' on ');
      lines.push(`**Git:** ${git}`);
    }
    if (meta.framework && meta.framework !== 'unknown') lines.push(`**Framework:** ${meta.framework}`);
    lines.push(`**Diff:** ${pm.diffPercentage.toFixed(2)}% (${pm.diffPixels.toLocaleString()} / ${pm.totalPixels.toLocaleString()} pixels)`);
    if (pm.regions.length > 0) lines.push(`**Regions:** ${pm.regions.length}`);
    lines.push(`**Duration:** ${report.durationMs}ms`);
    lines.push(`**Run ID:** ${report.runId}`);

    if (report.analyses.length > 0) {
      lines.push('', '## Analyses', '');
      for (const a of report.analyses) {
        lines.push(`- **${a.analysisName}** (${a.durationMs}ms): ${a.summary}`);
      }
    }

    if (report.findings.length === 0) {
      lines.push('', 'No differences found.');
      return lines.join('\n');
    }

    lines.push('', '## Artifacts', '');
    lines.push(`- Screenshot: \`${artifactDir}/screenshot.png\``);
    lines.push(`- Design: \`${artifactDir}/design.png\``);
    lines.push(`- Diff mask: \`${artifactDir}/diff-mask.png\``);

    lines.push('', '## Findings');

    report.findings.forEach((f, i) => {
      const compName = f.component?.name ?? 'Unmatched region';
      lines.push('', `### ${i + 1}. [${f.severity.toUpperCase()}] ${compName} (${f.id})`, '');
      if (f.component) {
        lines.push(`- **Component:** ${f.component.name}`);
        if (f.component.testID) lines.push(`- **testID:** ${f.component.testID}`);
      }
      lines.push(`- **Category:** ${f.category}`);
      lines.push(`- **Region:** (${f.region.x}, ${f.region.y}) ${f.region.width}x${f.region.height}`);
      lines.push(`- **Confidence:** ${confidenceLabel(f.confidence)}`);
      if (f.evidence.length > 0) {
        lines.push('- **Evidence:**');
        for (const e of f.evidence) {
          lines.push(`  - ${e.type}: ${Math.round(e.score * 100)}% score — "${e.note}"`);
        }
      }
      const regionId = pm.regions[i]?.id;
      if (regionId) lines.push(`- **Region crop:** \`${artifactDir}/regions/${regionId}.png\``);
    });

    if (data.tree && data.tree.length > 0) {
      lines.push('', '## Component Tree Context', '', '```');
      lines.push(formatTreePlain(data.tree));
      lines.push('```');
    }

    if (data.inspectHints && data.inspectHints.length > 0) {
      lines.push('', '## Hints', '');
      for (const hint of data.inspectHints) {
        lines.push(`- ${hint}`);
      }
    }

    return lines.join('\n');
  },

  json(data) {
    return JSON.stringify({
      report: data.report,
      device: data.device,
      artifactDir: data.artifactDir,
    }, null, 2);
  },
};
