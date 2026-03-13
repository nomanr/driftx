import { describe, it, expect } from 'vitest';
import { resolveLaunchStrategy } from '../../../src/ios-companion/launcher.js';

const base = {
  prebuiltDir: '/pkg/ios-companion/prebuilt',
  sourceDir: '/pkg/ios-companion',
  sourceExists: true,
};

describe('resolveLaunchStrategy', () => {
  it('returns prebuilt strategy when prebuilt exists and Xcode matches', () => {
    const result = resolveLaunchStrategy({
      ...base, prebuiltExists: true, buildInfoXcodeMajor: 16, localXcodeMajor: 16,
    });
    expect(result.type).toBe('prebuilt');
    expect(result.prebuiltDir).toBe('/pkg/ios-companion/prebuilt');
  });

  it('returns source strategy when Xcode major version differs', () => {
    const result = resolveLaunchStrategy({
      ...base, prebuiltExists: true, buildInfoXcodeMajor: 15, localXcodeMajor: 16,
    });
    expect(result.type).toBe('source');
    expect(result.reason).toContain('Xcode');
  });

  it('returns source strategy when prebuilt dir missing', () => {
    const result = resolveLaunchStrategy({
      ...base, prebuiltExists: false, buildInfoXcodeMajor: null, localXcodeMajor: 16,
    });
    expect(result.type).toBe('source');
  });

  it('returns source strategy when build-info.json has no xcodeMajor', () => {
    const result = resolveLaunchStrategy({
      ...base, prebuiltExists: true, buildInfoXcodeMajor: null, localXcodeMajor: 16,
    });
    expect(result.type).toBe('source');
  });

  it('returns error when no Xcode and no prebuilt', () => {
    const result = resolveLaunchStrategy({
      ...base, prebuiltExists: false, buildInfoXcodeMajor: null, localXcodeMajor: null,
    });
    expect(result.type).toBe('error');
    expect(result.reason).toContain('Xcode is required');
  });

  it('tries prebuilt when no Xcode but prebuilt exists', () => {
    const result = resolveLaunchStrategy({
      ...base, prebuiltExists: true, buildInfoXcodeMajor: 16, localXcodeMajor: null,
    });
    expect(result.type).toBe('prebuilt');
  });
});
