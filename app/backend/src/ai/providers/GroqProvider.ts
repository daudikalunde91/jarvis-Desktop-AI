import type { ILogger } from '@backend/logging/ILogger';
import { OpenAICompatibleProvider } from '@backend/ai/providers/OpenAICompatibleProvider';

export interface GroqProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

/**
 * Adapter for Groq's OpenAI-compatible Chat Completions API
 * (https://api.groq.com/openai/v1 — verified current as of this build).
 * Groq runs open-weight models (Llama, Gemma, DeepSeek, Kimi, GPT-OSS,
 * etc.) on its own LPU hardware at very high throughput and low latency,
 * which makes it a good *early* fallback candidate — see `config/default.
 * config.ts` priorities and `docs/AI_PROVIDERS.md`.
 *
 * `GROQ_MODEL` is deliberately not hardcoded to one value inside this
 * class (see constructor) — Groq's free-tier model line-up changes
 * fairly often; the current model catalog is at
 * https://console.groq.com/docs/models.
 */
export class GroqProvider extends OpenAICompatibleProvider {
  public readonly id = 'groq';
  public readonly name = 'Groq';

  constructor(logger: ILogger, options: GroqProviderOptions) {
    super(logger, 'groq', {
      apiKey: options.apiKey,
      model: options.model,
      baseUrl: options.baseUrl ?? 'https://api.groq.com/openai/v1',
      timeoutMs: options.timeoutMs,
      supportsTools: true,
    });
  }
}
