import { describe, it, expect, vi } from 'vitest';
import { formatOutput } from '../../../src/formatters/format.js';
import type { OutputFormatter, FormatterContext } from '../../../src/formatters/types.js';

const mockFormatter: OutputFormatter<string> = {
  terminal: (data) => `TERM:${data}`,
  markdown: (data) => `MD:${data}`,
  json: (data) => `JSON:${data}`,
};

describe('formatOutput', () => {
  it('uses terminal format by default', async () => {
    const ctx: FormatterContext = { format: 'terminal', copy: false, quiet: false };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await formatOutput(mockFormatter, 'test', ctx);
    expect(consoleSpy).toHaveBeenCalledWith('TERM:test');
    consoleSpy.mockRestore();
  });

  it('uses markdown format when specified', async () => {
    const ctx: FormatterContext = { format: 'markdown', copy: false, quiet: false };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await formatOutput(mockFormatter, 'test', ctx);
    expect(consoleSpy).toHaveBeenCalledWith('MD:test');
    consoleSpy.mockRestore();
  });

  it('uses json format when specified', async () => {
    const ctx: FormatterContext = { format: 'json', copy: false, quiet: false };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await formatOutput(mockFormatter, 'test', ctx);
    expect(consoleSpy).toHaveBeenCalledWith('JSON:test');
    consoleSpy.mockRestore();
  });

  it('suppresses stdout when quiet', async () => {
    const ctx: FormatterContext = { format: 'terminal', copy: false, quiet: true };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await formatOutput(mockFormatter, 'test', ctx);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns formatted string', async () => {
    const ctx: FormatterContext = { format: 'markdown', copy: false, quiet: true };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await formatOutput(mockFormatter, 'test', ctx);
    expect(result).toBe('MD:test');
    vi.restoreAllMocks();
  });
});
