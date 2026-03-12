import type { DiffRegion, ComponentNode, ComponentMatch, BoundingBox } from '../types.js';

export interface RegionComponentMatch {
  regionId: string;
  component: ComponentMatch;
  confidence: number;
  overlapRatio: number;
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function overlapArea(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

interface CandidateMatch {
  node: ComponentNode;
  depth: number;
  overlapRatio: number;
}

function findDeepestOverlap(
  nodes: ComponentNode[],
  regionBounds: BoundingBox,
  depth: number,
): CandidateMatch | null {
  let best: CandidateMatch | null = null;
  const regionArea = regionBounds.width * regionBounds.height;

  for (const node of nodes) {
    if (!boxesOverlap(node.bounds, regionBounds)) continue;

    const overlap = overlapArea(node.bounds, regionBounds);
    const ratio = regionArea > 0 ? overlap / regionArea : 0;

    if (ratio > 0.5) {
      const childMatch = findDeepestOverlap(node.children, regionBounds, depth + 1);
      if (childMatch && childMatch.overlapRatio > 0.5) {
        if (!best || childMatch.depth > best.depth) {
          best = childMatch;
        }
      } else {
        if (!best || depth > best.depth || (depth === best.depth && ratio > best.overlapRatio)) {
          best = { node, depth, overlapRatio: ratio };
        }
      }
    }
  }

  return best;
}

function computeConfidence(node: ComponentNode, overlapRatio: number): number {
  let base: number;
  if (node.inspectionTier === 'detailed') {
    base = 0.6;
    if (node.source) base = 0.8;
  } else {
    base = 0.4;
  }
  const overlapBonus = Math.min(overlapRatio * 0.2, 0.2);
  return Math.min(base + overlapBonus, node.inspectionTier === 'detailed' ? 0.95 : 0.6);
}

export function matchRegionsToComponents(
  regions: DiffRegion[],
  tree: ComponentNode[],
): RegionComponentMatch[] {
  const matches: RegionComponentMatch[] = [];

  for (const region of regions) {
    const candidate = findDeepestOverlap(tree, region.bounds, 0);
    if (!candidate) continue;

    const { node, depth, overlapRatio } = candidate;
    const confidence = computeConfidence(node, overlapRatio);

    matches.push({
      regionId: region.id,
      component: {
        name: node.reactName ?? node.name,
        testID: node.testID,
        source: node.source,
        bounds: node.bounds,
        depth,
      },
      confidence,
      overlapRatio,
    });
  }

  return matches;
}
