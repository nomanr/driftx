import type { RetryPolicy } from './types.js';

function isRetryable(error: Error, policy: RetryPolicy): boolean {
  return policy.retryableErrors.some((pattern) => error.message.includes(pattern));
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    }, { once: true });
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (!isRetryable(lastError, policy)) {
        throw lastError;
      }

      if (signal?.aborted) {
        throw lastError;
      }

      if (attempt < policy.maxAttempts - 1) {
        const backoff = Math.min(
          policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt),
          policy.maxDelayMs,
        );

        try {
          await delay(backoff, signal);
        } catch {
          throw lastError;
        }
      }
    }
  }

  throw lastError;
}
