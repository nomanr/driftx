import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../../src/retry.js';
import type { RetryPolicy } from '../../../src/types.js';

const fastPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 10,
  maxDelayMs: 100,
  backoffMultiplier: 2,
  retryableErrors: ['RETRY_ME'],
};

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, fastPolicy);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('RETRY_ME'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, fastPolicy);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('RETRY_ME'));
    await expect(withRetry(fn, fastPolicy)).rejects.toThrow('RETRY_ME');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('FATAL'));
    await expect(withRetry(fn, fastPolicy)).rejects.toThrow('FATAL');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockRejectedValue(new Error('RETRY_ME'));
    await expect(withRetry(fn, fastPolicy, controller.signal)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborts cleanly when signal fires during backoff', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('RETRY_ME'));
    setTimeout(() => controller.abort(), 20);
    await expect(withRetry(fn, fastPolicy, controller.signal)).rejects.toThrow();
    expect(fn.mock.calls.length).toBeLessThan(3);
  });
});
