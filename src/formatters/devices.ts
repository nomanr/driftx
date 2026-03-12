import pc from 'picocolors';
import type { DeviceInfo } from '../types.js';
import type { OutputFormatter } from './types.js';

function stateLabel(state: DeviceInfo['state']): string {
  if (state === 'booted') return pc.green('● booted');
  if (state === 'offline') return pc.yellow('○ offline');
  return pc.red('✗ unauthorized');
}

function stateText(state: DeviceInfo['state']): string {
  if (state === 'booted') return 'booted';
  if (state === 'offline') return 'offline';
  return 'unauthorized';
}

export const devicesFormatter: OutputFormatter<DeviceInfo[]> = {
  terminal(devices) {
    if (devices.length === 0) {
      return 'No devices found. Start an emulator or connect a device.';
    }
    const lines: string[] = [];
    const header = `  ${'ID'.padEnd(20)} ${'Name'.padEnd(20)} ${'Platform'.padEnd(10)} ${'OS'.padEnd(10)} ${'State'}`;
    lines.push('');
    lines.push(header);
    lines.push('  ' + '-'.repeat(70));
    for (const d of devices) {
      lines.push(`  ${d.id.padEnd(20)} ${d.name.padEnd(20)} ${d.platform.padEnd(10)} ${(d.osVersion || '-').padEnd(10)} ${stateLabel(d.state)}`);
    }
    lines.push('');
    return lines.join('\n');
  },

  markdown(devices) {
    if (devices.length === 0) {
      return '# Driftx Devices\n\nNo devices found. Start an emulator or connect a device.';
    }
    const lines: string[] = ['# Driftx Devices', '', '| ID | Name | Platform | OS | State |', '|----|------|----------|-----|-------|'];
    for (const d of devices) {
      lines.push(`| ${d.id} | ${d.name} | ${d.platform} | ${d.osVersion || '-'} | ${stateText(d.state)} |`);
    }
    return lines.join('\n');
  },

  json(devices) {
    return JSON.stringify(devices, null, 2);
  },
};
