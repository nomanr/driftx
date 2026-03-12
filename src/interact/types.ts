import type { DeviceInfo } from '../types.js';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface TapTarget {
  x: number;
  y: number;
  resolvedFrom?: string;
}

export interface InteractionResult {
  success: boolean;
  action: string;
  target?: TapTarget;
  durationMs: number;
  error?: string;
}

export interface InteractionBackend {
  tap(device: DeviceInfo, point: Point): Promise<void>;
  longPress(device: DeviceInfo, point: Point, durationMs: number): Promise<void>;
  swipe(device: DeviceInfo, from: Point, to: Point, durationMs: number): Promise<void>;
  type(device: DeviceInfo, text: string): Promise<void>;
  keyEvent(device: DeviceInfo, key: string): Promise<void>;
  openUrl(device: DeviceInfo, url: string): Promise<void>;
}
