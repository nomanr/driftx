import WebSocket from 'ws';
import type { ComponentNode, InspectionCapabilities } from '../types.js';
import { getLogger } from '../logger.js';

export class DevToolsClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private components: ComponentNode[] = [];

  async connect(port: number, timeoutMs: number): Promise<ComponentNode[]> {
    const logger = getLogger();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cleanup();
        reject(new Error(`DevTools connection timed out after ${timeoutMs}ms on port ${port}`));
      }, timeoutMs);

      try {
        this.ws = new WebSocket(`ws://localhost:${port}`);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }

      this.ws.on('open', () => {
        logger.debug(`Connected to React DevTools on port ${port}`);
        this.connected = true;
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.event === 'operations' && Array.isArray(msg.payload)) {
            this.components = this.parseOperations(msg.payload);
            clearTimeout(timer);
            resolve(this.components);
          }
        } catch {
          // ignore non-JSON messages
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timer);
        logger.debug(`DevTools connection error: ${err.message}`);
        reject(err);
      });

      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  async connectSafe(port: number, timeoutMs: number): Promise<ComponentNode[]> {
    const logger = getLogger();
    try {
      return await this.connect(port, timeoutMs);
    } catch {
      logger.warn(`React DevTools WebSocket not responding on port ${port} — is the app running in dev mode? Falling back to basic inspection.`);
      return [];
    }
  }

  private parseOperations(payload: (string | number)[]): ComponentNode[] {
    const nodes: ComponentNode[] = [];
    let i = 0;

    while (i < payload.length) {
      const op = payload[i];
      if (op === 1) {
        const id = String(payload[i + 1]);
        const name = String(payload[i + 4] ?? 'Unknown');

        nodes.push({
          id,
          name,
          reactName: name,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          children: [],
          inspectionTier: 'detailed',
        });

        i += 5;
      } else {
        i++;
      }
    }

    return nodes;
  }

  getCapabilities(): InspectionCapabilities {
    if (this.connected) {
      return {
        tree: 'detailed',
        sourceMapping: 'partial',
        styles: 'partial',
        protocol: 'react-devtools',
      };
    }
    return {
      tree: 'none',
      sourceMapping: 'none',
      styles: 'none',
      protocol: 'none',
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
  }
}
