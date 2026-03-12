import { describe, it, expect } from 'vitest';
import { doctorFormatter } from '../../../src/formatters/doctor.js';
import type { PrerequisiteCheck } from '../../../src/types.js';

const checks: PrerequisiteCheck[] = [
  { name: 'node', required: true, available: true, version: '20.11.0' },
  { name: 'adb', required: false, available: true, version: '34.0.5' },
  { name: 'metro', required: false, available: false, fix: 'npx react-native start' },
];

describe('doctorFormatter', () => {
  describe('terminal', () => {
    it('shows pass/fail icons with colors', () => {
      const output = doctorFormatter.terminal(checks);
      expect(output).toContain('node');
      expect(output).toContain('20.11.0');
      expect(output).toContain('metro');
      expect(output).toContain('missing');
    });

    it('includes fix instructions for missing tools', () => {
      const output = doctorFormatter.terminal(checks);
      expect(output).toContain('npx react-native start');
    });
  });

  describe('markdown', () => {
    it('renders markdown table with fix column', () => {
      const output = doctorFormatter.markdown(checks);
      expect(output).toContain('# Driftx Doctor');
      expect(output).toContain('| node');
      expect(output).toContain('available');
      expect(output).toContain('unavailable');
    });
  });

  describe('json', () => {
    it('outputs valid JSON array', () => {
      const output = doctorFormatter.json(checks);
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(3);
      expect(parsed[2].available).toBe(false);
    });
  });
});
