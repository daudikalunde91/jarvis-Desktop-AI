import type { ILogger } from '@backend/logging/ILogger';
import type { ProviderRegistry } from '@backend/ai/ProviderRegistry';
import type { ProviderRouter } from '@backend/ai/ProviderRouter';
import type { ProviderHealthManager } from '@backend/ai/ProviderHealthManager';
import type { UsageTracker } from '@backend/ai/UsageTracker';
import { AllProvidersFailedError, ProviderError } from '@backend/ai/errors';
import type { AICompletionRequest, AICompletionResponse } from '@backend/ai/types';

/**
 * Implements the failover chain from the M5 spec:
 *
 *   OpenAI -> 429 -> Gemini -> success -> response returned
 *
 * Providers are tried strictly in the order `ProviderRouter` returns
 * (already filtered to configured + eligible). Any other provider's
 * `ProviderError` is recorded against health and telemetry, then the
 * next candidate is tried. Nothing here calls more than one provider at
 * a time, and it never calls "all providers" speculatively.
 */
export class FallbackManager {
  constructor(
    private readonly logger: ILogger,
    private readonly registry: ProviderRegistry,
    private readonly router: ProviderRouter,
    private readonly health: ProviderHealthManager,
    private readonly usage: UsageTracker,
  ) {}

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const candidates = this.router.candidatesFor(
      request.taskType,
      request.requiresVision,
      Boolean(request.tools?.length),
    );
    const attempts: ProviderError[] = [];
    let fallbackFrom: string | undefined;

    for (const providerId of candidates) {
      const provider = this.registry.get(providerId);
      if (!provider) continue;

      const startedAt = Date.now();
      try {
        const response = await provider.complete(request);
        this.health.recordSuccess(providerId);
        this.usage.record({
          providerId,
          model: response.model,
          taskType: request.taskType,
          startedAt,
          endedAt: Date.now(),
          success: true,
          usage: response.usage,
          fallbackFrom,
        });
        return response;
      } catch (error) {
        const providerError =
          error instanceof ProviderError
            ? error
            : new ProviderError(
                error instanceof Error ? error.message : String(error),
                'AI_UNKNOWN_ERROR',
                providerId,
              );

        attempts.push(providerError);
        this.health.recordFailure(providerError);
        this.usage.record({
          providerId,
          model: 'unknown',
          taskType: request.taskType,
          startedAt,
          endedAt: Date.now(),
          success: false,
          errorCategory: providerError.code,
          fallbackFrom,
        });
        // FIX (startup-debug pass): the previous version only logged the
        // error `code` (e.g. AI_INVALID_REQUEST_ERROR) and silently dropped
        // `providerError.context`, which is where BaseHttpProvider actually
        // puts the useful bit — the real HTTP status and a truncated
        // response body from the provider (e.g. "model: claude-sonnet-4-6
        // not found" or "insufficient_quota"). Without this, the terminal
        // told you a provider failed but never *why*, so every failure
        // required re-instrumenting the code by hand to find out.
        this.logger.warn(`AI provider ${providerId} failed, trying next candidate`, {
          code: providerError.code,
          ...providerError.context,
        });
        fallbackFrom = providerId;
      }
    }

    throw new AllProvidersFailedError(attempts);
  }
}
