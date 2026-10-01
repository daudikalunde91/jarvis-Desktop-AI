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

export interface ClaudeProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly maxTokens?: number;
  /**
   * Only needed for workspace-scoped gateways such as Claude Platform on
   * AWS, where every request must carry the target workspace in the
   * `anthropic-workspace-id` header. For direct api.anthropic.com usage
   * this is normally unnecessary — a standard `sk-ant-...` key is already
   * scoped to a workspace server-side — but is accepted here because the
   * M5 debug pass found at least one deployment that needed it. Never
   * logged; see BaseHttpProvider's redaction and the doctor.cjs
   * PRESENT/NOT SET reporting convention.
   */
  readonly workspaceId?: string;
}

interface ClaudeResponse {
  model?: string;
  content?: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Adapter for Anthropic's Messages API. Preferred for `coding` task routing. */
export class ClaudeProvider extends BaseHttpProvider implements IAIProvider {
  public readonly id = 'claude';
  public readonly name = 'Anthropic Claude';
  public readonly capabilities: AIProviderCapabilities = {
    vision: true,
    toolCalling: true,
    coding: true,
  };

  constructor(logger: ILogger, private readonly options: ClaudeProviderOptions) {
    super('claude', logger);
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
    const baseUrl = (this.options.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');

    const system = request.messages.find((m) => m.role === 'system')?.content;
    const conversation = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return {
            role: 'assistant',
            content: [
              ...(m.content ? [{ type: 'text', text: m.content }] : []),
              ...m.toolCalls.map((call) => ({ type: 'tool_use', id: call.id, name: codec.encode(call.name), input: call.arguments })),
            ],
          };
        }
        if (m.role === 'tool') {
          return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }] };
        }
        return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
      });

    const payload = await this.postJson({
      url: `${baseUrl}/messages`,
      headers: {
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
        ...(this.options.workspaceId ? { 'anthropic-workspace-id': this.options.workspaceId } : {}),
      },
      timeoutMs: this.options.timeoutMs ?? 20_000,
      externalSignal: request.signal,
      body: {
        model: this.options.model,
        max_tokens: this.options.maxTokens ?? 4096,
        system,
        messages: conversation,
        tools: request.tools?.map((tool) => ({
          name: codec.encode(tool.name),
          description: tool.description,
          input_schema: tool.parameters,
        })),
      },
    });

    const data = payload as ClaudeResponse;
    if (!data.content) throw new ModelUnavailableError(this.id, { reason: 'empty response' });

    const text = data.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const toolCalls: AIToolCall[] = data.content
      .filter((block): block is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        block.type === 'tool_use',
      )
      .map((block) => ({ id: block.id, name: codec.decode(block.name), arguments: block.input }));

    return {
      providerId: this.id,
      model: data.model ?? this.options.model,
      text,
      toolCalls,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens:
              data.usage.input_tokens !== undefined && data.usage.output_tokens !== undefined
                ? data.usage.input_tokens + data.usage.output_tokens
                : undefined,
          }
        : undefined,
      latencyMs: Date.now() - startedAt,
    };
  }
}
