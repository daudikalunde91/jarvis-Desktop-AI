import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

export interface HealthCheckFn {
  (): ModuleStatus | Promise<ModuleStatus>;
}

export interface HealthRecord {
  moduleId: string;
  status: ModuleStatus;
  lastHeartbeat: number | null;
  lastCheckedAt: number | null;
  failureCount: number;
}

export interface RegisterHealthOptions {
  /** Called when failureCount reaches maxConsecutiveFailures. */
  onFailureThresholdExceeded?: () => void | Promise<void>;
  maxConsecutiveFailures?: number;
}

/**
 * Monitors every registered module (agent, plugin, or infrastructure
 * service). Polls each registered check function on an interval,
 * tracks consecutive failures, and can trigger an automatic-restart
 * callback — it never restarts anything itself, it only calls back.
 */
export interface IHealthMonitor {
  register(moduleId: string, check: HealthCheckFn, options?: RegisterHealthOptions): void;
  unregister(moduleId: string): void;
  heartbeat(moduleId: string): void;
  getStatus(moduleId: string): ModuleStatus | undefined;
  getRecord(moduleId: string): HealthRecord | undefined;
  getAll(): HealthRecord[];
  startMonitoring(intervalMs?: number): void;
  stopMonitoring(): void;
  checkNow(moduleId: string): Promise<ModuleStatus>;
}
