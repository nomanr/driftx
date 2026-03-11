import type { Shell, PrerequisiteCheck } from './types.js';

interface PrerequisiteSpec {
  name: string;
  cmd: string;
  args: string[];
  required: boolean;
  versionParser: (stdout: string) => string;
  fix: string;
}

const CLI_PREREQUISITES: PrerequisiteSpec[] = [
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

async function checkMetro(port: number): Promise<PrerequisiteCheck> {
  try {
    const { default: http } = await import('node:http');
    const status = await new Promise<string>((resolve, reject) => {
      const req = http.get(`http://localhost:${port}/status`, { timeout: 2000 }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
    return {
      name: 'metro',
      required: false,
      available: true,
      version: `running on :${port}`,
    };
  } catch {
    return {
      name: 'metro',
      required: false,
      available: false,
      fix: 'Start Metro bundler: npx react-native start',
    };
  }
}

export async function checkPrerequisites(shell: Shell, metroPort = 8081): Promise<PrerequisiteCheck[]> {
  const cliChecks = CLI_PREREQUISITES.map((spec) => checkOne(spec, shell));
  const metro = checkMetro(metroPort);
  return Promise.all([...cliChecks, metro]);
}
