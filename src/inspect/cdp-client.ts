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

  function flattenFiber(fiber, depth) {
    if (!fiber) return;
    var name = 'Unknown';
    if (typeof fiber.type === 'string') name = fiber.type;
    else if (fiber.type && fiber.type.displayName) name = fiber.type.displayName;
    else if (fiber.type && fiber.type.name) name = fiber.type.name;
    else if (fiber.tag === 3) name = 'Root';
    else if (fiber.tag === 6) { flattenSiblings(fiber, depth); return; }
    var props = fiber.memoizedProps || {};
    var testID = props.testID || props.nativeID || undefined;
    var text = typeof props.children === 'string' ? props.children : undefined;
    flat.push({ n: name, d: depth, t: testID, x: text });
    var child = fiber.child;
    while (child) { flattenFiber(child, depth + 1); child = child.sibling; }
  }
  function flattenSiblings(fiber, depth) {
    var sib = fiber.sibling;
    while (sib) { flattenFiber(sib, depth); sib = sib.sibling; }
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

    return this.rebuildTree(parsed);
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
