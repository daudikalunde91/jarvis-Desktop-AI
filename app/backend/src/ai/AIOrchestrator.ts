import type { ILogger } from '@backend/logging/ILogger';
import { ToolConfirmationRequiredError, type CloudRequest, type ICloudReasoner } from '@backend/brain/CloudReasoner';
import type { ProviderRegistry } from '@backend/ai/ProviderRegistry';
import type { ProviderHealthManager } from '@backend/ai/ProviderHealthManager';
import type { UsageTracker, UsageSummary } from '@backend/ai/UsageTracker';
import { FallbackManager } from '@backend/ai/FallbackManager';
import { ContextManager } from '@backend/ai/ContextManager';
import { AllProvidersFailedError } from '@backend/ai/errors';
import type { AIMessage, ProviderHealthSnapshot, TaskType } from '@backend/ai/types';
import type { ToolRegistry } from '@backend/ai/tools/ToolRegistry';

const CODING_HINTS = /\b(error|exception|stack trace|function|typescript|javascript|python|compile|bug|regex|refactor|code)\b/i;

/**
 * AIOrchestrator (M5.1): ProviderRegistry + ProviderHealthManager +
 * ProviderRouter + FallbackManager + ContextManager + UsageTracker,
 * composed behind the single `ICloudReasoner` port BrainManager already
 * depends on. BrainManager, RulesEngine, TaskPlanner and ActionExecutor
 * are untouched — this class is a drop-in replacement for
 * `NullCloudReasoner` / `OpenAiCompatibleReasoner`.
 */
export class AIOrchestrator implements ICloudReasoner {
  public readonly id = 'ai-orchestrator';

  private readonly context: ContextManager;

  constructor(
    private readonly logger: ILogger,
    private readonly registry: ProviderRegistry,
    private readonly health: ProviderHealthManager,
    private readonly fallback: FallbackManager,
    private readonly usage: UsageTracker,
    private readonly tools?: ToolRegistry,
    context?: ContextManager,
  ) {
    this.context = context ?? new ContextManager();
  }

  /** True if at least one registered provider is configured and not disabled. */
  isAvailable(): boolean {
    return this.registry.list().some((provider) => provider.isConfigured());
  }

  /**
   * Satisfies `ICloudReasoner` for BrainManager's open-conversation
   * fallback path. Local-first / rules / tools already run *before*
   * BrainManager ever reaches here (see BrainManager.handle) — by the
   * time this is called, JARVIS has already decided it needs a model.
   */
  async complete(request: CloudRequest): Promise<string> {
    const baseMessages: AIMessage[] = request.messages.map((m) => ({ role: m.role, content: m.content }));
    const trimmed = this.context.trim(baseMessages);
    const taskType = this.classifyTaskType(trimmed);

    try {
      let messages: AIMessage[] = trimmed.map((message) => ({ ...message }));
      const toolDefinitions = this.tools ? this.tools.definitionsFor(request.role ?? 'user') : undefined;
      for (let round = 0; round < 8; round += 1) {
        const response = await this.fallback.complete({
          sessionId: request.sessionId ?? 'brain-conversation',
          taskType,
          messages,
          tools: toolDefinitions,
          signal: request.signal,
        });
        if (!response.toolCalls.length) return response.text.trim();

        messages = [...messages, { role: 'assistant', content: response.text, toolCalls: response.toolCalls }];
        for (const call of response.toolCalls) {
          const result = this.tools
            ? await this.tools.execute(call, { sessionId: request.sessionId ?? 'brain-conversation', role: request.role ?? 'user' })
            : { toolCallId: call.id, name: call.name, status: 'failed' as const, content: 'Tool execution is unavailable.' };
          if (result.status === 'awaiting-confirmation') {
            throw new ToolConfirmationRequiredError(
              call,
              request.sessionId ?? 'brain-conversation',
              request.role ?? 'user',
              result.content,
            );
          }
          messages.push({ role: 'tool', content: result.content, toolCallId: result.toolCallId, toolName: result.name });
        }
      }
      return 'I reached the safe tool-execution limit for this request. Please tell me what you want me to continue with.';
    } catch (error) {
      if (error instanceof AllProvidersFailedError) {
        // FIX (startup-debug pass): logging only `attempts.length` (a bare
        // count, e.g. "3") told you nothing beyond what BrainManager's
        // user-facing summary already said. Log the per-provider code +
        // context here too, since this is the one place that sees every
        // failed attempt for the whole request in one shot.
        this.logger.warn('All AI providers failed; JARVIS will report cloud reasoning is unavailable', {
          attempts: error.attempts.map((a) => ({ providerId: a.providerId, code: a.code, ...a.context })),
        });
      }
      // Re-throw: BrainManager already falls back to an offline apology on
      // any thrown error here. We never fabricate a response.
      throw error;
    }
  }

  async executeConfirmedTool(call: import('@backend/ai/types').AIToolCall, sessionId: string, role: import('@backend/security/types/SecurityTypes').PermissionRole): Promise<string> {
    if (!this.tools) return 'Tool execution is unavailable.';
    const result = await this.tools.execute(call, { sessionId, role, confirmed: true });
    return result.content;
  }

  /** Safe-to-display health summary for the UI (no secrets, ever). */
  getHealthSummary(): ProviderHealthSnapshot[] {
    return this.health.snapshotAll(this.registry.list().map((p) => p.id));
  }

  getUsageSummary(): UsageSummary[] {
    return this.usage.summary();
  }

  private classifyTaskType(messages: readonly AIMessage[]): TaskType {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser && CODING_HINTS.test(lastUser.content)) return 'coding';
    return 'general';
  }
}
