import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProviderCapabilities,
} from '@backend/ai/types';

/**
 * Contract every AI provider adapter must satisfy. This is the ONLY
 * surface the orchestrator/router/fallback-manager depend on — no
 * vendor-specific types leak past this boundary.
 */
export interface IAIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AIProviderCapabilities;

  /** True when the provider has the configuration it needs to be called at all. */
  isConfigured(): boolean;

  /**
   * Run one completion. MUST throw a subclass of `ProviderError`
   * (see `@backend/ai/errors`) on any failure — never a raw SDK/HTTP error.
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}
