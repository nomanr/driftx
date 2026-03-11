import { describe, it, expect } from 'vitest';
import { detectFramework, generateConfig } from '../../../src/commands/init.js';

describe('detectFramework', () => {
  it('detects react-native from package.json', () => {
    const result = detectFramework([], { dependencies: { 'react-native': '^0.73.0' } });
    expect(result).toBe('react-native');
  });

  it('detects native-android from gradle files', () => {
    const result = detectFramework(['build.gradle', 'settings.gradle']);
    expect(result).toBe('native-android');
  });

  it('detects native-ios from xcodeproj', () => {
    const result = detectFramework(['MyApp.xcodeproj', 'Podfile']);
    expect(result).toBe('native-ios');
  });

  it('returns unknown when nothing matches', () => {
    const result = detectFramework(['README.md']);
    expect(result).toBe('unknown');
  });
});

describe('generateConfig', () => {
  it('generates config for react-native', () => {
    const config = generateConfig('react-native');
    const parsed = JSON.parse(JSON.stringify(config));
    expect(parsed.framework).toBe('react-native');
    expect(parsed.threshold).toBeDefined();
    expect(parsed.diffThreshold).toBeDefined();
    expect(parsed.settleTimeMs).toBeDefined();
    expect(parsed.viewport.cropStatusBar).toBe(true);
  });

  it('generates config for native-android', () => {
    const config = generateConfig('native-android');
    const parsed = JSON.parse(JSON.stringify(config));
    expect(parsed.framework).toBe('native-android');
    expect(parsed.platform).toBe('android');
  });

  it('generates config for native-ios', () => {
    const config = generateConfig('native-ios');
    const parsed = JSON.parse(JSON.stringify(config));
    expect(parsed.framework).toBe('native-ios');
    expect(parsed.platform).toBe('ios');
  });

  it('generates config for unknown framework', () => {
    const config = generateConfig('unknown');
    const parsed = JSON.parse(JSON.stringify(config));
    expect(parsed.framework).toBe('unknown');
    expect(parsed.threshold).toBeDefined();
  });
});
