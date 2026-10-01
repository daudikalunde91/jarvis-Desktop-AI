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

export interface OpenAIProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

interface OpenAIChatResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/** Adapter for OpenAI's Chat Completions API. */
export class OpenAIProvider extends BaseHttpProvider implements IAIProvider {
  public readonly id = 'openai';
  public readonly name = 'OpenAI';
  public readonly capabilities: AIProviderCapabilities = {
    vision: true,
    toolCalling: true,
    coding: true,
  };

  constructor(logger: ILogger, private readonly options: OpenAIProviderOptions) {
    super('openai', logger);
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
    const baseUrl = (this.options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');

    const payload = await this.postJson({
      url: `${baseUrl}/chat/completions`,
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
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
          if (m.role === 'tool') return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId };
          return { role: m.role, content: m.content };
        }),
        tools: request.tools?.map((tool) => ({
          type: 'function',
          function: { name: codec.encode(tool.name), description: tool.description, parameters: tool.parameters },
        })),
      },
    });

    const data = payload as OpenAIChatResponse;
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
