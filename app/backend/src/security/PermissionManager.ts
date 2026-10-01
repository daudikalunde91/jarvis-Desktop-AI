import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import { DEFAULT_ACTION_POLICIES, UNKNOWN_ACTION_POLICY } from '@backend/security/ActionPolicy';
import {
  ConfirmationRequiredError,
  PermissionDeniedError,
} from '@backend/security/errors/SecurityError';
import type {
  AuthorizeOptions,
  IPermissionManager,
} from '@backend/security/interfaces/IPermissionManager';
import {
  CONFIRMATION_REQUIRED_RISKS,
  ROLE_RANK,
  type ActionPolicy,
  type PermissionDecision,
  type PermissionRole,
} from '@backend/security/types/SecurityTypes';

/**
 * Deny-by-default permission engine.
 *
 * Rules, in order:
 *  1. An unclassified action falls back to `UNKNOWN_ACTION_POLICY`
 *     (sensitive / admin-only) — new agents cannot silently gain power.
 *  2. The caller's role must rank >= the policy's `minimumRole`.
 *  3. Any action whose risk is medium/high/sensitive requires an
 *     explicit `confirmed: true` from the user before it may run.
 */
export class PermissionManager implements IPermissionManager {
  private readonly policies = new Map<string, ActionPolicy>();
  private role: PermissionRole;

  constructor(
    private readonly logger: ILogger,
    role: PermissionRole = 'user',
    policies: readonly ActionPolicy[] = DEFAULT_ACTION_POLICIES,
  ) {
    this.role = role;
    for (const policy of policies) {
      this.policies.set(policy.action, policy);
    }
  }

  getRole(): PermissionRole {
    return this.role;
  }

  setRole(role: PermissionRole): void {
    this.logger.info(`Permission role changed: ${this.role} -> ${role}`);
    this.role = role;
  }

  getPolicy(action: string): ActionPolicy {
    return this.policies.get(action) ?? { ...UNKNOWN_ACTION_POLICY, action };
  }

  listPolicies(): readonly ActionPolicy[] {
    return [...this.policies.values()];
  }

  evaluate(action: string, options: AuthorizeOptions = {}): PermissionDecision {
    const policy = this.getPolicy(action);
    const role = options.role ?? this.role;
    const needsConfirmation = CONFIRMATION_REQUIRED_RISKS.includes(policy.risk);

    if (ROLE_RANK[role] < ROLE_RANK[policy.minimumRole]) {
      return {
        action,
        risk: policy.risk,
        allowed: false,
        requiresConfirmation: needsConfirmation,
        role,
        reason: `Role "${role}" is below the required role "${policy.minimumRole}" for ${action}`,
      };
    }

    if (needsConfirmation && options.confirmed !== true) {
      return {
        action,
        risk: policy.risk,
        allowed: false,
        requiresConfirmation: true,
        role,
        reason: `Action ${action} is ${policy.risk} risk and needs explicit confirmation`,
      };
    }

    return {
      action,
      risk: policy.risk,
      allowed: true,
      requiresConfirmation: needsConfirmation,
      role,
      reason: `Allowed for role "${role}"`,
    };
  }

  authorize(action: string, options: AuthorizeOptions = {}): PermissionDecision {
    const decision = this.evaluate(action, options);
    if (decision.allowed) return decision;

    if (decision.requiresConfirmation && options.confirmed !== true) {
      const policy = this.getPolicy(action);
      if (ROLE_RANK[decision.role] >= ROLE_RANK[policy.minimumRole]) {
        throw new ConfirmationRequiredError(decision.reason, { action, risk: decision.risk });
      }
    }

    throw new PermissionDeniedError(decision.reason, { action, risk: decision.risk });
  }

  healthCheck(): ModuleStatus {
    return this.policies.size > 0 ? 'running' : 'failed';
  }
}
