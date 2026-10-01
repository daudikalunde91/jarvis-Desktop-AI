import type { ILogger } from '@backend/logging/ILogger';
import { OpenAICompatibleProvider } from '@backend/ai/providers/OpenAICompatibleProvider';

export interface OpenRouterProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  /**
   * OpenRouter proxies hundreds of models from many upstream providers,
   * and not all of them support function/tool calling. There is no
   * single correct default across the whole catalog, so this is exposed
   * for the operator to set based on whichever `OPENROUTER_MODEL` they
   * actually configure (see docs/AI_PROVIDERS.md for how to check a
   * given model's tool-support on openrouter.ai/models). Left unset it
   * defaults to true, matching most current general-purpose models.
   */
  readonly supportsTools?: boolean;
  /** Optional attribution shown on openrouter.ai leaderboards — cosmetic only, never required. */
  readonly siteUrl?: string;
  readonly appName?: string;
}

/**
 * Adapter for OpenRouter's OpenAI-compatible Chat Completions API
 * (https://openrouter.ai/api/v1 — verified current as of this build).
 * OpenRouter is a routing aggregator over 400+ models from many
 * providers; JARVIS treats it as one more fallback candidate, not a
 * replacement for having Gemini/Claude/OpenAI/Groq configured directly.
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  public readonly id = 'openrouter';
  public readonly name = 'OpenRouter';

  constructor(logger: ILogger, options: OpenRouterProviderOptions) {
    super(logger, 'openrouter', {
      apiKey: options.apiKey,
      model: options.model,
      baseUrl: options.baseUrl ?? 'https://openrouter.ai/api/v1',
      timeoutMs: options.timeoutMs,
      supportsTools: options.supportsTools ?? true,
      extraHeaders: {
        // Optional per OpenRouter's own docs — harmless if the operator
        // never customizes these; they only affect openrouter.ai's
        // public rankings, never request behavior.
        'HTTP-Referer': options.siteUrl ?? 'https://github.com/daudikalunde91/jarvis-desktop-ai',
        'X-Title': options.appName ?? 'JARVIS Desktop AI',
      },
    });
  }
}
