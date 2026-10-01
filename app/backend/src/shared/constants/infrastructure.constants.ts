/**
 * Infrastructure-wide defaults. These are fallback values only — every
 * consumer accepts overrides through its own options/config, never a
 * hardcoded literal at the call site.
 */
export const INFRASTRUCTURE_DEFAULTS = {
  communicationBus: {
    /** Default time a sendCommand() call waits for a response. */
    commandTimeoutMs: 5000,
    /** Default max attempts (including the first) for a retried command. */
    maxRetryAttempts: 3,
    /** Base delay for exponential backoff between retry attempts. */
    retryBackoffBaseMs: 250,
  },
  healthMonitor: {
    /** How often registered modules are polled. */
    pollIntervalMs: 15000,
    /** Consecutive failures before an automatic restart is attempted. */
    maxConsecutiveFailures: 3,
  },
  eventSystem: {
    /** Safety cap so a runaway delayed-event chain cannot leak indefinitely. */
    maxDelayMs: 24 * 60 * 60 * 1000,
  },
} as const;
