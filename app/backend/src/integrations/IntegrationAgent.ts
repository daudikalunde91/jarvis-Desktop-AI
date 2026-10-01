import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import { fail, ok, type ActionRequest, type ActionResult, type IActionAgent } from '@backend/agents/types';
import { toIntegrationError } from '@backend/integrations/errors';
import type { IntegrationManager } from '@backend/integrations/IntegrationManager';

/**
 * Bridges the existing action-agent pipeline (ToolRegistry -> PermissionManager ->
 * agent) to IntegrationManager. Permission + confirmation are enforced upstream
 * by ActionPolicy; capability grants are enforced by IntegrationManager.
 */
export class IntegrationAgent implements IActionAgent {
  public readonly id = 'integration-agent';
  public readonly actions: readonly string[];

  constructor(
    private readonly logger: ILogger,
    private readonly manager: IntegrationManager,
  ) {
    this.actions = manager.listActions();
  }

  async execute(request: ActionRequest): Promise<ActionResult> {
    try {
      const result = await this.manager.execute(request.action, request.params ?? {});
      return ok(request.action, result.summary, result.data);
    } catch (error) {
      const e = toIntegrationError(error);
      this.logger.debug('Integration action failed', { action: request.action, code: e.integrationCode });
      // Machine-readable code lets the AI say "needs authorization" instead of inventing results.
      return fail(request.action, e.userMessage, { code: e.integrationCode });
    }
  }

  healthCheck(): ModuleStatus {
    return this.manager.healthCheck();
  }
}
