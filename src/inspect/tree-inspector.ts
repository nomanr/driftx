import type { Shell, DeviceInfo, ComponentNode, InspectionCapabilities } from '../types.js';
import { dumpUiAutomator } from './uiautomator.js';
import { dumpIosAccessibility } from './ios-accessibility.js';
import { CdpClient, discoverTargets, findRuntimeTarget } from './cdp-client.js';
import type { CdpTarget } from './cdp-client.js';
import { getLogger } from '../logger.js';

export interface InspectOptions {
  metroPort: number;
  devToolsPort: number;
  timeoutMs: number;
}

export type StrategyMethod = 'cdp' | 'uiautomator' | 'idb' | 'none';

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
}

export class TreeInspector {
  private shell: Shell;

  constructor(shell: Shell) {
    this.shell = shell;
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

    return { method: 'idb', reason: 'iOS native inspection via idb' };
  }

  async inspect(device: DeviceInfo, options: InspectOptions): Promise<InspectResult> {
    const logger = getLogger();
    const strategy = await this.resolveStrategy(device, options);

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
          return { ...base, tree, capabilities: caps };
        }
      } catch (err) {
        logger.debug(`CDP failed: ${err instanceof Error ? err.message : err}`);
      }
      // CDP resolved but failed to execute — fall through to platform native
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
        };
      } catch (err) {
        logger.debug(`UIAutomator failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (strategy.method === 'idb' || (strategy.method === 'cdp' && device.platform === 'ios')) {
      try {
        const tree = await dumpIosAccessibility(this.shell, device.id, options.timeoutMs);
        logger.debug(`idb: got ${tree.length} root nodes for ${device.name}`);
        return {
          ...base,
          strategy: { method: 'idb', reason: strategy.method === 'cdp' ? 'CDP fallback to native' : strategy.reason },
          tree,
          capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'idb' },
        };
      } catch (err) {
        logger.debug(`iOS accessibility failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    return {
      ...base,
      strategy: { method: 'none', reason: 'No inspection method available' },
      tree: [],
      capabilities: { tree: 'none', sourceMapping: 'none', styles: 'none', protocol: 'none' },
    };
  }
}
