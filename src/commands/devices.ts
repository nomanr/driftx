import type { DeviceInfo } from '../types.js';

export function formatDeviceTable(devices: DeviceInfo[]): string {
  if (devices.length === 0) {
    return 'No devices found. Start an emulator or connect a device.';
  }

  const lines: string[] = [];
  const header = `  ${'ID'.padEnd(20)} ${'Name'.padEnd(20)} ${'Platform'.padEnd(10)} ${'OS'.padEnd(10)} ${'State'}`;
  const separator = '  ' + '-'.repeat(70);

  lines.push('');
  lines.push(header);
  lines.push(separator);

  for (const d of devices) {
    const state = d.state === 'booted' ? '● booted' : d.state === 'offline' ? '○ offline' : '✗ unauthorized';
    lines.push(`  ${d.id.padEnd(20)} ${d.name.padEnd(20)} ${d.platform.padEnd(10)} ${(d.osVersion || '-').padEnd(10)} ${state}`);
  }

  lines.push('');
  return lines.join('\n');
}
