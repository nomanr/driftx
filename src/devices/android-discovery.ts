import type { DeviceInfo, Shell } from '../types.js';

export function parseAdbDevices(output: string): DeviceInfo[] {
  const devices: DeviceInfo[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    if (line.startsWith('List of devices') || line.trim() === '') continue;

    const match = line.match(/^(\S+)\s+(device|offline|unauthorized)(.*)$/);
    if (!match) continue;

    const [, id, rawState, rest] = match;

    const modelMatch = rest.match(/model:(\S+)/);
    const transportMatch = rest.match(/transport_id:(\S+)/);

    const state: DeviceInfo['state'] =
      rawState === 'device' ? 'booted' :
      rawState === 'offline' ? 'offline' : 'unauthorized';

    devices.push({
      id,
      name: modelMatch?.[1] ?? id,
      platform: 'android',
      osVersion: '',
      state,
      transport: transportMatch?.[1],
    });
  }

  return devices;
}

async function fetchApiLevel(shell: Shell, deviceId: string): Promise<string> {
  try {
    const { stdout } = await shell.exec('adb', ['-s', deviceId, 'shell', 'getprop', 'ro.build.version.sdk']);
    return stdout.trim();
  } catch {
    return '';
  }
}

export async function discoverAndroidDevices(shell: Shell): Promise<DeviceInfo[]> {
  const { stdout } = await shell.exec('adb', ['devices', '-l']);
  const devices = parseAdbDevices(stdout);

  for (const device of devices) {
    if (device.state === 'booted') {
      device.osVersion = await fetchApiLevel(shell, device.id);
    }
  }

  return devices;
}
