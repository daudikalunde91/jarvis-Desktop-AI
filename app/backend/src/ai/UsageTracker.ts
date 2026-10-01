import type { ILogger } from '@backend/logging/ILogger';
import type { AIUsageEvent } from '@backend/ai/types';

export interface UsageSummary {
  readonly providerId: string;
  readonly calls: number;
  readonly successes: number;
  readonly failures: number;
  readonly fallbacks: number;
  readonly totalTokens: number;
  readonly averageLatencyMs: number;
}

/**
 * Records provider/model/latency/success/token telemetry in memory.
 * Never logs API keys or secrets — only ids, models, and outcomes.
 */
export class UsageTracker {
  private readonly events: AIUsageEvent[] = [];
  private static readonly MAX_EVENTS = 500;

  constructor(private readonly logger: ILogger) {}

  record(event: AIUsageEvent): void {
    this.events.push(event);
    if (this.events.length > UsageTracker.MAX_EVENTS) this.events.shift();

    this.logger.info('AI usage', {
      providerId: event.providerId,
      model: event.model,
      taskType: event.taskType,
      success: event.success,
      errorCategory: event.errorCategory,
      latencyMs: event.endedAt - event.startedAt,
      totalTokens: event.usage?.totalTokens,
      fallbackFrom: event.fallbackFrom,
    });
  }

  summary(): UsageSummary[] {
    const byProvider = new Map<string, AIUsageEvent[]>();
    for (const event of this.events) {
      const list = byProvider.get(event.providerId) ?? [];
      list.push(event);
      byProvider.set(event.providerId, list);
    }

    return Array.from(byProvider.entries()).map(([providerId, events]) => {
      const successes = events.filter((e) => e.success).length;
      const totalLatency = events.reduce((sum, e) => sum + (e.endedAt - e.startedAt), 0);
      const totalTokens = events.reduce((sum, e) => sum + (e.usage?.totalTokens ?? 0), 0);
      return {
        providerId,
        calls: events.length,
        successes,
        failures: events.length - successes,
        fallbacks: events.filter((e) => e.fallbackFrom).length,
        totalTokens,
        averageLatencyMs: events.length ? Math.round(totalLatency / events.length) : 0,
      };
    });
  }
}
