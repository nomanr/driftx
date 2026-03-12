import { describe, it, expect } from 'vitest';
import { devicesFormatter } from '../../../src/formatters/devices.js';
import type { DeviceInfo } from '../../../src/types.js';

const devices: DeviceInfo[] = [
  { id: 'emulator-5554', name: 'Pixel_8', platform: 'android', osVersion: '34', state: 'booted' },
  { id: 'ABC-DEF-123', name: 'iPhone 16 Pro', platform: 'ios', osVersion: '18.0', state: 'booted' },
];

describe('devicesFormatter', () => {
  describe('terminal', () => {
    it('renders device table with state indicators', () => {
      const output = devicesFormatter.terminal(devices);
      expect(output).toContain('Pixel_8');
      expect(output).toContain('iPhone 16 Pro');
      expect(output).toContain('booted');
    });

    it('shows message for empty list', () => {
      const output = devicesFormatter.terminal([]);
      expect(output).toContain('No devices found');
    });
  });

  describe('markdown', () => {
    it('renders markdown table', () => {
      const output = devicesFormatter.markdown(devices);
      expect(output).toContain('# Drift Devices');
      expect(output).toContain('| emulator-5554');
      expect(output).toContain('| ABC-DEF-123');
    });

    it('shows message for empty list', () => {
      const output = devicesFormatter.markdown([]);
      expect(output).toContain('No devices found');
    });
  });

  describe('json', () => {
    it('outputs valid JSON array', () => {
      const output = devicesFormatter.json(devices);
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('emulator-5554');
    });
  });
});
