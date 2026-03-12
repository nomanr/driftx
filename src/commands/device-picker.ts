import { select } from '@inquirer/prompts';
import type { DeviceInfo } from '../types.js';

export async function pickDevice(booted: DeviceInfo[]): Promise<DeviceInfo> {
  if (booted.length === 1) return booted[0];

  const selected = await select({
    message: 'Select a device',
    choices: booted.map((d) => ({
      name: `${d.name}  (${d.platform}, ${d.osVersion || 'unknown'})`,
      value: d.id,
    })),
  });

  return booted.find((d) => d.id === selected)!;
}
