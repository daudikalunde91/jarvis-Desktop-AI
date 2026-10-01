import type { ILifecycle } from '@backend/shared/interfaces/ILifecycle';
import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';

/**
 * What the Agent Manager needs from any concrete agent. `BaseAgent`
 * (shared/base) implements this; no concrete agents exist yet.
 */
export interface IAgentDescriptor extends ILifecycle, IHealthCheckable {
  readonly id: string;
  readonly name: string;
}
