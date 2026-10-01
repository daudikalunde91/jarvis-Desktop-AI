import type { ILogger } from '@backend/logging/ILogger';
import type { ActionAgentRegistry } from '@backend/agents/ActionAgentRegistry';
import type { IPermissionManager } from '@backend/security/interfaces/IPermissionManager';
import { ConfirmationRequiredError, PermissionDeniedError } from '@backend/security/errors/SecurityError';
import type { PermissionRole } from '@backend/security/types/SecurityTypes';
import type { AIToolCall, AIToolDefinition, AIToolResult } from '@backend/ai/types';
import { AI_TOOL_MAPPINGS } from '@backend/ai/tools/ToolDefinitions';
import { describeIntegrationAction } from '@backend/integrations/confirmationPreview';

export interface ToolExecutionContext {
  readonly sessionId: string;
  readonly role?: PermissionRole;
  readonly confirmed?: boolean;
}

/**
 * The "JARVIS Tool Registry" from the M5 tool-calling diagram:
 *
 *   AI -> Tool Request -> ToolRegistry -> Permission Check -> Agent -> Result -> AI
 *
 * An AI model NEVER executes anything directly. It only ever gets a
 * described set of tool names; this class is the sole bridge back into
 * the already-permissioned `ActionAgentRegistry` from M4.
 */
export class ToolRegistry {
  private readonly byName = new Map<string, string>(); // tool name -> agent action id

  constructor(
    private readonly logger: ILogger,
    private readonly agents: ActionAgentRegistry,
    private readonly permissions: IPermissionManager,
  ) {
    for (const mapping of AI_TOOL_MAPPINGS) {
      this.byName.set(mapping.definition.name, mapping.agentAction);
    }
  }

  /** Tool definitions to hand to an AI provider for a given role — dangerous tools included, they're gated at execution time. */
  definitionsFor(_role: PermissionRole): AIToolDefinition[] {
    return AI_TOOL_MAPPINGS.map((mapping) => mapping.definition);
  }

  async execute(call: AIToolCall, context: ToolExecutionContext): Promise<AIToolResult> {
    const agentAction = this.byName.get(call.name);
    if (!agentAction) {
      return { toolCallId: call.id, name: call.name, status: 'failed', content: `Unknown tool "${call.name}".` };
    }

    try {
      this.permissions.authorize(agentAction, { role: context.role, confirmed: context.confirmed });
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) {
        return {
          toolCallId: call.id,
          name: call.name,
          status: 'awaiting-confirmation',
          content:
            describeIntegrationAction(agentAction, call.arguments)
              ? `Confirmation required.\n${describeIntegrationAction(agentAction, call.arguments)}`
              : 'This action needs explicit user confirmation before it can run.',
        };
      }
      if (error instanceof PermissionDeniedError) {
        this.logger.warn('AI tool call denied by permissions', { tool: call.name, sessionId: context.sessionId });
        return {
          toolCallId: call.id,
          name: call.name,
          status: 'denied',
          content: 'This action is not permitted for the current role.',
        };
      }
      throw error;
    }

    const result = await this.agents.execute({
      action: agentAction,
      params: call.arguments,
      sessionId: context.sessionId,
    });

    return {
      toolCallId: call.id,
      name: call.name,
      status: result.ok ? 'completed' : 'failed',
      content: result.message,
    };
  }
}
