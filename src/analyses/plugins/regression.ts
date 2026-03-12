import type { AnalysisPlugin, AnalysisResult, CompareContext } from '../types.js';
import { runComparison } from '../../diff/compare.js';

export class RegressionAnalysis implements AnalysisPlugin {
  name = 'regression';
  description = 'Layout regression detection against previous baseline';

  isAvailable(ctx: CompareContext): boolean {
    return !!ctx.baseline;
  }

  async run(ctx: CompareContext): Promise<AnalysisResult> {
    const start = Date.now();
    const { config } = ctx;
    const [mr, mg, mb, ma] = config.diffMaskColor;

    const compareResult = await runComparison(ctx.baseline!.path, ctx.screenshot.path, {
      threshold: config.threshold,
      diffThreshold: config.diffThreshold,
      regionMergeGap: config.regionMergeGap,
      regionMinArea: config.regionMinArea,
      ignoreRules: config.ignoreRules,
      diffMaskColor: { r: mr, g: mg, b: mb, a: ma / 255 },
      platform: config.platform,
    });

    await ctx.store.writeArtifact(ctx.runId, 'regression-diff-mask.png', compareResult.diffMaskBuffer);
    for (const crop of compareResult.regionCrops) {
      await ctx.store.writeArtifact(ctx.runId, `regression-regions/${crop.id}.png`, crop.buffer);
    }

    const regressionThreshold = ctx.analysisConfig.options['regression']?.regressionThreshold as number | undefined;
    const passed = compareResult.diffPercentage <= (regressionThreshold ?? config.diffThreshold);

    const findings = compareResult.regions.map((region, index) => ({
      id: `regression-${index}`,
      category: 'regression' as const,
      severity: 'major' as const,
      confidence: 1.0,
      region: region.bounds,
      component: { name: 'region', bounds: region.bounds, depth: 0 },
      evidence: [{ type: 'regression' as const, score: region.percentage / 100, note: `${region.percentage.toFixed(3)}% changed` }],
      description: `Region ${region.id}: ${region.percentage.toFixed(3)}% changed (${region.pixelCount}px)`,
    }));

    return {
      analysisName: this.name,
      findings,
      summary: passed
        ? 'Regression: no changes detected'
        : `Regression: ${compareResult.diffPercentage.toFixed(3)}% changed, ${compareResult.regions.length} regions`,
      metadata: {
        totalPixels: compareResult.totalPixels,
        diffPixels: compareResult.diffPixels,
        diffPercentage: compareResult.diffPercentage,
        regions: compareResult.regions,
        passed,
      },
      durationMs: Date.now() - start,
    };
  }
}
