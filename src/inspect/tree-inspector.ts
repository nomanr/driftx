import type { Shell, DeviceInfo, ComponentNode, InspectionCapabilities } from '../types.js';
import { dumpUiAutomator } from './uiautomator.js';
import { dumpIosAccessibility } from './ios-accessibility.js';
import { CdpClient } from './cdp-client.js';
import { DevToolsClient } from './devtools-client.js';
import { getLogger } from '../logger.js';

export interface InspectOptions {
  metroPort: number;
  devToolsPort: number;
  timeoutMs: number;
}

export interface InspectResult {
  tree: ComponentNode[];
  capabilities: InspectionCapabilities;
}

export class TreeInspector {
  private shell: Shell;

  constructor(shell: Shell) {
    this.shell = shell;
  }

  async inspect(device: DeviceInfo, options: InspectOptions): Promise<InspectResult> {
    const logger = getLogger();

    // Tier B attempt 1: CDP via Metro (new RN architecture)
    if (options.metroPort > 0) {
      try {
        const cdp = new CdpClient();
        const tree = await cdp.connectAndGetTree(options.metroPort, options.timeoutMs, device.name);
        if (tree.length > 0) {
          logger.debug('Using CDP via Metro (Tier B) for tree inspection');
          const caps = cdp.getCapabilities();
          await cdp.disconnect();
          return { tree, capabilities: caps };
        }
        await cdp.disconnect();
      } catch (err) {
        logger.debug(`CDP via Metro failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Tier B attempt 2: Legacy React DevTools standalone (port 8097)
    if (options.devToolsPort > 0) {
      const client = new DevToolsClient();
      const tree = await client.connectSafe(options.devToolsPort, options.timeoutMs);
      if (tree.length > 0) {
        logger.debug('Using React DevTools standalone (Tier B) for tree inspection');
        return { tree, capabilities: client.getCapabilities() };
      }
    }

    // Tier A: Platform-native inspection
    if (device.platform === 'android') {
      try {
        const tree = await dumpUiAutomator(this.shell, device.id, options.timeoutMs);
        logger.debug('Using UIAutomator (Tier A) for tree inspection');
        return {
          tree,
          capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'uiautomator' },
        };
      } catch (err) {
        logger.debug(`UIAutomator dump failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (device.platform === 'ios') {
      try {
        const tree = await dumpIosAccessibility(this.shell, device.id, options.timeoutMs);
        logger.debug('Using iOS accessibility (Tier A) for tree inspection');
        return {
          tree,
          capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'accessibility' },
        };
      } catch (err) {
        logger.debug(`iOS accessibility dump failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    return {
      tree: [],
      capabilities: { tree: 'none', sourceMapping: 'none', styles: 'none', protocol: 'none' },
    };
  }
}
