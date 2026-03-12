import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GestureExecutor } from '../../../src/interact/gestures.js';
import type { InteractionBackend } from '../../../src/interact/types.js';
import type { DeviceInfo, ComponentNode } from '../../../src/types.js';

const tree: ComponentNode[] = [{
  id: '1', name: 'LoginButton', testID: 'login-btn',
  bounds: { x: 50, y: 100, width: 200, height: 44 },
  children: [], inspectionTier: 'detailed',
}];

function makeDevice(platform: 'android' | 'ios' = 'android'): DeviceInfo {
  return { id: 'dev-1', name: 'Test Device', platform, osVersion: '14', state: 'booted' };
}

function makeMockBackend(): InteractionBackend {
  return {
    tap: vi.fn().mockResolvedValue(undefined),
    longPress: vi.fn().mockResolvedValue(undefined),
    swipe: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    keyEvent: vi.fn().mockResolvedValue(undefined),
    openUrl: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GestureExecutor', () => {
  let backend: InteractionBackend;
  let gestures: GestureExecutor;

  beforeEach(() => {
    backend = makeMockBackend();
    gestures = new GestureExecutor(backend);
  });

  it('taps a target by testID', async () => {
    const device = makeDevice();
    const result = await gestures.tap(device, tree, 'login-btn');
    expect(result.success).toBe(true);
    expect(backend.tap).toHaveBeenCalledWith(device, { x: 150, y: 122, resolvedFrom: 'testID:login-btn' });
  });

  it('returns error when target not found', async () => {
    const device = makeDevice();
    const result = await gestures.tap(device, tree, 'missing-id');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Target not found/);
    expect(backend.tap).not.toHaveBeenCalled();
  });

  it('taps by raw coordinates', async () => {
    const device = makeDevice();
    const result = await gestures.tapXY(device, 100, 200);
    expect(result.success).toBe(true);
    expect(backend.tap).toHaveBeenCalledWith(device, { x: 100, y: 200 });
  });

  it('swipes in a direction', async () => {
    const device = makeDevice();
    const result = await gestures.swipe(device, 'up');
    expect(result.success).toBe(true);
    expect(backend.swipe).toHaveBeenCalledWith(
      device,
      { x: 540, y: 960 },
      { x: 540, y: 660 },
      300,
    );
  });

  it('types text into a target', async () => {
    const device = makeDevice();
    const result = await gestures.typeInto(device, tree, 'login-btn', 'hello');
    expect(result.success).toBe(true);
    expect(backend.tap).toHaveBeenCalledWith(device, { x: 150, y: 122, resolvedFrom: 'testID:login-btn' });
    expect(backend.type).toHaveBeenCalledWith(device, 'hello');
  });

  it('goes back using the platform-appropriate key', async () => {
    const android = makeDevice('android');
    await gestures.goBack(android);
    expect(backend.keyEvent).toHaveBeenCalledWith(android, 'KEYCODE_BACK');

    const ios = makeDevice('ios');
    await gestures.goBack(ios);
    expect(backend.keyEvent).toHaveBeenCalledWith(ios, 'home');
  });

  it('opens a URL', async () => {
    const device = makeDevice();
    const result = await gestures.openUrl(device, 'myapp://screen/home');
    expect(result.success).toBe(true);
    expect(backend.openUrl).toHaveBeenCalledWith(device, 'myapp://screen/home');
  });
});
