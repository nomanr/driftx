import WebSocket from 'ws';
import http from 'node:http';
import type { ComponentNode, InspectionCapabilities } from '../types.js';
import { getLogger } from '../logger.js';

export interface CdpTarget {
  id: string;
  title: string;
  description: string;
  appId?: string;
  webSocketDebuggerUrl: string;
  deviceName?: string;
  reactNative?: {
    logicalDeviceId: string;
  };
}

interface CdpResponse {
  id: number;
  result?: {
    result?: {
      type: string;
      value?: unknown;
    };
    exceptionDetails?: unknown;
  };
  error?: { message: string };
}

const SKIP_NAMES = new Set([
  'Unknown', 'RCTView', 'RCTText', 'RCTScrollView', 'RCTSinglelineTextInputView',
  'RCTMultilineTextInputView', 'RCTScrollContentView', 'PressabilityDebugView',
  'RNSVGPath', 'RNSVGGroup', 'RNSVGSvgView', 'RNSVGDefs', 'RNSVGClipPath',
  'RNSVGRect', 'RNSVGCircle', 'RNSVGLine', 'RNSVGLinearGradient', 'RNSVGStop',
  'RNSVGMask', 'RNSVGUse', 'RNSVGSymbol', 'RNSVGTSpan', 'RNSVGText',
  'RNCSafeAreaProvider', 'StaticContainer',
  'View', 'Text', 'Image', 'Animated(View)', 'Animated(Text)',
  'Path', 'G', 'Svg', 'SvgComponent', 'Defs', 'ClipPath', 'Rect', 'Circle',
  'Line', 'LinearGradient', 'Stop', 'Mask', 'Use', 'Symbol',
  'Touchable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback',
  'Pressable',
  'Root', 'AppContainer', 'RNSScreen', 'RNSScreenStack',
  'RNSScreenContentWrapper', 'RNSScreenNavigationContainer',
  'ScrollView', 'FlatList', 'SectionList',
  'CellRenderer', 'VirtualizedList',
  'SafeAreaView', 'SafeAreaProviderCompat',
  'GestureHandlerRootView',
  'DebugContainer', 'ScreenContentWrapper', 'FrameSizeProviderInner',
  'NavigationContent', 'EnsureSingleNavigator',
  'Portal.Host', 'PortalComponent',
  'DelayedFreeze', 'Freeze', 'Suspender',
  'MaybeScreen', 'MaybeScreenContainer', 'ScreenContainer',
  'Animated(Anonymous)', 'SceneView', 'Screen', 'ScreenStack',
  'NativeStackView', 'NativeStackNavigator', 'BottomTabView',
  'Background', 'Separator', 'ItemSeparatorComponent', 'Space',
  'ExpoImage',
]);

const FIBER_WALK_SCRIPT = `(function() {
  try {
    var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || !hook.renderers || hook.renderers.size === 0) return JSON.stringify(null);

    var SKIP = {${[...SKIP_NAMES].map(n => `'${n}':1`).join(',')}};
    var flat = [];
    hook.renderers.forEach(function(renderer, id) {
      var roots = hook.getFiberRoots(id);
      if (!roots) return;
      roots.forEach(function(root) {
        if (root.current) flattenFiber(root.current, 0);
      });
    });

    return flat.length > 0 ? JSON.stringify(flat) : JSON.stringify(null);
  } catch(e) {
    return JSON.stringify(null);
  }

  function getName(fiber) {
    if (typeof fiber.type === 'string') return fiber.type;
    if (fiber.type && fiber.type.displayName) return fiber.type.displayName;
    if (fiber.type && fiber.type.name) return fiber.type.name;
    if (fiber.tag === 3) return 'Root';
    return null;
  }

  function isSkip(name, fiber) {
    if (!name) return true;
    if (fiber.tag === 6) return true;
    var props = fiber.memoizedProps || {};
    if (props.testID || props.nativeID) return false;
    if (typeof props.children === 'string') return false;
    if (SKIP[name]) return true;
    var len = name.length;
    if (len > 7 && name.indexOf('Context', len - 7) === len - 7) return true;
    if (len > 8 && name.indexOf('Provider', len - 8) === len - 8) return true;
    if (len > 8 && name.indexOf('Consumer', len - 8) === len - 8) return true;
    if (name.indexOf('ViewManagerAdapter_') === 0) return true;
    return false;
  }

  function flattenFiber(fiber, depth) {
    if (!fiber) return;
    var name = getName(fiber);
    var skip = isSkip(name, fiber);

    if (!skip) {
      var props = fiber.memoizedProps || {};
      var testID = props.testID || props.nativeID || undefined;
      var text = typeof props.children === 'string' ? props.children : undefined;
      flat.push({ n: name, d: depth, t: testID, x: text });
      var child = fiber.child;
      while (child) { flattenFiber(child, depth + 1); child = child.sibling; }
    } else {
      var child = fiber.child;
      while (child) { flattenFiber(child, depth); child = child.sibling; }
    }
  }
})()`;

