import type { AnalysisPlugin, AnalysisResult, CompareContext } from '../types.js';
import { runComparison } from '../../diff/compare.js';
import { matchRegionsToComponents } from '../../inspect/component-matcher.js';
import { generateFindings } from '../../inspect/finding-generator.js';

export class PixelAnalysis implements AnalysisPlugin {
  name = 'pixel';
  description = 'Pixel-level image comparison between screenshot and design';

  isAvailable(ctx: CompareContext): boolean {
    return !!ctx.design;
  }

  async run(ctx: CompareContext): Promise<AnalysisResult> {
    const start = Date.now();
    const { config } = ctx;
    const [mr, mg, mb, ma] = config.diffMaskColor;

    const compareResult = await runComparison(ctx.design!.path, ctx.screenshot.path, {
      threshold: config.threshold,
      diffThreshold: config.diffThreshold,
      regionMergeGap: config.regionMergeGap,
      regionMinArea: config.regionMinArea,
      ignoreRules: config.ignoreRules,
      diffMaskColor: { r: mr, g: mg, b: mb, a: ma / 255 },
      platform: config.platform,
    });

    await ctx.store.writeArtifact(ctx.runId, 'diff-mask.png', compareResult.diffMaskBuffer);
    for (const crop of compareResult.regionCrops) {
      await ctx.store.writeArtifact(ctx.runId, `regions/${crop.id}.png`, crop.buffer);
    }

    const matches = ctx.tree?.length
      ? matchRegionsToComponents(compareResult.regions, ctx.tree)
      : [];
    const findings = generateFindings(
      compareResult.regions,
      matches,
      compareResult.totalPixels,
    );

    const passed = compareResult.diffPercentage <= config.diffThreshold;

    return {
      analysisName: this.name,
      findings,
      summary: passed
        ? `Pixel diff: ${compareResult.diffPercentage.toFixed(3)}% (pass)`
        : `Pixel diff: ${compareResult.diffPercentage.toFixed(3)}% — ${compareResult.regions.length} regions (fail)`,
      metadata: {
        totalPixels: compareResult.totalPixels,
        diffPixels: compareResult.diffPixels,
        diffPercentage: compareResult.diffPercentage,
        regions: compareResult.regions,
        durationMs: compareResult.durationMs,
        passed,
      },
      durationMs: Date.now() - start,
    };
  }
}
