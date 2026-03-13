import type { DeviceInfo, ComponentNode } from '../types.js';
import type { InteractionBackend, InteractionResult, SwipeDirection } from './types.js';
import { resolveTarget } from './resolver.js';

export class GestureExecutor {
  constructor(private backend: InteractionBackend) {}

  async tap(device: DeviceInfo, tree: ComponentNode[], query: string): Promise<InteractionResult> {
    const start = Date.now();
    try {
      const target = resolveTarget(tree, query);
      if (!target) {
        return { success: false, action: 'tap', durationMs: Date.now() - start, error: `Target not found: ${query}` };
      }
      await this.backend.tap(device, target);
      return { success: true, action: 'tap', target, durationMs: Date.now() - start };
    } catch (e) {
      return { success: false, action: 'tap', durationMs: Date.now() - start, error: String(e) };
    }
  }

  async tapXY(device: DeviceInfo, x: number, y: number): Promise<InteractionResult> {
    const start = Date.now();
    try {
      const target = { x, y };
      await this.backend.tap(device, target);
      return { success: true, action: 'tapXY', target, durationMs: Date.now() - start };
    } catch (e) {
      return { success: false, action: 'tapXY', durationMs: Date.now() - start, error: String(e) };
    }
  }

  async longPress(device: DeviceInfo, tree: ComponentNode[], query: string, durationMs = 1000): Promise<InteractionResult> {
    const start = Date.now();
    try {
      const target = resolveTarget(tree, query);
      if (!target) {
        return { success: false, action: 'longPress', durationMs: Date.now() - start, error: `Target not found: ${query}` };
      }
      await this.backend.longPress(device, target, durationMs);
      return { success: true, action: 'longPress', target, durationMs: Date.now() - start };
    } catch (e) {
      return { success: false, action: 'longPress', durationMs: Date.now() - start, error: String(e) };
    }
  }

  async swipe(device: DeviceInfo, direction: SwipeDirection, distance?: number, durationMs = 300): Promise<InteractionResult> {
    const start = Date.now();
    try {
      const isIos = device.platform === 'ios';
      const cx = device.screenSize?.width ? Math.round(device.screenSize.width / 2) : (isIos ? 197 : 540);
      const cy = device.screenSize?.height ? Math.round(device.screenSize.height / 2) : (isIos ? 426 : 960);
      const actualDistance = distance ?? (isIos ? 300 : 600);
      const from = { x: cx, y: cy };
      const half = Math.round(actualDistance / 2);
      const to = direction === 'up'    ? { x: cx, y: cy - half }
               : direction === 'down'  ? { x: cx, y: cy + half }
               : direction === 'left'  ? { x: cx - half, y: cy }
               :                        { x: cx + half, y: cy };
      await this.backend.swipe(device, from, to, durationMs);
      return { success: true, action: 'swipe', durationMs: Date.now() - start };
    } catch (e) {
      return { success: false, action: 'swipe', durationMs: Date.now() - start, error: String(e) };
    }
  }

  async typeInto(device: DeviceInfo, tree: ComponentNode[], query: string, text: string): Promise<InteractionResult> {
    const start = Date.now();
    try {
      const target = resolveTarget(tree, query);
      if (!target) {
        return { success: false, action: 'typeInto', durationMs: Date.now() - start, error: `Target not found: ${query}` };
      }
      await this.backend.tap(device, target);
      await this.backend.type(device, text);
      return { success: true, action: 'typeInto', target, durationMs: Date.now() - start };
    } catch (e) {
      return { success: false, action: 'typeInto', durationMs: Date.now() - start, error: String(e) };
    }
  }

  async goBack(device: DeviceInfo): Promise<InteractionResult> {
    const start = Date.now();
    try {
      const key = device.platform === 'android' ? 'KEYCODE_BACK' : 'home';
      await this.backend.keyEvent(device, key);
      return { success: true, action: 'goBack', durationMs: Date.now() - start };
    } catch (e) {
      return { success: false, action: 'goBack', durationMs: Date.now() - start, error: String(e) };
    }
  }

  async openUrl(device: DeviceInfo, url: string): Promise<InteractionResult> {
    const start = Date.now();
    try {
      await this.backend.openUrl(device, url);
      return { success: true, action: 'openUrl', durationMs: Date.now() - start };
    } catch (e) {
      return { success: false, action: 'openUrl', durationMs: Date.now() - start, error: String(e) };
    }
  }
}
