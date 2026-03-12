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

    var nodes = [];
    hook.renderers.forEach(function(renderer, id) {
      var roots = hook.getFiberRoots(id);
      if (!roots) return;
      roots.forEach(function(root) {
        if (root.current) {
          var tree = walkFiber(root.current);
          if (tree) nodes.push(tree);
        }
      });
    });

    return JSON.stringify(nodes.length > 0 ? nodes : null);
  } catch(e) {
    return JSON.stringify(null);
  }

  function walkFiber(fiber) {
    if (!fiber) return null;

    var name = 'Unknown';
    if (typeof fiber.type === 'string') name = fiber.type;
    else if (fiber.type && fiber.type.displayName) name = fiber.type.displayName;
    else if (fiber.type && fiber.type.name) name = fiber.type.name;
    else if (fiber.tag === 3) name = 'Root';
    else if (fiber.tag === 6) return null;

    var props = fiber.memoizedProps || {};
    var testID = props.testID || props.nativeID || undefined;
    var text = typeof props.children === 'string' ? props.children : undefined;

    var children = [];
    var child = fiber.child;
    while (child) {
      var childNode = walkFiber(child);
      if (childNode) children.push(childNode);
      child = child.sibling;
    }

    return { name: name, testID: testID, text: text, children: children };
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

    const idCounter = { n: 0 };
    return parsed.map((node: any) => this.toComponentNode(node, idCounter));
  }

  private toComponentNode(raw: any, idCounter: { n: number }): ComponentNode {
    return {
      id: String(idCounter.n++),
      name: raw.name ?? 'Unknown',
      reactName: raw.name,
      testID: raw.testID || undefined,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      text: raw.text || undefined,
      children: (raw.children ?? []).map((c: any) => this.toComponentNode(c, idCounter)),
      inspectionTier: 'detailed',
    };
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
