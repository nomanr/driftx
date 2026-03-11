import { describe, it, expect } from 'vitest';
import { parseSimctlDevices } from '../../../src/devices/ios-discovery.js';
import { simctlFixtures } from '../../fixtures/simctl-output.js';

describe('parseSimctlDevices', () => {
  it('parses two simulators', () => {
    const devices = parseSimctlDevices(simctlFixtures.twoSimulators);
    expect(devices).toHaveLength(2);
    expect(devices[0].id).toBe('ABC-DEF-123');
    expect(devices[0].name).toBe('iPhone 15');
    expect(devices[0].platform).toBe('ios');
    expect(devices[0].state).toBe('booted');
  });

  it('returns empty for no simulators', () => {
    const devices = parseSimctlDevices(simctlFixtures.noSimulators);
    expect(devices).toHaveLength(0);
  });

  it('extracts OS version from runtime', () => {
    const devices = parseSimctlDevices(simctlFixtures.singleBooted);
    expect(devices[0].osVersion).toBe('17.2');
  });

  it('maps shutdown to offline', () => {
    const devices = parseSimctlDevices(simctlFixtures.twoSimulators);
    expect(devices[1].state).toBe('offline');
  });

  it('excludes unavailable devices', () => {
    const devices = parseSimctlDevices(simctlFixtures.unavailableDevice);
    expect(devices).toHaveLength(0);
  });

  it('handles malformed JSON gracefully', () => {
    const devices = parseSimctlDevices('not json');
    expect(devices).toHaveLength(0);
  });
});
