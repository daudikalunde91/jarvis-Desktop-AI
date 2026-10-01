import type { ILogger } from '@backend/logging/ILogger';
import type { AIToolCall, AIToolDefinition } from '@backend/ai/types';
import type { PermissionRole } from '@backend/security/types/SecurityTypes';

export interface CloudMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface CloudRequest {
  readonly sessionId?: string;
  readonly role?: import('@backend/security/types/SecurityTypes').PermissionRole;
  readonly messages: readonly CloudMessage[];
  readonly tools?: readonly AIToolDefinition[];
  readonly signal?: AbortSignal;
}

/**
 * Optional last-resort reasoning provider. The Rules Engine handles every
 * command in the specification offline; the cloud is only consulted for
 * open-ended conversation, and only when the user has enabled it.
 */

export class ToolConfirmationRequiredError extends Error {
  constructor(
    public readonly toolCall: AIToolCall,
    public readonly sessionId: string,
    public readonly role: PermissionRole,
    message: string,
  ) {
    super(message);
    this.name = 'ToolConfirmationRequiredError';
  }
}

export interface ICloudReasoner {
  readonly id: string;
  isAvailable(): boolean;
  complete(request: CloudRequest): Promise<string>;
}

/** Used when cloud reasoning is disabled — keeps JARVIS fully offline. */
export class NullCloudReasoner implements ICloudReasoner {
  public readonly id = 'null-cloud-reasoner';

  isAvailable(): boolean {
    return false;
  }

  async complete(): Promise<string> {
    throw new Error('Cloud reasoning is disabled.');
  }
}

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

/**
 * Thin OpenAI-compatible client. Works with any gateway that exposes
 * `/chat/completions`; no vendor SDK is bundled, keeping the desktop
 * install small.
 */
export class OpenAiCompatibleReasoner implements ICloudReasoner {
  public readonly id = 'openai-compatible-reasoner';

  constructor(
    private readonly logger: ILogger,
    private readonly options: OpenAiCompatibleOptions,
  ) {}

  isAvailable(): boolean {
    return Boolean(this.options.apiKey && this.options.baseUrl && this.options.model);
  }

  async complete(request: CloudRequest): Promise<string> {
    if (!this.isAvailable()) throw new Error('Cloud reasoner is not configured.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20_000);
    request.signal?.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({ model: this.options.model, messages: request.messages }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Cloud reasoner returned ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('Cloud reasoner returned an empty response.');
      return content;
    } catch (error) {
      this.logger.warn('Cloud reasoning failed; staying offline', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
