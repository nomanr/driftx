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

const FIBER_WALK_SCRIPT = `(function() {
  try {
    var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || !hook.renderers || hook.renderers.size === 0) return JSON.stringify(null);

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
    if (fiber.tag === 3) return null;
    return null;
  }

  function isNoise(name, fiber) {
    if (!name) return true;
    if (fiber.tag === 6) return true;
    var props = fiber.memoizedProps || {};
    var hasSignal = props.testID || props.nativeID || typeof props.children === 'string';
    if (hasSignal) return false;
    if (name === 'Unknown') return true;
    if (fiber.tag === 5) return true;
    if (name.substring(0, 3) === 'RCT' || name.substring(0, 5) === 'RNSVG') return true;
    if (name.indexOf('ViewManagerAdapter_') === 0) return true;
    var len = name.length;
    if (len > 7 && name.indexOf('Context', len - 7) === len - 7) return true;
    if (len > 8 && name.indexOf('Provider', len - 8) === len - 8) return true;
    if (len > 8 && name.indexOf('Consumer', len - 8) === len - 8) return true;
    var c = name.charCodeAt(0);
    if (c >= 97 && c <= 122) return true;
    if (name.indexOf('Animated(') === 0) return true;
    return false;
  }

  function flattenFiber(fiber, depth) {
    if (!fiber) return;
    var name = getName(fiber);
    var noise = isNoise(name, fiber);

    if (!noise) {
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

const MEASURE_FIND_SCRIPT = (text: string) => `(function() {
  try {
    globalThis.__driftx_measure = null;
    var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || !hook.renderers) return JSON.stringify({error: "no hook"});
    var targetText = ${JSON.stringify(text)};
    var found = null;
    function searchFiber(fiber) {
      if (!fiber || found) return;
      var props = fiber.memoizedProps || {};
      if (typeof props.children === 'string' && props.children === targetText) { found = fiber; return; }
      var child = fiber.child;
      while (child) { searchFiber(child); child = child.sibling; }
    }
    hook.renderers.forEach(function(renderer, id) {
      var roots = hook.getFiberRoots(id);
      if (!roots) return;
      roots.forEach(function(root) { if (root.current) searchFiber(root.current); });
    });
    if (!found) return JSON.stringify({error: "not found"});
    var host = found;
    while (host) {
      if (host.tag === 5 && host.stateNode != null) break;
      host = host.return;
    }
    if (!host || !host.stateNode) return JSON.stringify({error: "no host"});
    var sn = host.stateNode;
    if (typeof sn.measureInWindow === 'function') {
      sn.measureInWindow(function(x, y, w, h) {
        globalThis.__driftx_measure = {x: x, y: y, width: w, height: h};
      });
      return JSON.stringify({status: "measuring"});
    }
    return JSON.stringify({error: "no measureInWindow"});
  } catch(e) { return JSON.stringify({error: e.message}); }
})()`;

const MEASURE_READ_SCRIPT = `(function() {
  var r = globalThis.__driftx_measure;
  globalThis.__driftx_measure = null;
  return r ? JSON.stringify(r) : JSON.stringify(null);
})()`;

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function measureElementByText(
  metroPort: number,
  text: string,
  deviceName?: string,
  timeoutMs = 10_000,
): Promise<ElementBounds | null> {
  const logger = getLogger();
  const targets = await discoverTargets(metroPort);
  const target = findRuntimeTarget(targets, deviceName);
  if (!target) return null;

  return new Promise((resolve) => {
    const timer = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
    let ws: WebSocket;

    function cleanup() {
      try { ws?.close(); } catch {}
    }

    try {
      ws = new WebSocket(target!.webSocketDebuggerUrl);
    } catch {
      clearTimeout(timer);
      return resolve(null);
    }

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: MEASURE_FIND_SCRIPT(text), returnByValue: true },
      }));
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg: CdpResponse = JSON.parse(data.toString());
        if (msg.id === 1) {
          const val = msg.result?.result?.value;
          if (typeof val === 'string') {
            const parsed = JSON.parse(val);
            if (parsed?.status === 'measuring') {
              setTimeout(() => {
                ws.send(JSON.stringify({
                  id: 2,
                  method: 'Runtime.evaluate',
                  params: { expression: MEASURE_READ_SCRIPT, returnByValue: true },
                }));
              }, 200);
              return;
            }
          }
          clearTimeout(timer);
          cleanup();
          resolve(null);
        }
        if (msg.id === 2) {
          clearTimeout(timer);
          const val = msg.result?.result?.value;
          if (typeof val === 'string') {
            const parsed = JSON.parse(val);
            if (parsed && typeof parsed.x === 'number' && parsed.width > 0) {
              logger.debug(`CDP measure '${text}': ${JSON.stringify(parsed)}`);
              cleanup();
              return resolve(parsed as ElementBounds);
            }
          }
          cleanup();
          resolve(null);
        }
      } catch { /* ignore */ }
    });

    ws.on('error', () => { clearTimeout(timer); cleanup(); resolve(null); });
  });
}

export async function detectBundleId(metroPort: number, deviceName?: string): Promise<string | null> {
  const targets = await discoverTargets(metroPort);
  const target = findRuntimeTarget(targets, deviceName);
  if (!target) return null;
  if (target.appId) return target.appId;
  if (target.description && /^[a-zA-Z][a-zA-Z0-9._-]+$/.test(target.description)) return target.description;
  return null;
}

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
  const rnTargets = targets.filter((t) => !!t.reactNative);

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

    return this.optimize(this.rebuildTree(parsed));
  }

  private optimize(roots: ComponentNode[]): ComponentNode[] {
    let tree = roots;
    let prevCount = -1;
    for (let i = 0; i < 10; i++) {
      tree = this.dedup(tree);
      tree = this.pruneLeaves(tree);
      const count = this.countNodes(tree);
      if (count === prevCount) break;
      prevCount = count;
    }
    return tree;
  }

  private countNodes(nodes: ComponentNode[]): number {
    let c = 0;
    for (const n of nodes) c += 1 + this.countNodes(n.children);
    return c;
  }

  private pruneLeaves(nodes: ComponentNode[]): ComponentNode[] {
    return nodes.reduce<ComponentNode[]>((acc, node) => {
      node.children = this.pruneLeaves(node.children);
      if (node.children.length === 0 && !node.testID && !node.text) return acc;
      acc.push(node);
      return acc;
    }, []);
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
      const nodeHasSignal = node.testID || node.text;
      if (!nodeHasSignal) {
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
