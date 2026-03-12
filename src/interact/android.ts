import type { Shell, DeviceInfo } from '../types.js';
import type { Point, InteractionBackend } from './types.js';

export class AndroidBackend implements InteractionBackend {
  constructor(private shell: Shell) {}

  async tap(device: DeviceInfo, point: Point): Promise<void> {
    await this.adb(device, ['input', 'tap', String(point.x), String(point.y)]);
  }

  async longPress(device: DeviceInfo, point: Point, durationMs: number): Promise<void> {
    await this.adb(device, ['input', 'swipe', String(point.x), String(point.y), String(point.x), String(point.y), String(durationMs)]);
  }

  async swipe(device: DeviceInfo, from: Point, to: Point, durationMs: number): Promise<void> {
    await this.adb(device, ['input', 'swipe', String(from.x), String(from.y), String(to.x), String(to.y), String(durationMs)]);
  }

  async type(device: DeviceInfo, text: string): Promise<void> {
    const escaped = text.replace(/ /g, '%s');
    await this.adb(device, ['input', 'text', escaped]);
  }

  async keyEvent(device: DeviceInfo, key: string): Promise<void> {
    await this.adb(device, ['input', 'keyevent', key]);
  }

  async openUrl(device: DeviceInfo, url: string): Promise<void> {
    await this.shell.exec('adb', ['-s', device.id, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url]);
  }

  private async adb(device: DeviceInfo, inputArgs: string[]): Promise<void> {
    await this.shell.exec('adb', ['-s', device.id, 'shell', ...inputArgs]);
  }
}
