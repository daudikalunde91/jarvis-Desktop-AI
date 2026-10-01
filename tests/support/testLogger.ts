import type { ILogger } from '@backend/logging/ILogger';

/** Silent, capture-only logger for tests — no console output, no files. */
export function createTestLogger(): ILogger {
  const noop = () => undefined;
  return {
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    log: noop,
  };
}
