import type { ILogger } from '@backend/logging/ILogger';
import { OpenAICompatibleProvider } from '@backend/ai/providers/OpenAICompatibleProvider';

export interface LovableProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly supportsTools?: boolean;
}

/**
 * Adapter for the Lovable AI Gateway
 * (https://ai.gateway.lovable.dev/v1 — verified current as of this
 * build). The gateway sits in front of Google/OpenAI models behind a
 * single project key; model ids are namespaced, e.g.
 * `google/gemini-3.7-flash` or `openai/gpt-5-mini` — see
 * docs/AI_PROVIDERS.md for how to find the current catalog, since
 * Lovable's available models and free-vs-paid boundaries are managed on
 * their side and can change independently of this codebase.
 *
 * IMPORTANT (Feature C): Lovable is one more fallback provider in the
 * existing orchestrator, not a replacement for the others, and nothing
 * here assumes any particular model or usage tier is free — that is a
 * property of the operator's own Lovable project/plan, not something
 * this adapter can determine or should assume.
 */
export class LovableProvider extends OpenAICompatibleProvider {
  public readonly id = 'lovable';
  public readonly name = 'Lovable AI Gateway';

  constructor(logger: ILogger, options: LovableProviderOptions) {
    super(logger, 'lovable', {
      apiKey: options.apiKey,
      model: options.model,
      baseUrl: options.baseUrl ?? 'https://ai.gateway.lovable.dev/v1',
      timeoutMs: options.timeoutMs,
      supportsTools: options.supportsTools ?? true,
      extraHeaders: {
        // Lovable's own client examples send the project key both as a
        // bearer token and via this header; sending both avoids a
        // guessing game about which one a given gateway deployment reads.
        'Lovable-API-Key': options.apiKey,
      },
    });
  }
}
