import type { ILogger, ILogTransport, LogMeta } from '@backend/logging/ILogger';
import { LOG_LEVELS, type LogLevel } from '@backend/core/constants';

/**
 * Concrete Logger implementation.
 * Receives its transports via constructor injection so the logging
 * *policy* (which levels are enabled, where output goes) is fully
 * decoupled from the logging *mechanism* (console, file, ...).
 */
export class Logger implements ILogger {
  private readonly transports: ILogTransport[];
  private readonly minLevelIndex: number;

  constructor(transports: ILogTransport[], minLevel: LogLevel = 'info') {
    this.transports = transports;
    this.minLevelIndex = LOG_LEVELS.indexOf(minLevel);
  }

  log(level: LogLevel, message: string, meta?: LogMeta): void {
    const levelIndex = LOG_LEVELS.indexOf(level);
    if (levelIndex === -1 || levelIndex > this.minLevelIndex) {
      return;
    }
    for (const transport of this.transports) {
      transport.write(level, message, meta);
    }
  }

  error(message: string, meta?: LogMeta): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: LogMeta): void {
    this.log('debug', message, meta);
  }
}
