import type { DeviceInfo, Shell } from '../types.js';

interface SimctlDevice {
  udid: string;
  name: string;
  state: string;
  isAvailable: boolean;
}

interface SimctlOutput {
  devices: Record<string, SimctlDevice[]>;
}

function parseOsVersion(runtime: string): string {
  const match = runtime.match(/iOS-(\d+)-(\d+)/);
  return match ? `${match[1]}.${match[2]}` : '';
}

export function parseSimctlDevices(output: string): DeviceInfo[] {
  let parsed: SimctlOutput;
  try {
    parsed = JSON.parse(output);
  } catch {
    return [];
  }

  const devices: DeviceInfo[] = [];

  for (const [runtime, sims] of Object.entries(parsed.devices)) {
    const osVersion = parseOsVersion(runtime);

    for (const sim of sims) {
      if (!sim.isAvailable) continue;

      const state: DeviceInfo['state'] =
        sim.state === 'Booted' ? 'booted' : 'offline';

      devices.push({
        id: sim.udid,
        name: sim.name,
        platform: 'ios',
        osVersion,
        state,
      });
    }
  }

  return devices;
}

export async function discoverIosDevices(shell: Shell): Promise<DeviceInfo[]> {
  const { stdout } = await shell.exec('xcrun', ['simctl', 'list', 'devices', '--json']);
  return parseSimctlDevices(stdout);
}
