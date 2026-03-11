import { describe, it, expect, beforeEach } from 'vitest';
import { createLogger, getLogger, setLogger } from '../../../src/logger.js';

describe('createLogger', () => {
  it('returns logger with level debug when created with debug', () => {
    const logger = createLogger('debug');
    expect(logger.level).toBe('debug');
  });

  it('returns logger with level error when created with error', () => {
    const logger = createLogger('error');
    expect(logger.level).toBe('error');
  });

  it('defaults to info level', () => {
    const logger = createLogger();
    expect(logger.level).toBe('info');
  });
});

describe('singleton logger', () => {
  beforeEach(() => {
    setLogger(createLogger('info'));
  });

  it('setLogger/getLogger singleton works', () => {
    const custom = createLogger('debug');
    setLogger(custom);
    const retrieved = getLogger();
    expect(retrieved.level).toBe('debug');
  });

  it('getLogger returns default info logger if none set', () => {
    setLogger(undefined as any);
    const logger = getLogger();
    expect(logger.level).toBe('info');
  });
});
