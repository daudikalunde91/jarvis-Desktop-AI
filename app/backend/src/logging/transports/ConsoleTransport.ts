import type { ILogTransport, LogMeta } from '@backend/logging/ILogger';
import type { LogLevel } from '@backend/core/constants';

const LEVEL_COLOR: Record<LogLevel, string> = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
};
const RESET = '\x1b[0m';

/**
 * Writes formatted log lines to stdout/stderr.
 */
export class ConsoleTransport implements ILogTransport {
  write(level: LogLevel, message: string, meta?: LogMeta): void {
    const timestamp = new Date().toISOString();
    const color = LEVEL_COLOR[level] ?? '';
    const line = `${color}[${timestamp}] [${level.toUpperCase()}]${RESET} ${message}`;
    const output = level === 'error' ? console.error : console.log;

    if (meta && Object.keys(meta).length > 0) {
      output(line, meta);
    } else {
      output(line);
    }
  }
}
