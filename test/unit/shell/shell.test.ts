import { describe, it, expect } from 'vitest';
import { createMockShell } from '../../helpers/mock-shell.js';

describe('Shell interface contract', () => {
  it('exec returns stdout and stderr', async () => {
    const shell = createMockShell({
      'echo hello': { stdout: 'hello\n', stderr: '' },
    });
    const result = await shell.exec('echo', ['hello']);
    expect(result.stdout).toBe('hello\n');
    expect(result.stderr).toBe('');
  });

  it('exec rejects on unknown command', async () => {
    const shell = createMockShell({});
    await expect(shell.exec('unknown', ['--flag'])).rejects.toThrow('Unexpected command');
  });

  it('records calls for assertions', async () => {
    const shell = createMockShell({
      'adb version': { stdout: 'v34', stderr: '' },
    });
    await shell.exec('adb', ['version']);
    expect(shell.calls).toEqual(['adb version']);
  });

  it('matches handler by substring', async () => {
    const shell = createMockShell({
      'adb': { stdout: 'found', stderr: '' },
    });
    const result = await shell.exec('adb', ['version']);
    expect(result.stdout).toBe('found');
  });
});
