import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';
import type {
  ActionPolicy,
  PermissionDecision,
  PermissionRole,
} from '@backend/security/types/SecurityTypes';

export interface AuthorizeOptions {
  /** Role of the caller. Defaults to the manager's current role. */
  role?: PermissionRole;
  /** Set to true once the user has explicitly confirmed the action. */
  confirmed?: boolean;
}

/**
 * Central authority for "is JARVIS allowed to do this, right now,
 * for this user?". Every Action Executor call passes through it.
 */
export interface IPermissionManager extends IHealthCheckable {
  getRole(): PermissionRole;
  setRole(role: PermissionRole): void;
  getPolicy(action: string): ActionPolicy;
  listPolicies(): readonly ActionPolicy[];
  evaluate(action: string, options?: AuthorizeOptions): PermissionDecision;
  /** Throws `PermissionDeniedError` / `ConfirmationRequiredError` when not allowed. */
  authorize(action: string, options?: AuthorizeOptions): PermissionDecision;
}
