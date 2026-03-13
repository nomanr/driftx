import type { Shell, DeviceInfo } from '../types.js';
import type { Point, InteractionBackend } from './types.js';
import type { CompanionClient } from '../ios-companion/client.js';

export class IosBackend implements InteractionBackend {
  constructor(private shell: Shell, private companion: CompanionClient) {}

  async tap(_device: DeviceInfo, point: Point): Promise<void> {
    await this.companion.tap(point.x, point.y);
  }

  async longPress(_device: DeviceInfo, point: Point, durationMs: number): Promise<void> {
    await this.companion.longPress(point.x, point.y, durationMs);
  }

  async swipe(_device: DeviceInfo, from: Point, to: Point, durationMs: number): Promise<void> {
    await this.companion.swipe(from.x, from.y, to.x, to.y, durationMs);
  }

  async type(_device: DeviceInfo, text: string): Promise<void> {
    await this.companion.type(text);
  }

  async keyEvent(_device: DeviceInfo, key: string): Promise<void> {
    await this.companion.keyEvent(key);
  }

  async openUrl(device: DeviceInfo, url: string): Promise<void> {
    await this.shell.exec('xcrun', ['simctl', 'openurl', device.id, url]);
  }
}
