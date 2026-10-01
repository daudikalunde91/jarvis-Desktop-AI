import type { ProviderRegistry } from '@backend/ai/ProviderRegistry';
import type { ProviderHealthManager } from '@backend/ai/ProviderHealthManager';
import type { TaskType } from '@backend/ai/types';

/** Provider id ordering per task type. Defaults live in `config/default.config.ts`. */
export type ProviderPriorityConfig = Readonly<Record<TaskType, readonly string[]>>;

/**
 * Decides which providers to try, and in what order, for a given task
 * type — without calling any of them. Filtering by "eligible" (per
 * ProviderHealthManager) is what implements failover: an unhealthy
 * provider simply drops out of the candidate list until its cooldown
 * expires.
 */
export class ProviderRouter {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly health: ProviderHealthManager,
    private readonly priorities: ProviderPriorityConfig,
    private readonly preferredProviderId?: string | null,
  ) {}

  /**
   * Ordered list of provider ids worth attempting right now, best first.
   *
   * `requiresTools` (Stage 6 / Feature E — "tool capability" is listed as
   * a routing factor): when the request actually carries tool
   * definitions, a provider that has declared `capabilities.toolCalling
   * === false` is dropped from the candidate list rather than being sent
   * a request it cannot fulfil (it would either ignore the tools
   * silently or the upstream API would reject the call outright,
   * depending on provider). When the request has no tools, tool-calling
   * capability is irrelevant and every configured/eligible provider
   * stays in the running, exactly as before this change.
   */
  candidatesFor(taskType: TaskType, requiresVision = false, requiresTools = false): string[] {
    const order = this.priorities[taskType] ?? this.priorities.general;
    const ranked = this.preferredProviderId
      ? [this.preferredProviderId, ...order.filter((id) => id !== this.preferredProviderId)]
      : [...order];

    return ranked.filter((providerId) => {
      const provider = this.registry.get(providerId);
      if (!provider) return false;
      if (!provider.isConfigured()) return false;
      if (requiresVision && !provider.capabilities.vision) return false;
      if (requiresTools && !provider.capabilities.toolCalling) return false;
      return this.health.isEligible(providerId);
    });
  }
}