export async function discoverTargets(metroPort: number): Promise<CdpTarget[]> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${metroPort}/json/list`, { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

export function findRuntimeTarget(targets: CdpTarget[], deviceName?: string): CdpTarget | undefined {
  const rnTargets = targets.filter((t) =>
    t.reactNative && t.description.includes('React Native'),
  );

  if (deviceName) {
    return rnTargets.find((t) =>
      t.deviceName?.toLowerCase().includes(deviceName.toLowerCase()),
    );
  }

  return rnTargets[0];
}

export class CdpClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private msgId = 0;
  private pending = new Map<number, { resolve: (v: CdpResponse) => void; reject: (e: Error) => void }>();

  async connectAndGetTree(metroPort: number, timeoutMs: number, deviceName?: string): Promise<ComponentNode[]> {
    const logger = getLogger();

    const targets = await discoverTargets(metroPort);
    const target = findRuntimeTarget(targets, deviceName);
    if (!target) {
      logger.debug('No React Native debug target found via Metro');
      return [];
    }

    logger.debug(`Found CDP target: ${target.title} (${target.description})`);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cleanup();
        resolve([]);
      }, timeoutMs);

      try {
        this.ws = new WebSocket(target.webSocketDebuggerUrl);
      } catch {
        clearTimeout(timer);
        resolve([]);
        return;
      }

      this.ws.on('open', async () => {
        this.connected = true;
        try {
          const result = await this.evaluate(FIBER_WALK_SCRIPT);
          clearTimeout(timer);
          resolve(this.parseResult(result));
        } catch {
          clearTimeout(timer);
          resolve([]);
        }
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg: CdpResponse = JSON.parse(data.toString());
          if (msg.id !== undefined) {
            const p = this.pending.get(msg.id);
            if (p) {
              this.pending.delete(msg.id);
              p.resolve(msg);
            }
          }
        } catch {}
      });

      this.ws.on('error', () => {
        clearTimeout(timer);
        resolve([]);
      });

      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  private evaluate(expression: string): Promise<CdpResponse> {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true },
      }));
    });
  }

  private parseResult(response: CdpResponse): ComponentNode[] {
    const value = response.result?.result?.value;
    if (!value || typeof value !== 'string') return [];

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return this.dedup(this.rebuildTree(parsed));
  }

  private rebuildTree(flat: Array<{ n: string; d: number; t?: string; x?: string }>): ComponentNode[] {
    const roots: ComponentNode[] = [];
    const stack: ComponentNode[] = [];
    let id = 0;

    for (const entry of flat) {
      const node: ComponentNode = {
        id: String(id++),
        name: entry.n,
        reactName: entry.n,
        testID: entry.t || undefined,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        text: entry.x || undefined,
        children: [],
        inspectionTier: 'detailed',
      };

      while (stack.length > entry.d) stack.pop();

      if (stack.length === 0) {
        roots.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      stack.push(node);
    }

    return roots;
  }

  private dedup(nodes: ComponentNode[]): ComponentNode[] {
    return nodes.map((node) => this.dedupNode(node)).filter(Boolean) as ComponentNode[];
  }

  private dedupNode(node: ComponentNode): ComponentNode | null {
    node.children = this.dedup(node.children);
    if (node.children.length === 1) {
      const child = node.children[0];
      const sameText = node.text && child.text && node.text === child.text;
      const sameTestID = node.testID && child.testID && node.testID === child.testID;
      if (sameText || sameTestID) {
        child.children = [...child.children];
        return child;
      }
    }
    return node;
  }

  getCapabilities(): InspectionCapabilities {
    return {
      tree: this.connected ? 'detailed' : 'none',
      sourceMapping: this.connected ? 'partial' : 'none',
      styles: this.connected ? 'partial' : 'none',
      protocol: 'cdp',
    };
  }

  async disconnect(): Promise<void> {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.connected = false;
    for (const [, p] of this.pending) {
      p.reject(new Error('disconnected'));
    }
    this.pending.clear();
  }
}
