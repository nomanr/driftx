import type { Shell, DeviceInfo, ComponentNode, InspectionCapabilities } from '../types.js';
import { dumpUiAutomator } from './uiautomator.js';
import { dumpIosAccessibility } from './ios-accessibility.js';
import { DevToolsClient } from './devtools-client.js';
import { getLogger } from '../logger.js';

export interface InspectOptions {
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

    if (options.devToolsPort > 0) {
      const client = new DevToolsClient();
      const tree = await client.connectSafe(options.devToolsPort, options.timeoutMs);
      if (tree.length > 0) {
        logger.debug('Using React DevTools (Tier B) for tree inspection');
        return { tree, capabilities: client.getCapabilities() };
      }
    }

    if (device.platform === 'android') {
      try {
        const tree = await dumpUiAutomator(this.shell, device.id, options.timeoutMs);
        logger.debug('Using UIAutomator (Tier A) for tree inspection');
        return {
          tree,
          capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'uiautomator' },
        };
      } catch (err) {
        logger.warn(`UIAutomator dump failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (device.platform === 'ios') {
      try {
        const tree = await dumpIosAccessibility(this.shell, device.id, options.timeoutMs);
        logger.debug('Using Accessibility Inspector (Tier A) for tree inspection');
        return {
          tree,
          capabilities: { tree: 'basic', sourceMapping: 'none', styles: 'none', protocol: 'accessibility' },
        };
      } catch (err) {
        logger.warn(`iOS accessibility dump failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    return {
      tree: [],
      capabilities: { tree: 'none', sourceMapping: 'none', styles: 'none', protocol: 'none' },
    };
  }
}
