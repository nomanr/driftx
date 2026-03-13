import type { Shell, DeviceInfo, ComponentNode, InspectionCapabilities } from '../types.js';
import { dumpUiAutomator } from './uiautomator.js';
import { dumpIosAccessibility } from './ios-accessibility.js';
import { CdpClient, discoverTargets, findRuntimeTarget } from './cdp-client.js';
import type { CdpTarget } from './cdp-client.js';
import { StrategyCache } from './strategy-cache.js';
import { getLogger } from '../logger.js';
import type { CompanionLauncher } from '../ios-companion/launcher.js';
import { parseCompanionHierarchy } from '../ios-companion/hierarchy-parser.js';

export interface InspectOptions {
  metroPort: number;
  devToolsPort: number;
  timeoutMs: number;
  bundleId?: string;
}

export type StrategyMethod = 'cdp' | 'uiautomator' | 'idb' | 'xcuitest' | 'none';

export interface InspectionStrategy {
  method: StrategyMethod;
  reason: string;
  appId?: string;
  cdpTarget?: CdpTarget;
}

export interface InspectResult {
  tree: ComponentNode[];
  capabilities: InspectionCapabilities;
  strategy: InspectionStrategy;
  device: { name: string; platform: 'android' | 'ios' };
  hints: string[];
}

export class TreeInspector {
  private shell: Shell;
  private fileCache: StrategyCache | null;
  private companionLauncher: CompanionLauncher | null;

  constructor(shell: Shell, projectRoot?: string, companionLauncher?: CompanionLauncher) {
    this.shell = shell;
    this.fileCache = projectRoot ? new StrategyCache(projectRoot) : null;
    this.companionLauncher = companionLauncher ?? null;
  }

  invalidateCache(deviceId?: string): void {
    if (!this.fileCache) return;
    if (deviceId) {
      this.fileCache.delete(deviceId);
    } else {
      this.fileCache.clear();
    }
  }

  async resolveStrategy(device: DeviceInfo, options: InspectOptions): Promise<InspectionStrategy> {
    if (options.metroPort > 0) {
      const targets = await discoverTargets(options.metroPort);
      const target = findRuntimeTarget(targets, device.name);
      if (target) {
        return {
          method: 'cdp',
          reason: 'React Native app connected via Metro',
          appId: target.appId,
          cdpTarget: target,
        };
      }
    }

    if (device.platform === 'android') {
      return { method: 'uiautomator', reason: 'Android native inspection' };
    }

    if (this.companionLauncher) {
      return { method: 'xcuitest', reason: 'iOS native inspection via XCUITest companion' };
    }

    return { method: 'idb', reason: 'iOS native inspection via idb' };
  }

  async inspect(device: DeviceInfo, options: InspectOptions): Promise<InspectResult> {
    const logger = getLogger();
    const hints: string[] = [];
    let usedCache = false;

    const cachedEntry = this.fileCache?.get(device.id);
    let strategy: InspectionStrategy;

    if (cachedEntry && cachedEntry.method !== 'none') {
      logger.debug(`Using cached strategy for ${device.name}: ${cachedEntry.method}`);
      usedCache = true;
      if (cachedEntry.method === 'cdp' && options.metroPort > 0) {
        const targets = await discoverTargets(options.metroPort);
        const target = findRuntimeTarget(targets, device.name);
        strategy = target
          ? { method: 'cdp', reason: cachedEntry.reason, appId: target.appId, cdpTarget: target }
          : await this.resolveStrategy(device, options);
      } else {
        strategy = { method: cachedEntry.method, reason: cachedEntry.reason, appId: cachedEntry.appId };
      }
    } else {
      strategy = await this.resolveStrategy(device, options);
    }

    this.fileCache?.set(device.id, strategy.method, strategy.reason, strategy.appId);

    const base = { device: { name: device.name, platform: device.platform }, strategy };

    if (strategy.method === 'cdp' && strategy.cdpTarget) {
      try {
        const cdp = new CdpClient();
        const tree = await cdp.connectAndGetTree(
          options.metroPort, options.timeoutMs, device.name,
        );
        const caps = cdp.getCapabilities();
        await cdp.disconnect();
        if (tree.length > 0) {
          logger.debug(`CDP: got ${tree.length} root nodes for ${device.name}`);
          return { ...base, tree, capabilities: caps, hints };
        }
      } catch (err) {
        logger.debug(`CDP failed: ${err instanceof Error ? err.message : err}`);
      }
      logger.debug('CDP strategy resolved but returned no tree, falling back to native');
    }

    if (strategy.method === 'uiautomator' || (strategy.method === 'cdp' && device.platform === 'android')) {
      try {
        const tree = await dumpUiAutomator(this.shell, device.id, options.timeoutMs);
        logger.debug(`UIAutomator: got ${tree.length} root nodes for ${device.name}`);
        return {
          ...base,
          strategy: { method: 'uiautomator', reason: strategy.method === 'cdp' ? 'CDP fallback to native' : strategy.reason },
          tree,
          capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'uiautomator' },
          hints,
        };
      } catch (err) {
        logger.debug(`UIAutomator failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (strategy.method === 'xcuitest' || (strategy.method === 'cdp' && device.platform === 'ios' && this.companionLauncher)) {
      try {
        const client = await this.companionLauncher!.ensureRunning(device.id, options.bundleId);
        const rawNodes = await client.hierarchy();
        const tree = parseCompanionHierarchy(rawNodes);
        logger.debug(`xcuitest: got ${tree.length} root nodes for ${device.name}`);
        return {
          ...base,
          strategy: { method: 'xcuitest', reason: strategy.method === 'cdp' ? 'CDP fallback to native' : strategy.reason },
          tree,
          capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'xcuitest' },
          hints,
        };
      } catch (err) {
        logger.debug(`XCUITest companion failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (strategy.method === 'idb' || (strategy.method === 'cdp' && device.platform === 'ios') || (strategy.method === 'xcuitest')) {
      try {
        const tree = await dumpIosAccessibility(this.shell, device.id, options.timeoutMs);
        logger.debug(`idb: got ${tree.length} root nodes for ${device.name}`);
        return {
          ...base,
          strategy: { method: 'idb', reason: strategy.method === 'xcuitest' ? 'XCUITest fallback to idb' : strategy.method === 'cdp' ? 'CDP fallback to native' : strategy.reason },
          tree,
          capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'idb' },
          hints,
        };
      } catch (err) {
        logger.debug(`iOS accessibility failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (device.platform === 'ios') {
      hints.push('Install idb for native iOS tree inspection: brew install idb-companion && pip install fb-idb');
    }

    if (usedCache) {
      this.fileCache?.delete(device.id);
      logger.debug(`Invalidated cached strategy for ${device.name} after complete failure`);
    }

    return {
      ...base,
      strategy: { method: 'none', reason: 'No inspection method available' },
      tree: [],
      capabilities: { tree: 'none', sourceMapping: 'none', styles: 'none', protocol: 'none' },
      hints,
    };
  }
}
