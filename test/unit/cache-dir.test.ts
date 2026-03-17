import { describe, it, expect, vi, afterEach } from 'vitest';

describe('getCacheDir', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns Library/Caches/driftx on macOS', async () => {
    vi.doMock('node:os', () => ({
      homedir: () => '/Users/testuser',
      platform: () => 'darwin',
    }));
    const { getCacheDir } = await import('../../src/cache-dir.js');
    expect(getCacheDir()).toBe('/Users/testuser/Library/Caches/driftx');
  });

  it('returns .cache/driftx on Linux', async () => {
    vi.doMock('node:os', () => ({
      homedir: () => '/home/testuser',
      platform: () => 'linux',
    }));
    delete process.env.XDG_CACHE_HOME;
    const { getCacheDir } = await import('../../src/cache-dir.js');
    expect(getCacheDir()).toBe('/home/testuser/.cache/driftx');
  });

  it('respects XDG_CACHE_HOME on Linux', async () => {
    vi.doMock('node:os', () => ({
      homedir: () => '/home/testuser',
      platform: () => 'linux',
    }));
    process.env.XDG_CACHE_HOME = '/custom/cache';
    const { getCacheDir } = await import('../../src/cache-dir.js');
    expect(getCacheDir()).toBe('/custom/cache/driftx');
    delete process.env.XDG_CACHE_HOME;
  });

  it('getRunsDir appends /runs', async () => {
    vi.doMock('node:os', () => ({
      homedir: () => '/Users/testuser',
      platform: () => 'darwin',
    }));
    const { getRunsDir } = await import('../../src/cache-dir.js');
    expect(getRunsDir()).toBe('/Users/testuser/Library/Caches/driftx/runs');
  });
});
