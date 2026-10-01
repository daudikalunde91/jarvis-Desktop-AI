import type { ILogger } from '@backend/logging/ILogger';
import type { IAIProvider } from '@backend/ai/interfaces/IAIProvider';
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProviderCapabilities,
  AIToolCall,
} from '@backend/ai/types';
import { InvalidRequestError, ModelUnavailableError } from '@backend/ai/errors';
import { BaseHttpProvider } from '@backend/ai/providers/BaseHttpProvider';
import { ProviderToolNameCodec } from '@backend/ai/tools/ProviderToolNames';

export interface OpenAICompatibleProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  /** Extra headers merged into every request (attribution headers, secondary auth headers, etc). Never logged. */
  readonly extraHeaders?: Record<string, string>;
  /**
   * Not every model behind an aggregator (OpenRouter especially) supports
   * function/tool calling. When false, `tools` are silently dropped from
   * the outgoing request instead of letting the upstream API reject the
   * whole call with a 400 — this is the "gracefully report unsupported
   * capabilities" behavior called for in Stage 6 / Feature D. Defaults to
   * true (the common case for Groq/OpenRouter/Lovable's default models).
   */
  readonly supportsTools?: boolean;
}

interface OpenAICompatibleChatResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/**
 * Shared adapter for any provider that speaks OpenAI's Chat Completions
 * wire format (Groq, OpenRouter, Lovable AI Gateway, and any future
 * OpenAI-compatible endpoint). Concrete subclasses only supply id/name/
 * defaults — request/response shaping lives here exactly once, per the
 * Stage 6 instruction: "If Lovable uses an OpenAI-compatible interface,
 * reuse the existing compatible-provider abstraction instead of
 * duplicating unnecessary code." `OpenAIProvider` itself predates this
 * base and is left untouched (smallest safe change) since it already
 * works and nothing requires moving it.
 */
export abstract class OpenAICompatibleProvider extends BaseHttpProvider implements IAIProvider {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public readonly capabilities: AIProviderCapabilities;

  protected constructor(
    logger: ILogger,
    providerId: string,
    private readonly options: OpenAICompatibleProviderOptions,
  ) {
    super(providerId, logger);
    this.capabilities = {
      vision: false,
      toolCalling: options.supportsTools ?? true,
      coding: true,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.options.apiKey && this.options.model);
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.isConfigured()) {
      throw new InvalidRequestError(this.id, { reason: 'not configured' });
    }
    const startedAt = Date.now();
    const codec = new ProviderToolNameCodec(request.tools);
    const baseUrl = this.options.baseUrl.replace(/\/$/, '');
    const allowTools = this.options.supportsTools ?? true;

    const payload = await this.postJson({
      url: `${baseUrl}/chat/completions`,
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        ...this.options.extraHeaders,
      },
      timeoutMs: this.options.timeoutMs ?? 20_000,
      externalSignal: request.signal,
      body: {
        model: this.options.model,
        messages: request.messages.map((m) => {
          if (m.role === 'assistant' && m.toolCalls?.length) {
            return {
              role: 'assistant' as const,
              content: m.content || null,
              tool_calls: m.toolCalls.map((call) => ({
                id: call.id,
                type: 'function',
                function: { name: codec.encode(call.name), arguments: JSON.stringify(call.arguments) },
              })),
            };
          }
          if (m.role === 'tool') {
            return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId };
          }
          return { role: m.role, content: m.content };
        }),
        ...(allowTools && request.tools?.length
          ? {
              tools: request.tools.map((tool) => ({
                type: 'function',
                function: { name: codec.encode(tool.name), description: tool.description, parameters: tool.parameters },
              })),
            }
          : {}),
      },
    });

    const data = payload as OpenAICompatibleChatResponse;
    const message = data.choices?.[0]?.message;
    if (!message) throw new ModelUnavailableError(this.id, { reason: 'empty response' });

    const toolCalls: AIToolCall[] = (message.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: codec.decode(call.function.name),
      arguments: this.safeParseArgs(call.function.arguments),
    }));

    return {
      providerId: this.id,
      model: data.model ?? this.options.model,
      text: message.content ?? '',
      toolCalls,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      latencyMs: Date.now() - startedAt,
    };
  }

  private safeParseArgs(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
