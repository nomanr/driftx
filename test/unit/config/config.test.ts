import { describe, it, expect } from 'vitest';
import { parseConfig, configSchema, getDefaultConfig } from '../../../src/config.js';

describe('config', () => {
  it('returns defaults when no config provided', () => {
    const config = getDefaultConfig();
    expect(config.threshold).toBe(0.1);
    expect(config.settleTimeMs).toBe(300);
    expect(config.timeouts.deviceDiscoveryMs).toBe(5000);
  });

  it('parses valid config', () => {
    const result = configSchema.safeParse({ threshold: 0.2, settleTimeMs: 500 });
    expect(result.success).toBe(true);
  });

  it('rejects invalid threshold type', () => {
    const result = configSchema.safeParse({ threshold: 'not-a-number' });
    expect(result.success).toBe(false);
  });

  it('merges partial config with defaults', () => {
    const config = parseConfig({ threshold: 0.5 });
    expect(config.threshold).toBe(0.5);
    expect(config.settleTimeMs).toBe(300);
  });

  it('rejects threshold out of range', () => {
    const result = configSchema.safeParse({ threshold: 2.0 });
    expect(result.success).toBe(false);
  });

  it('rejects deeply nested invalid values', () => {
    const result = configSchema.safeParse({ timeouts: { deviceDiscoveryMs: 'fast' } });
    expect(result.success).toBe(false);
  });

  it('coerces number from number type only', () => {
    const result = configSchema.safeParse({ metroPort: '8081' });
    expect(result.success).toBe(false);
  });

  it('parses analyses config section', () => {
    const config = parseConfig({
      analyses: {
        default: ['pixel', 'a11y'],
        options: {
          pixel: { threshold: 0.2 },
        },
      },
    });
    expect(config.analyses.default).toEqual(['pixel', 'a11y']);
    expect(config.analyses.options.pixel).toEqual({ threshold: 0.2 });
  });

  it('provides analyses defaults when not specified', () => {
    const config = parseConfig({});
    expect(config.analyses.default).toEqual([]);
    expect(config.analyses.disabled).toEqual([]);
    expect(config.analyses.options).toEqual({});
  });
});
