import pino from 'pino';

export type LogLevel = 'debug' | 'info' | 'error' | 'silent';

export function createLogger(level: LogLevel = 'info'): pino.Logger {
  return pino({
    level: level === 'silent' ? 'silent' : level,
    transport:
      process.env.NODE_ENV !== 'test'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
}

let _logger: pino.Logger | undefined;

export function getLogger(): pino.Logger {
  if (!_logger) {
    _logger = createLogger();
  }
  return _logger;
}

export function setLogger(logger: pino.Logger): void {
  _logger = logger;
}
