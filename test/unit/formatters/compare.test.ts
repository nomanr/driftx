import { describe, it, expect } from 'vitest';
import { compareFormatter } from '../../../src/formatters/compare.js';
import type { CompareFormatData } from '../../../src/formatters/types.js';
import type { DiffResult } from '../../../src/types.js';

const baseDiffResult: DiffResult = {
  runId: 'abc123',
  metadata: {
    runId: 'abc123',
    startedAt: '2026-03-12T00:00:00Z',
    completedAt: '2026-03-12T00:00:01Z',
    projectRoot: '/test',
    deviceId: 'emulator-5554',
    platform: 'android',
    framework: 'react-native',
    orientation: 'portrait',
    driftVersion: '0.1.0',
    configHash: '',
  },
  totalPixels: 100000,
  diffPixels: 2340,
  diffPercentage: 2.34,
  regions: [
    { id: 'r-0', bounds: { x: 120, y: 340, width: 200, height: 44 }, pixelCount: 1500, percentage: 1.5 },
    { id: 'r-1', bounds: { x: 0, y: 0, width: 393, height: 48 }, pixelCount: 840, percentage: 0.84 },
  ],
  findings: [
    {
      id: 'diff-0', category: 'unknown', severity: 'major', confidence: 0.72,
      region: { x: 120, y: 340, width: 200, height: 44 },
      component: { name: 'SubmitButton', testID: 'submit-btn', bounds: { x: 100, y: 330, width: 240, height: 64 }, depth: 5 },
      evidence: [
        { type: 'pixel', score: 0.85, note: '14.2% pixel difference in region' },
        { type: 'tree', score: 0.72, note: 'Matched to SubmitButton via bounds overlap (68%)' },
      ],
    },
    {
      id: 'diff-1', category: 'unknown', severity: 'minor', confidence: 0.3,
      region: { x: 0, y: 0, width: 393, height: 48 },
      evidence: [{ type: 'pixel', score: 0.3, note: '0.84% pixel difference' }],
    },
  ],
  capabilities: {
    inspection: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'uiautomator' },
    scrollCapture: { supported: false, reason: 'Not implemented', mode: 'none' },
    sourceMapping: false,
    prerequisites: [],
  },
  durationMs: 412,
};

const formatData: CompareFormatData = {
  result: baseDiffResult,
  device: { name: 'Pixel_8', platform: 'android' },
  artifactDir: '.drift/runs/abc123',
};

const emptyData: CompareFormatData = {
  result: { ...baseDiffResult, diffPixels: 0, diffPercentage: 0, regions: [], findings: [] },
  device: { name: 'Pixel_8', platform: 'android' },
  artifactDir: '.drift/runs/abc123',
};

describe('compareFormatter', () => {
  describe('terminal', () => {
    it('renders diff summary and findings', () => {
      const output = compareFormatter.terminal(formatData);
      expect(output).toContain('2.34%');
      expect(output).toContain('412ms');
      expect(output).toContain('MAJOR');
      expect(output).toContain('SubmitButton');
      expect(output).toContain('submit-btn');
      expect(output).toContain('MINOR');
    });

    it('shows summary line with severity counts', () => {
      const output = compareFormatter.terminal(formatData);
      expect(output).toContain('1 major');
      expect(output).toContain('1 minor');
    });

    it('shows confidence labels', () => {
      const output = compareFormatter.terminal(formatData);
      expect(output).toContain('probable');
      expect(output).toContain('approximate');
    });

    it('shows no-diff message when empty', () => {
      const output = compareFormatter.terminal(emptyData);
      expect(output).toContain('No differences found');
    });

    it('shows run ID', () => {
      const output = compareFormatter.terminal(formatData);
      expect(output).toContain('abc123');
    });
  });

  describe('markdown', () => {
    it('renders full report', () => {
      const output = compareFormatter.markdown(formatData);
      expect(output).toContain('# Drift Compare Report');
      expect(output).toContain('Pixel_8');
      expect(output).toContain('## Findings');
      expect(output).toContain('SubmitButton');
      expect(output).toContain('.drift/runs/abc123/diff-mask.png');
    });

    it('includes artifact paths', () => {
      const output = compareFormatter.markdown(formatData);
      expect(output).toContain('.drift/runs/abc123/screenshot.png');
      expect(output).toContain('.drift/runs/abc123/regions/r-0.png');
    });

    it('includes git info when available', () => {
      const data: CompareFormatData = {
        ...formatData,
        result: {
          ...baseDiffResult,
          metadata: { ...baseDiffResult.metadata, gitCommit: 'abc1234', gitBranch: 'main' },
        },
      };
      const output = compareFormatter.markdown(data);
      expect(output).toContain('abc1234');
      expect(output).toContain('main');
    });

    it('handles no-diff case', () => {
      const output = compareFormatter.markdown(emptyData);
      expect(output).toContain('No differences found');
      expect(output).not.toContain('## Findings');
    });
  });

  describe('json', () => {
    it('outputs full format data as JSON', () => {
      const output = compareFormatter.json(formatData);
      const parsed = JSON.parse(output);
      expect(parsed.result.runId).toBe('abc123');
      expect(parsed.device.name).toBe('Pixel_8');
      expect(parsed.artifactDir).toBe('.drift/runs/abc123');
    });
  });
});
