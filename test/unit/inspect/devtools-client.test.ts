import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { WebSocketServer } from 'ws';
import { DevToolsClient } from '../../../src/inspect/devtools-client.js';

describe('DevToolsClient', () => {
  let wss: WebSocketServer;
  let port: number;
  let client: DevToolsClient;

  beforeAll(async () => {
    wss = new WebSocketServer({ port: 0 });
    port = (wss.address() as { port: number }).port;
  });

  afterEach(async () => {
    if (client) await client.disconnect();
  });

  afterAll(() => {
    wss.close();
  });

  it('connects and receives component tree from operations', async () => {
    wss.once('connection', (ws) => {
      const msg = JSON.stringify({
        event: 'operations',
        payload: [
          1, 1, 11, 3, 'App',
          1, 2, 11, 1, 'LoginScreen',
          1, 3, 5, 2, 'Button',
        ],
      });
      ws.send(msg);
    });

    client = new DevToolsClient();
    const tree = await client.connect(port, 3000);
    expect(tree.length).toBeGreaterThan(0);
  });

  it('times out when server does not respond', async () => {
    client = new DevToolsClient();
    await expect(client.connect(port + 9999, 500)).rejects.toThrow();
  });

  it('returns empty tree on connection failure', async () => {
    client = new DevToolsClient();
    const tree = await client.connectSafe(port + 9999, 500);
    expect(tree).toEqual([]);
  });

  it('reports capabilities as detailed when connected', async () => {
    wss.once('connection', (ws) => {
      ws.send(JSON.stringify({ event: 'operations', payload: [1, 1, 11, 0, 'App'] }));
    });

    client = new DevToolsClient();
    await client.connect(port, 3000);
    const caps = client.getCapabilities();
    expect(caps.tree).toBe('detailed');
    expect(caps.styles).toBe('partial');
    expect(caps.protocol).toBe('react-devtools');
  });
});
