import type { RunMetadata } from '../types.js';

type Framework = RunMetadata['framework'];

export function detectFramework(files: string[], packageJson?: Record<string, unknown>): Framework {
  if (packageJson) {
    const deps = {
      ...(packageJson.dependencies as Record<string, string> | undefined),
      ...(packageJson.devDependencies as Record<string, string> | undefined),
    };
    if (deps['react-native']) {
      return 'react-native';
    }
  }

  const hasGradle = files.some((f) => f.endsWith('.gradle') || f.endsWith('.gradle.kts'));
  if (hasGradle) return 'native-android';

  const hasXcode = files.some((f) => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'));
  if (hasXcode) return 'native-ios';

  return 'unknown';
}

interface InitConfig {
  framework: Framework;
  threshold: number;
  diffThreshold: number;
  settleTimeMs: number;
  platform: 'android' | 'ios';
  metroPort?: number;
  viewport: {
    cropStatusBar: boolean;
    cropNavigationBar: boolean;
  };
}

export function generateConfig(framework: Framework): InitConfig {
  const base = {
    threshold: 0.1,
    diffThreshold: 0.01,
    settleTimeMs: 300,
    viewport: {
      cropStatusBar: true,
      cropNavigationBar: true,
    },
  };

  switch (framework) {
    case 'react-native':
      return { ...base, framework, platform: 'android', metroPort: 8081 };
    case 'native-android':
      return { ...base, framework, platform: 'android' };
    case 'native-ios':
      return { ...base, framework, platform: 'ios' };
    default:
      return { ...base, framework, platform: 'android' };
  }
}
