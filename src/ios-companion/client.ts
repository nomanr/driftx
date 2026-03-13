import http from 'node:http';

export interface CompanionHierarchyNode {
  elementType: string;
  identifier?: string;
  label?: string;
  frame: { x: number; y: number; width: number; height: number };
  isEnabled: boolean;
  value?: string;
  children: CompanionHierarchyNode[];
}

interface CompanionResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export class CompanionClient {
  constructor(private port: number) {}

  async status(): Promise<{ status: string }> {
    return this.request('GET', '/status') as Promise<{ status: string }>;
  }

  async configure(bundleId: string): Promise<void> {
    await this.request('POST', '/configure', { bundleId }, 30_000);
  }

  async tap(x: number, y: number): Promise<void> {
    await this.request('POST', '/tap', { x, y });
  }

  async longPress(x: number, y: number, durationMs: number): Promise<void> {
    await this.request('POST', '/longPress', { x, y, durationMs });
  }

  async swipe(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): Promise<void> {
    await this.request('POST', '/swipe', { fromX, fromY, toX, toY, durationMs });
  }

  async type(text: string): Promise<void> {
    await this.request('POST', '/type', { text });
  }

  async keyEvent(key: string): Promise<void> {
    await this.request('POST', '/keyEvent', { key });
  }

  async find(text: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
      const res = await this.request('POST', '/find', { text }, 30_000);
      const frame = res.frame as { x: number; y: number; width: number; height: number } | undefined;
      return frame ?? null;
    } catch {
      return null;
    }
  }

  async hierarchy(): Promise<CompanionHierarchyNode[]> {
    return this.requestRaw('GET', '/hierarchy', undefined, 30_000) as Promise<CompanionHierarchyNode[]>;
  }

  private requestRaw(method: string, path: string, body?: unknown, timeoutMs = 10_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : undefined;

      const req = http.request(
        {
          hostname: 'localhost',
          port: this.port,
          path,
          method,
          timeout: timeoutMs,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : undefined,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`Companion ${method} ${path} returned ${res.statusCode}: ${data}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Companion ${method} ${path} returned invalid JSON: ${data}`));
            }
          });
        },
      );

      req.on('error', (err) => reject(new Error(`Companion ${method} ${path}: ${err.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error(`Companion ${method} ${path} timed out after ${timeoutMs}ms`)); });

      if (payload) req.write(payload);
      req.end();
    });
  }

  private request(method: string, path: string, body?: unknown, timeoutMs = 30_000): Promise<CompanionResponse> {
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : undefined;

      const req = http.request(
        {
          hostname: 'localhost',
          port: this.port,
          path,
          method,
          timeout: timeoutMs,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : undefined,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`Companion ${method} ${path} returned ${res.statusCode}: ${data}`));
              return;
            }

            let parsed: CompanionResponse;
            try {
              parsed = JSON.parse(data);
            } catch {
              reject(new Error(`Companion ${method} ${path} returned invalid JSON: ${data}`));
              return;
            }

            if (parsed.success === false) {
              reject(new Error(`Companion ${method} ${path} failed: ${parsed.error ?? 'unknown error'}`));
              return;
            }

            resolve(parsed);
          });
        },
      );

      req.on('error', (err) => reject(new Error(`Companion ${method} ${path}: ${err.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error(`Companion ${method} ${path} timed out after ${timeoutMs}ms`)); });

      if (payload) req.write(payload);
      req.end();
    });
  }
}
