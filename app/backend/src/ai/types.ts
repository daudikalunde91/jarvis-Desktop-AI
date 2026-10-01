/**
 * AI Orchestration layer (Milestone 5.1) — shared type contracts.
 *
 * These types are provider-agnostic on purpose: nothing outside
 * `app/backend/src/ai` should ever import an OpenAI/Gemini/Anthropic
 * SDK type directly. Adapters translate to/from these shapes at the edge.
 */

/** The kind of work JARVIS is asking a provider to do. Drives routing. */
export const TASK_TYPES = ['general', 'coding', 'multimodal', 'planning'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export type AIRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  readonly role: AIRole;
  readonly content: string;
  /** Present when role === 'tool': which tool call this message answers. */
  readonly toolCallId?: string;
  readonly toolName?: string;
  /** Present when role === 'assistant' and the model requested tools. */
  readonly toolCalls?: readonly AIToolCall[];
}

/** JSON-schema-lite parameter description for a callable tool. */
export interface AIToolParameterSchema {
  readonly type: 'object';
  readonly properties: Record<string, unknown>;
  readonly required?: readonly string[];
}

export interface AIToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: AIToolParameterSchema;
  /** Minimum role required before ToolExecutor will run this tool. */
  readonly minRole: 'guest' | 'user' | 'admin';
  /** Dangerous tools require an explicit user confirmation round-trip. */
  readonly requiresConfirmation: boolean;
}

export interface AIToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface AIToolResult {
  readonly toolCallId: string;
  readonly name: string;
  readonly status: 'completed' | 'failed' | 'denied' | 'awaiting-confirmation';
  readonly content: string;
}

export interface AICompletionRequest {
  readonly sessionId: string;
  readonly taskType: TaskType;
  readonly messages: readonly AIMessage[];
  readonly tools?: readonly AIToolDefinition[];
  readonly requiresVision?: boolean;
  readonly signal?: AbortSignal;
}

export interface AICompletionUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
}

export interface AICompletionResponse {
  readonly providerId: string;
  readonly model: string;
  readonly text: string;
  readonly toolCalls: readonly AIToolCall[];
  readonly usage?: AICompletionUsage;
  readonly latencyMs: number;
}

/** Capability flags used by the router when scoring candidate providers. */
export interface AIProviderCapabilities {
  readonly vision: boolean;
  readonly toolCalling: boolean;
  readonly coding: boolean;
}

export type ProviderHealthState = 'ONLINE' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'DISABLED';

export interface ProviderHealthSnapshot {
  readonly providerId: string;
  readonly state: ProviderHealthState;
  /** Epoch ms; only set while state === 'RATE_LIMITED' or 'UNAVAILABLE'. */
  readonly retryAfter?: number;
  readonly lastError?: string;
  readonly lastCheckedAt: number;
}

export interface AIUsageEvent {
  readonly providerId: string;
  readonly model: string;
  readonly taskType: TaskType;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly success: boolean;
  readonly errorCategory?: string;
  readonly usage?: AICompletionUsage;
  readonly fallbackFrom?: string;
}
