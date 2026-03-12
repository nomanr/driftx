import { describe, it, expect } from 'vitest';
import { matchRegionsToComponents } from '../../../src/inspect/component-matcher.js';
import { generateFindings } from '../../../src/inspect/finding-generator.js';
import type { DiffRegion, ComponentNode } from '../../../src/types.js';

describe('compare pipeline with tree inspection', () => {
  it('populates findings from diff regions + component tree', () => {
    const regions: DiffRegion[] = [
      { id: 'r-0', bounds: { x: 50, y: 100, width: 200, height: 60 }, pixelCount: 8000, percentage: 8 },
    ];

    const tree: ComponentNode[] = [
      {
        id: 'c-0', name: 'android.widget.Button', testID: 'login-btn',
        bounds: { x: 50, y: 100, width: 200, height: 60 },
        children: [], inspectionTier: 'basic',
      },
    ];

    const matches = matchRegionsToComponents(regions, tree);
    expect(matches).toHaveLength(1);
    expect(matches[0].component.name).toBe('android.widget.Button');

    const findings = generateFindings(regions, matches, 100000);
    expect(findings).toHaveLength(1);
    expect(findings[0].component).toBeDefined();
    expect(findings[0].component!.testID).toBe('login-btn');
    expect(findings[0].severity).toBeDefined();
    expect(findings[0].confidence).toBeGreaterThan(0);
  });

  it('produces findings without tree data (pixel-only)', () => {
    const regions: DiffRegion[] = [
      { id: 'r-0', bounds: { x: 10, y: 10, width: 50, height: 50 }, pixelCount: 1000, percentage: 1 },
    ];
    const findings = generateFindings(regions, [], 100000);
    expect(findings).toHaveLength(1);
    expect(findings[0].component).toBeUndefined();
    expect(findings[0].evidence[0].type).toBe('pixel');
  });
});
