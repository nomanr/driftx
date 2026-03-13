import { describe, it, expect } from 'vitest';
import { shouldCheck, formatUpdateMessage } from '../../src/update-notifier.js';

describe('shouldCheck', () => {
  it('returns true when no cache exists', () => {
    expect(shouldCheck(null)).toBe(true);
  });

  it('returns true when cache is older than 24h', () => {
    const old = Date.now() - 25 * 60 * 60 * 1000;
    expect(shouldCheck({ lastCheck: old, latestVersion: '1.0.0' })).toBe(true);
  });

  it('returns false when cache is fresh', () => {
    const recent = Date.now() - 1 * 60 * 60 * 1000;
    expect(shouldCheck({ lastCheck: recent, latestVersion: '1.0.0' })).toBe(false);
  });
});

describe('formatUpdateMessage', () => {
  it('returns message when latest > current', () => {
    const msg = formatUpdateMessage('0.1.0', '0.2.0');
    expect(msg).toContain('0.1.0');
    expect(msg).toContain('0.2.0');
    expect(msg).toContain('npm install -g driftx');
  });

  it('returns null when current >= latest', () => {
    expect(formatUpdateMessage('1.0.0', '1.0.0')).toBeNull();
    expect(formatUpdateMessage('1.1.0', '1.0.0')).toBeNull();
  });
});
