import { describe, it, expect } from 'vitest';
import { generateFindings } from '../../../src/inspect/finding-generator.js';
import type { DiffRegion, BoundingBox } from '../../../src/types.js';
import type { RegionComponentMatch } from '../../../src/inspect/component-matcher.js';

function makeRegion(id: string, bounds: BoundingBox, pixelCount: number): DiffRegion {
  return { id, bounds, pixelCount, percentage: (pixelCount / 10000) * 100 };
}

describe('generateFindings', () => {
  it('creates a finding for a matched region', () => {
    const regions = [makeRegion('r-0', { x: 100, y: 200, width: 50, height: 30 }, 800)];
    const matches: RegionComponentMatch[] = [{
      regionId: 'r-0',
      component: { name: 'Button', testID: 'submit-btn', bounds: { x: 90, y: 190, width: 70, height: 50 }, depth: 3 },
      confidence: 0.55,
      overlapRatio: 0.85,
    }];
    const findings = generateFindings(regions, matches, 10000);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('diff-0');
    expect(findings[0].component?.name).toBe('Button');
    expect(findings[0].confidence).toBe(0.55);
    expect(findings[0].region).toEqual({ x: 100, y: 200, width: 50, height: 30 });
  });

  it('creates a finding without component for unmatched region', () => {
    const regions = [makeRegion('r-0', { x: 100, y: 200, width: 50, height: 30 }, 800)];
    const matches: RegionComponentMatch[] = [];
    const findings = generateFindings(regions, matches, 10000);
    expect(findings).toHaveLength(1);
    expect(findings[0].component).toBeUndefined();
    expect(findings[0].category).toBe('unknown');
  });

  it('includes pixel evidence in every finding', () => {
    const regions = [makeRegion('r-0', { x: 10, y: 10, width: 100, height: 100 }, 5000)];
    const matches: RegionComponentMatch[] = [];
    const findings = generateFindings(regions, matches, 10000);
    expect(findings[0].evidence).toHaveLength(1);
    expect(findings[0].evidence[0].type).toBe('pixel');
    expect(findings[0].evidence[0].score).toBeGreaterThan(0);
  });

  it('adds tree evidence when component is matched', () => {
    const regions = [makeRegion('r-0', { x: 10, y: 10, width: 50, height: 50 }, 500)];
    const matches: RegionComponentMatch[] = [{
      regionId: 'r-0',
      component: { name: 'Text', bounds: { x: 5, y: 5, width: 60, height: 60 }, depth: 2 },
      confidence: 0.5,
      overlapRatio: 0.7,
    }];
    const findings = generateFindings(regions, matches, 10000);
    expect(findings[0].evidence).toHaveLength(2);
    expect(findings[0].evidence[1].type).toBe('tree');
  });

  it('assigns severity based on region pixel percentage', () => {
    const large = makeRegion('r-0', { x: 0, y: 0, width: 500, height: 500 }, 50000);
    const small = makeRegion('r-1', { x: 0, y: 0, width: 5, height: 5 }, 25);
    const findings = generateFindings([large, small], [], 100000);
    expect(findings[0].severity).toBe('critical');
    expect(findings[1].severity).toBe('info');
  });
});
