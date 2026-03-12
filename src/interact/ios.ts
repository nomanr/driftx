import type { Shell, DeviceInfo } from '../types.js';
import type { Point, InteractionBackend } from './types.js';

export class IosBackend implements InteractionBackend {
  constructor(private shell: Shell) {}

  async tap(device: DeviceInfo, point: Point): Promise<void> {
    await this.simctlIo(device, ['tap', String(point.x), String(point.y)]);
  }

  async longPress(device: DeviceInfo, point: Point, _durationMs: number): Promise<void> {
    await this.simctlIo(device, ['longpress', String(point.x), String(point.y)]);
  }

  async swipe(device: DeviceInfo, from: Point, to: Point, _durationMs: number): Promise<void> {
    await this.simctlIo(device, ['swipe', String(from.x), String(from.y), String(to.x), String(to.y)]);
  }

  async type(device: DeviceInfo, text: string): Promise<void> {
    await this.simctlIo(device, ['type', text]);
  }

  async keyEvent(device: DeviceInfo, key: string): Promise<void> {
    await this.simctlIo(device, ['sendkey', key]);
  }

  async openUrl(device: DeviceInfo, url: string): Promise<void> {
    await this.shell.exec('xcrun', ['simctl', 'openurl', device.id, url]);
  }

  private async simctlIo(device: DeviceInfo, args: string[]): Promise<void> {
    await this.shell.exec('xcrun', ['simctl', 'io', device.id, ...args]);
  }
}
