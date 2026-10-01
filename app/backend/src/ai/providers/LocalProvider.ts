import type { IAIProvider } from '@backend/ai/interfaces/IAIProvider';
import type { AICompletionRequest, AICompletionResponse, AIProviderCapabilities } from '@backend/ai/types';
import { ModelUnavailableError } from '@backend/ai/errors';

/**
 * Placeholder for a future on-device model (e.g. a local llama.cpp/ONNX
 * runtime). Today it has no model to run, so it always reports itself as
 * unconfigured — the orchestrator's local-first layer (Rules Engine +
 * deterministic tools) is what actually keeps JARVIS useful offline.
 *
 * This class exists so the provider list and health panel always show a
 * "Local Engine" row, and so wiring in a real local model later is a
 * one-file change (implement `complete`, flip `isConfigured`).
 */
export class LocalProvider implements IAIProvider {
  public readonly id = 'local';
  public readonly name = 'Local Engine';
  public readonly capabilities: AIProviderCapabilities = {
    vision: false,
    toolCalling: false,
    coding: false,
  };

  isConfigured(): boolean {
    return false;
  }

  async complete(_request: AICompletionRequest): Promise<AICompletionResponse> {
    throw new ModelUnavailableError(this.id, { reason: 'no local model installed' });
  }
}
