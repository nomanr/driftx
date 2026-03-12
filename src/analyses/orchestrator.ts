import type { AnalysisPlugin, AnalysisResult, CompareContext, CompareReport } from './types.js';
import type { AnalysisRegistry } from './registry.js';
import type { RunMetadata } from '../types.js';

export class AnalysisOrchestrator {
  constructor(private registry: AnalysisRegistry) {}

  async run(ctx: CompareContext): Promise<CompareReport> {
    const start = Date.now();
    const plugins = this.selectPlugins(ctx);

    const settled = await Promise.allSettled(
      plugins.map((plugin) => plugin.run(ctx)),
    );

    const analyses: AnalysisResult[] = settled.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        analysisName: plugins[i].name,
        findings: [],
        summary: `Error: ${result.reason?.message ?? 'unknown error'}`,
        metadata: {},
        durationMs: 0,
        error: result.reason?.message ?? 'unknown error',
      };
    });

    const findings = analyses.flatMap((a) => a.findings);
    const summaries = analyses.map((a) => a.summary).join('; ');
    const durationMs = Date.now() - start;

    return {
      runId: ctx.runId,
      analyses,
      findings,
      summary: summaries,
      metadata: {} as RunMetadata,
      durationMs,
    };
  }

  private selectPlugins(ctx: CompareContext): AnalysisPlugin[] {
    let plugins = this.registry.all();
    const { enabled, disabled } = ctx.analysisConfig;

    if (enabled.length > 0) {
      plugins = plugins.filter((p) => enabled.includes(p.name));
    }

    if (disabled.length > 0) {
      plugins = plugins.filter((p) => !disabled.includes(p.name));
    }

    return plugins.filter((p) => p.isAvailable(ctx));
  }
}
