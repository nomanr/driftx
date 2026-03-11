import { execFile } from 'node:child_process';
import type { Shell } from './types.js';

export class RealShell implements Shell {
  async exec(
    cmd: string,
    args: string[],
    options?: { timeout?: number },
  ): Promise<{ stdout: string; stderr: string }> {
    const controller = new AbortController();
    const timeout = options?.timeout;

    return new Promise((resolve, reject) => {
      const child = execFile(
        cmd,
        args,
        {
          signal: controller.signal,
          maxBuffer: 10 * 1024 * 1024,
          encoding: 'utf-8',
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        },
      );

      if (timeout) {
        setTimeout(() => {
          controller.abort();
          child.kill();
        }, timeout);
      }
    });
  }
}

export function createShell(): Shell {
  return new RealShell();
}
