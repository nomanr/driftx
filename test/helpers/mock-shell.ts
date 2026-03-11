import type { Shell } from '../../src/types.js';

type CommandHandler = (fullCmd: string) => Promise<{ stdout: string; stderr: string }> | { stdout: string; stderr: string };

export function createMockShell(handlers: Record<string, CommandHandler | { stdout: string; stderr: string }>): Shell & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    async exec(cmd: string, args: string[], _options?: { timeout?: number }) {
      const fullCommand = [cmd, ...args].join(' ');
      calls.push(fullCommand);
      for (const [pattern, handler] of Object.entries(handlers)) {
        if (fullCommand.includes(pattern)) {
          if (typeof handler === 'function') {
            return handler(fullCommand);
          }
          return handler;
        }
      }
      throw new Error(`Unexpected command: ${fullCommand}`);
    },
  };
}
