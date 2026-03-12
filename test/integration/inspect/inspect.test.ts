import { describe, it, expect } from 'vitest';
import { parseUiAutomatorXml } from '../../../src/inspect/uiautomator.js';
import { matchRegionsToComponents } from '../../../src/inspect/component-matcher.js';
import { generateFindings } from '../../../src/inspect/finding-generator.js';
import { uiautomatorFixtures } from '../../fixtures/uiautomator-output.js';
import type { DiffRegion } from '../../../src/types.js';

describe('tree inspection pipeline', () => {
  it('parses tree, matches regions, and generates findings end-to-end', () => {
    const tree = parseUiAutomatorXml(uiautomatorFixtures.simpleHierarchy);
    expect(tree.length).toBeGreaterThan(0);

    const regions: DiffRegion[] = [
      { id: 'r-0', bounds: { x: 100, y: 1630, width: 200, height: 50 }, pixelCount: 5000, percentage: 5 },
      { id: 'r-1', bounds: { x: 100, y: 420, width: 150, height: 40 }, pixelCount: 3000, percentage: 3 },
    ];

    const matches = matchRegionsToComponents(regions, tree);
    expect(matches.length).toBeGreaterThan(0);

    const findings = generateFindings(regions, matches, 100000);
    expect(findings).toHaveLength(2);

    const btnFinding = findings.find((f) => f.component?.name === 'android.widget.Button');
    expect(btnFinding).toBeDefined();
    expect(btnFinding!.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('generates findings even without tree data', () => {
    const regions: DiffRegion[] = [
      { id: 'r-0', bounds: { x: 10, y: 10, width: 100, height: 100 }, pixelCount: 5000, percentage: 5 },
    ];
    const findings = generateFindings(regions, [], 100000);
    expect(findings).toHaveLength(1);
    expect(findings[0].component).toBeUndefined();
    expect(findings[0].evidence[0].type).toBe('pixel');
  });
});
