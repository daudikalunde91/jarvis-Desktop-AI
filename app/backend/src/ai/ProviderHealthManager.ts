import type { ILogger } from '@backend/logging/ILogger';
import type { ProviderError } from '@backend/ai/errors';
import { classifyForHealth } from '@backend/ai/errors';
import type { ProviderHealthSnapshot, ProviderHealthState } from '@backend/ai/types';

interface HealthRecord {
  state: ProviderHealthState;
  retryAfter?: number;
  lastError?: string;
}

/**
 * Tracks provider availability. A provider that fails is marked
 * RATE_LIMITED/UNAVAILABLE for a cooldown window and automatically
 * becomes eligible again once the cooldown elapses — no manual reset
 * required, matching the "mark unavailable for the appropriate cooldown
 * period" behavior called for in the M5 spec.
 */
export class ProviderHealthManager {
  private readonly records = new Map<string, HealthRecord>();

  constructor(private readonly logger: ILogger) {}

  /** Explicitly disabled via configuration — never becomes eligible until config changes. */
  markDisabled(providerId: string): void {
    this.records.set(providerId, { state: 'DISABLED' });
  }

  recordSuccess(providerId: string): void {
    this.records.set(providerId, { state: 'ONLINE' });
  }

  recordFailure(error: ProviderError): void {
    const { state, cooldownMs } = classifyForHealth(error);
    this.records.set(error.providerId, {
      state,
      retryAfter: Date.now() + cooldownMs,
      lastError: error.code,
    });
    this.logger.warn(`AI provider ${error.providerId} marked ${state}`, {
      cooldownMs,
      code: error.code,
    });
  }

  /** Is this provider currently allowed to be tried? */
  isEligible(providerId: string): boolean {
    const record = this.records.get(providerId);
    if (!record) return true; // never seen -> assume healthy until proven otherwise
    if (record.state === 'DISABLED') return false;
    if (record.state === 'ONLINE') return true;
    // RATE_LIMITED / UNAVAILABLE: eligible again once the cooldown has elapsed.
    return Boolean(record.retryAfter && Date.now() >= record.retryAfter);
  }

  snapshot(providerId: string): ProviderHealthSnapshot {
    const record = this.records.get(providerId);
    if (!record) {
      return { providerId, state: 'ONLINE', lastCheckedAt: Date.now() };
    }
    const effectiveState =
      record.state !== 'ONLINE' && record.state !== 'DISABLED' && this.isEligible(providerId)
        ? 'ONLINE'
        : record.state;
    return {
      providerId,
      state: effectiveState,
      retryAfter: record.retryAfter,
      lastError: record.lastError,
      lastCheckedAt: Date.now(),
    };
  }

  snapshotAll(providerIds: readonly string[]): ProviderHealthSnapshot[] {
    return providerIds.map((id) => this.snapshot(id));
  }
}
