import type { LogLevel } from '@backend/core/constants';

export interface LogMeta {
  [key: string]: unknown;
}

/**
 * Logger abstraction. Consumers depend on this interface, never on the
 * concrete Logger implementation or a specific transport — this is what
 * allows transports to be swapped without touching call sites (DIP).
 */
export interface ILogger {
  error(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
  log(level: LogLevel, message: string, meta?: LogMeta): void;
}

export interface ILogTransport {
  write(level: LogLevel, message: string, meta?: LogMeta): void;
}
