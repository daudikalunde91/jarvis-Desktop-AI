/**
 * Milestone 9 — Security & Permissions type vocabulary.
 *
 * Roles and risk levels are declared as data (not conditionals scattered
 * across agents) so every action in the system is classified in exactly
 * one place: `ActionPolicy.ts`.
 */

export const PERMISSION_ROLES = ['guest', 'user', 'admin'] as const;
export type PermissionRole = (typeof PERMISSION_ROLES)[number];

/** Higher number = more privilege. Used for `minimumRole` comparisons. */
export const ROLE_RANK: Record<PermissionRole, number> = {
  guest: 0,
  user: 1,
  admin: 2,
};

export const RISK_LEVELS = ['low', 'medium', 'high', 'sensitive'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Which risk levels always require an explicit user confirmation before
 * the Action Executor is allowed to run them.
 */
export const CONFIRMATION_REQUIRED_RISKS: readonly RiskLevel[] = ['medium', 'high', 'sensitive'];

export interface ActionPolicy {
  /** Fully-qualified action id, e.g. `system.shutdown`. */
  readonly action: string;
  readonly risk: RiskLevel;
  readonly minimumRole: PermissionRole;
  readonly description: string;
}

export interface PermissionDecision {
  readonly action: string;
  readonly risk: RiskLevel;
  readonly allowed: boolean;
  readonly requiresConfirmation: boolean;
  readonly role: PermissionRole;
  readonly reason: string;
}
