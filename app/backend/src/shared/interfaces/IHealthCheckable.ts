import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

/**
 * Anything the Health Monitor can poll. Agents, plugins, and
 * infrastructure services implement this to report their own status.
 */
export interface IHealthCheckable {
  healthCheck(): ModuleStatus | Promise<ModuleStatus>;
}
