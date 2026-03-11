import type { DeviceInfo, Shell } from '../types.js';
import { discoverAndroidDevices } from './android-discovery.js';
import { discoverIosDevices } from './ios-discovery.js';
import { getLogger } from '../logger.js';

interface DiscoveryOptions {
  cacheTtlMs?: number;
}

export class DeviceDiscovery {
  private shell: Shell;
  private cacheTtlMs: number;
  private cache: DeviceInfo[] | null = null;
  private cacheTime = 0;

  constructor(shell: Shell, options?: DiscoveryOptions) {
    this.shell = shell;
    this.cacheTtlMs = options?.cacheTtlMs ?? 30000;
  }

  async list(): Promise<DeviceInfo[]> {
    if (this.cache && Date.now() - this.cacheTime < this.cacheTtlMs) {
      return this.cache;
    }

    const results: DeviceInfo[] = [];
    const logger = getLogger();

    try {
      const android = await discoverAndroidDevices(this.shell);
      results.push(...android);
    } catch (err) {
      logger.debug({ err }, 'Android discovery failed');
    }

    try {
      const ios = await discoverIosDevices(this.shell);
      results.push(...ios);
    } catch (err) {
      logger.debug({ err }, 'iOS discovery failed');
    }

    this.cache = results;
    this.cacheTime = Date.now();
    return results;
  }

  async findById(id: string): Promise<DeviceInfo | undefined> {
    const devices = await this.list();
    return devices.find((d) => d.id === id);
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
