import type { ILogger } from '@backend/logging/ILogger';
import type { IAIProvider } from '@backend/ai/interfaces/IAIProvider';
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProviderCapabilities,
  AIToolCall,
} from '@backend/ai/types';
import { InvalidRequestError, ModelUnavailableError, ProviderError } from '@backend/ai/errors';
import { BaseHttpProvider } from '@backend/ai/providers/BaseHttpProvider';

export interface GeminiProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  /**
   * Feature G (model discovery). Defaults to true. When the configured
   * model 404s, Gemini's own `models.list` endpoint is queried once
   * (best-effort, short timeout) to find a currently-serving replacement
   * before falling back to the static `DOCUMENTED_FALLBACK_MODELS` list.
   * Set false to disable the live lookup entirely (static list only).
   */
  readonly modelDiscoveryEnabled?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> };
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

interface GeminiModelListResponse {
  models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
}

/**
 * Adapter for Google's Gemini `generateContent` API. Preferred for
 * `multimodal` routing.
 *
 * V7.2 / Stage 6 addition: Gemini model names drift over time (see
 * `docs/AI_PROVIDERS.md`) — a model that worked last month can start
 * 404ing with no code change on our side. Rather than hardcode one model
 * string and break every few months, this adapter treats the configured
 * `GEMINI_MODEL` as a *preference*: on a 404 it queries `models.list`
 * once for a currently-serving replacement (or falls back to a small
 * documented static list if discovery itself is unavailable), retries
 * that single request with the replacement, and — if that also works —
 * remembers it for the rest of the process so later calls skip straight
 * to the working model. This never runs at startup and never runs on a
 * healthy configuration, so it does not add latency to the common case.
 */
export class GeminiProvider extends BaseHttpProvider implements IAIProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini';
  public readonly capabilities: AIProviderCapabilities = {
    vision: true,
    toolCalling: true,
    coding: false,
  };

  /** A documented, hand-maintained fallback order — last resort if live discovery fails or is disabled. */
  private static readonly DOCUMENTED_FALLBACK_MODELS = [
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
  ];

  /** Once a replacement model is confirmed working, stick with it for the rest of this process. */
  private resolvedModel: string | undefined;
  private discoveredModels: string[] | undefined;
  private discoveryAttempted = false;

  constructor(logger: ILogger, private readonly options: GeminiProviderOptions) {
    super('gemini', logger);
  }

  isConfigured(): boolean {
    return Boolean(this.options.apiKey && this.options.model);
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.isConfigured()) {
      throw new InvalidRequestError(this.id, { reason: 'not configured' });
    }
    const preferredModel = this.resolvedModel ?? this.options.model;

    try {
      return await this.completeWithModel(preferredModel, request);
    } catch (error) {
      const canTryFallback =
        error instanceof ModelUnavailableError &&
        !this.resolvedModel && // already on a resolved fallback — swapping again won't help
        (this.options.modelDiscoveryEnabled ?? true);
      if (!canTryFallback) throw error;

      const fallbackModel = await this.findFallbackModel(preferredModel, request.signal);
      if (!fallbackModel) throw error;

      this.logger.warn(`Gemini model "${preferredModel}" unavailable — retrying with "${fallbackModel}"`, {
        configuredModel: preferredModel,
        replacementModel: fallbackModel,
      });

      try {
        const response = await this.completeWithModel(fallbackModel, request);
        this.resolvedModel = fallbackModel;
        return response;
      } catch (fallbackError) {
        // Feature A is explicit: never silently hide the real provider
        // error just because a fallback attempt was made. Surface both.
        const fallbackDetail = fallbackError instanceof ProviderError ? fallbackError.message : String(fallbackError);
        throw new ModelUnavailableError(this.id, {
          ...error.context,
          reason: 'configured and fallback models were both unavailable',
          configuredModel: preferredModel,
          attemptedFallbackModel: fallbackModel,
          fallbackError: fallbackDetail,
        });
      }
    }
  }

  private async completeWithModel(model: string, request: AICompletionRequest): Promise<AICompletionResponse> {
    const startedAt = Date.now();
    const baseUrl = (this.options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(
      /\/$/,
      '',
    );
    const system = request.messages.find((m) => m.role === 'system')?.content;
    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return {
            role: 'model',
            parts: [
              ...(m.content ? [{ text: m.content }] : []),
              ...m.toolCalls.map((call) => ({ functionCall: { name: call.name, args: call.arguments } })),
            ],
          };
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            parts: [{ functionResponse: { name: m.toolName ?? m.toolCallId ?? 'tool', response: { result: m.content } } }],
          };
        }
        return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
      });

    const payload = await this.postJson({
      // Feature O: the key now travels as a header (Google's current
      // guidance) instead of a query param, so it never needs URL
      // redaction on this path. BaseHttpProvider still redacts any
      // `key=`/`api_key=` query param defensively for callers/tests that
      // still pass one via a custom baseUrl.
      url: `${baseUrl}/models/${model}:generateContent`,
      headers: { 'x-goog-api-key': this.options.apiKey },
      timeoutMs: this.options.timeoutMs ?? 20_000,
      externalSignal: request.signal,
      body: {
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        tools: request.tools?.length
          ? [
              {
                functionDeclarations: request.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                })),
              },
            ]
          : undefined,
      },
    });

    const data = payload as GeminiResponse;
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) throw new ModelUnavailableError(this.id, { reason: 'empty response', model });

    const text = parts.map((part) => part.text ?? '').join('');
    const toolCalls: AIToolCall[] = parts
      .filter((part) => part.functionCall)
      .map((part, index) => ({
        id: `${this.id}-call-${index}`,
        name: part.functionCall!.name,
        arguments: part.functionCall!.args,
      }));

    return {
      providerId: this.id,
      model,
      text,
      toolCalls,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
      latencyMs: Date.now() - startedAt,
    };
  }

  /** Feature G: pick a replacement for a model that just 404'd. Never throws — a failed lookup just yields undefined. */
  private async findFallbackModel(failedModel: string, signal?: AbortSignal): Promise<string | undefined> {
    const discovered = await this.discoverModels(signal);
    const pool = discovered ?? GeminiProvider.DOCUMENTED_FALLBACK_MODELS;
    return pool.find((candidate) => candidate !== failedModel);
  }

  /** Queries `models.list` once per process (best-effort, short timeout); result is cached. */
  private async discoverModels(signal?: AbortSignal): Promise<string[] | undefined> {
    if (this.discoveredModels) return this.discoveredModels;
    if (this.discoveryAttempted) return undefined;
    this.discoveryAttempted = true;

    const baseUrl = (this.options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { 'x-goog-api-key': this.options.apiKey },
        signal: controller.signal,
      });
      if (!response.ok) return undefined;

      const data = (await response.json()) as GeminiModelListResponse;
      const usable = (data.models ?? [])
        .filter((entry) => entry.supportedGenerationMethods?.includes('generateContent'))
        .map((entry) => entry.name?.replace(/^models\//, ''))
        .filter((name): name is string => typeof name === 'string' && /flash|pro/i.test(name));

      this.discoveredModels = usable.length > 0 ? usable : undefined;
      return this.discoveredModels;
    } catch {
      // Discovery is strictly best-effort — the documented static list
      // covers this case, and the caller (Feature A) still surfaces the
      // real original error if the static fallback also fails.
      return undefined;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
