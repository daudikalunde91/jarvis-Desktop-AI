import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';

/** A single executable request handed to an action agent. */
export interface ActionRequest {
  readonly action: string;
  readonly params?: Record<string, unknown>;
  readonly sessionId?: string;
}

export interface ActionResult {
  readonly action: string;
  readonly ok: boolean;
  /** Human-readable, speakable summary of what happened. */
  readonly message: string;
  readonly data?: unknown;
}

/**
 * Every capability agent (system, files, browser, coding, vision, ...)
 * implements this one contract, so the Action Executor never needs to
 * know which agent it is talking to.
 */
export interface IActionAgent extends IHealthCheckable {
  readonly id: string;
  /** Fully-qualified action ids this agent can execute. */
  readonly actions: readonly string[];
  execute(request: ActionRequest): Promise<ActionResult>;
}

export function ok(action: string, message: string, data?: unknown): ActionResult {
  return { action, ok: true, message, data };
}

export function fail(action: string, message: string, data?: unknown): ActionResult {
  return { action, ok: false, message, data };
}

export function requiredString(
  params: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = params?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
