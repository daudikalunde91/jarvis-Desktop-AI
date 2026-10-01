import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';
import type { IPermissionManager } from '@backend/security/interfaces/IPermissionManager';
import type { PermissionRole } from '@backend/security/types/SecurityTypes';
import type { ActionAgentRegistry } from '@backend/agents/ActionAgentRegistry';
import type { PlanExecution, StepOutcome, TaskPlan } from '@backend/brain/types';

export interface ExecutionContext {
  readonly sessionId: string;
  readonly role?: PermissionRole;
  /** True when the user has already approved this exact plan out loud. */
  readonly confirmed?: boolean;
}

/**
 * Runs a Task Plan step by step (Milestone 5 + 9).
 *
 * Every step is authorized *before* it runs. The first step that needs
 * confirmation stops the whole plan and is reported back, so JARVIS can
 * ask "Are you sure?" instead of half-performing a destructive request.
 */
export class ActionExecutor implements IHealthCheckable {
  constructor(
    private readonly logger: ILogger,
    private readonly registry: ActionAgentRegistry,
    private readonly permissions: IPermissionManager,
  ) {}

  async execute(plan: TaskPlan, context: ExecutionContext): Promise<PlanExecution> {
    const outcomes: StepOutcome[] = [];
    let pendingConfirmation: StepOutcome | null = null;

    for (const step of plan.steps) {
      if (pendingConfirmation) {
        outcomes.push({
          stepId: step.id,
          action: step.action,
          status: 'skipped',
          message: 'Waiting for confirmation of an earlier step.',
          risk: step.risk,
        });
        continue;
      }

      if (!step.action) {
        outcomes.push({
          stepId: step.id,
          action: null,
          status: 'completed',
          message: step.description,
          risk: step.risk,
        });
        continue;
      }

      const decision = this.permissions.evaluate(step.action, {
        role: context.role,
        confirmed: context.confirmed,
      });

      if (!decision.allowed) {
        const outcome: StepOutcome = {
          stepId: step.id,
          action: step.action,
          status: decision.requiresConfirmation && context.confirmed !== true ? 'awaiting-confirmation' : 'denied',
          message:
            decision.requiresConfirmation && context.confirmed !== true
              ? `${step.description} — this is a ${decision.risk} risk action. Should I go ahead?`
              : `I am not allowed to do that: ${decision.reason}`,
          risk: decision.risk,
        };
        outcomes.push(outcome);
        if (outcome.status === 'awaiting-confirmation') pendingConfirmation = outcome;
        this.logger.warn(`Step blocked: ${step.action}`, { reason: decision.reason });
        continue;
      }

      const result = await this.registry.execute({
        action: step.action,
        params: step.params,
        sessionId: context.sessionId,
      });

      outcomes.push({
        stepId: step.id,
        action: step.action,
        status: result.ok ? 'completed' : 'failed',
        message: result.message,
        risk: decision.risk,
        data: result.data,
      });
    }

    return {
      planId: plan.id,
      outcomes,
      completed: pendingConfirmation === null && outcomes.every((o) => o.status === 'completed'),
      pendingConfirmation,
    };
  }

  healthCheck(): ModuleStatus {
    return this.registry.healthCheck();
  }
}
