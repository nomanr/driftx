import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createMockShell } from '../../helpers/mock-shell.js';
import { checkPrerequisites } from '../../../src/prerequisites.js';

function makeHandlers(overrides: Record<string, { stdout: string; stderr: string } | (() => never)> = {}) {
  const defaults: Record<string, { stdout: string; stderr: string } | (() => never)> = {
    'node --version': { stdout: 'v20.11.0\n', stderr: '' },
    'adb --version': { stdout: 'Android Debug Bridge version 34.0.5\n', stderr: '' },
    'xcrun --version': { stdout: 'xcrun version 73.\n', stderr: '' },
  };
  return { ...defaults, ...overrides };
}

describe('prerequisites', () => {
  it('detects adb when available', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell, 19999);
    const adb = checks.find((c) => c.name === 'adb');
    expect(adb?.available).toBe(true);
    expect(adb?.version).toContain('34.0.5');
  });

  it('reports adb missing with fix instruction', async () => {
    const shell = createMockShell(makeHandlers({
      'adb --version': () => { throw new Error('command not found: adb'); },
    }));
    const checks = await checkPrerequisites(shell, 19999);
    const adb = checks.find((c) => c.name === 'adb');
    expect(adb?.available).toBe(false);
    expect(adb?.fix).toBeDefined();
    expect(adb?.fix).toContain('Android SDK');
  });

  it('checks node version', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell, 19999);
    const node = checks.find((c) => c.name === 'node');
    expect(node?.available).toBe(true);
    expect(node?.version).toContain('20.11.0');
  });

  it('marks node as required', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell, 19999);
    const node = checks.find((c) => c.name === 'node');
    expect(node?.required).toBe(true);
  });

  it('detects xcrun when available', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell, 19999);
    const xcrun = checks.find((c) => c.name === 'xcrun');
    expect(xcrun?.available).toBe(true);
  });

  it('reports metro as missing when not running', async () => {
    const shell = createMockShell(makeHandlers());
    const checks = await checkPrerequisites(shell, 19999);
    const metro = checks.find((c) => c.name === 'metro');
    expect(metro?.required).toBe(false);
    expect(metro?.available).toBe(false);
  });

  describe('metro detection via HTTP', () => {
    let server: Server;
    let port: number;

    beforeAll(async () => {
      server = createServer((_req, res) => {
        res.writeHead(200);
        res.end('packager-status:running');
      });
      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          port = (server.address() as { port: number }).port;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('detects metro when running on port', async () => {
      const shell = createMockShell(makeHandlers());
      const checks = await checkPrerequisites(shell, port);
      const metro = checks.find((c) => c.name === 'metro');
      expect(metro?.available).toBe(true);
      expect(metro?.version).toContain(`running on :${port}`);
    });
  });
});
