import type { DiffRegion, DiffFinding, DiffEvidence } from '../types.js';
import type { RegionComponentMatch } from './component-matcher.js';

function classifySeverity(pixelPercentage: number): DiffFinding['severity'] {
  if (pixelPercentage >= 10) return 'critical';
  if (pixelPercentage >= 3) return 'major';
  if (pixelPercentage >= 0.5) return 'minor';
  return 'info';
}

export function generateFindings(
  regions: DiffRegion[],
  matches: RegionComponentMatch[],
  totalPixels: number,
): DiffFinding[] {
  const matchMap = new Map(matches.map((m) => [m.regionId, m]));

  return regions.map((region, i) => {
    const match = matchMap.get(region.id);
    const pixelPct = totalPixels > 0 ? (region.pixelCount / totalPixels) * 100 : 0;

    const evidence: DiffEvidence[] = [
      { type: 'pixel', score: pixelPct / 100, note: `${pixelPct.toFixed(1)}% pixel difference in region` },
    ];

    if (match) {
      evidence.push({
        type: 'tree',
        score: match.confidence,
        note: `Matched to ${match.component.name} via bounds overlap (${Math.round(match.overlapRatio * 100)}%)`,
      });
    }

    return {
      id: `diff-${i}`,
      category: 'unknown' as const,
      severity: classifySeverity(pixelPct),
      confidence: match?.confidence ?? 0.3,
      region: region.bounds,
      component: match?.component,
      evidence,
    };
  });
}
