import type { Shell, PrerequisiteCheck } from './types.js';

interface PrerequisiteSpec {
  name: string;
  cmd: string;
  args: string[];
  required: boolean;
  versionParser: (stdout: string) => string;
  fix: string;
}

const PREREQUISITES: PrerequisiteSpec[] = [
  {
    name: 'node',
    cmd: 'node',
    args: ['--version'],
    required: true,
    versionParser: (stdout) => stdout.trim().replace(/^v/, ''),
    fix: 'Install Node.js >= 18 from https://nodejs.org',
  },
  {
    name: 'adb',
    cmd: 'adb',
    args: ['--version'],
    required: false,
    versionParser: (stdout) => {
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      return match?.[1] ?? 'unknown';
    },
    fix: 'Install Android SDK Platform-Tools: https://developer.android.com/studio',
  },
  {
    name: 'xcrun',
    cmd: 'xcrun',
    args: ['--version'],
    required: false,
    versionParser: (stdout) => stdout.trim(),
    fix: 'Install Xcode Command Line Tools: xcode-select --install',
  },
  {
    name: 'metro',
    cmd: 'npx',
    args: ['react-native', 'info'],
    required: false,
    versionParser: (stdout) => stdout.trim(),
    fix: 'Start Metro bundler: npx react-native start',
  },
];

async function checkOne(spec: PrerequisiteSpec, shell: Shell): Promise<PrerequisiteCheck> {
  try {
    const { stdout } = await shell.exec(spec.cmd, spec.args, { timeout: 5000 });
    return {
      name: spec.name,
      required: spec.required,
      available: true,
      version: spec.versionParser(stdout),
    };
  } catch (err) {
    return {
      name: spec.name,
      required: spec.required,
      available: false,
      error: err instanceof Error ? err.message : String(err),
      fix: spec.fix,
    };
  }
}

export async function checkPrerequisites(shell: Shell): Promise<PrerequisiteCheck[]> {
  return Promise.all(PREREQUISITES.map((spec) => checkOne(spec, shell)));
}
