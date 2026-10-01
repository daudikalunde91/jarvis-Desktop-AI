import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import { INFRASTRUCTURE_DEFAULTS } from '@backend/shared/constants/infrastructure.constants';
import { HealthMonitorError } from '@backend/shared/errors/InfrastructureError';
import { SYSTEM_EVENTS } from '@backend/shared/events/systemEvents';

import type {
  HealthCheckFn,
  HealthRecord,
  IHealthMonitor,
  RegisterHealthOptions,
} from '@backend/infrastructure/health-monitor/IHealthMonitor';
import type { IEventSystem } from '@backend/infrastructure/event-system/IEventSystem';

interface RegisteredModule {
  check: HealthCheckFn;
  record: HealthRecord;
  maxConsecutiveFailures: number;
  onFailureThresholdExceeded?: () => void | Promise<void>;
}

/**
 * Polls every registered module on an interval and tracks status,
 * heartbeat, and consecutive-failure count. Restart is delegated to a
 * caller-supplied callback — HealthMonitor observes and reports, it does
 * not know how to restart an agent (that's AgentManager's job).
 */
export class HealthMonitor implements IHealthMonitor {
  private readonly modules = new Map<string, RegisteredModule>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly defaultMaxConsecutiveFailures: number;

  constructor(
    private readonly logger: ILogger,
    private readonly eventSystem?: IEventSystem,
    defaultMaxConsecutiveFailures?: number,
  ) {
    this.defaultMaxConsecutiveFailures =
      defaultMaxConsecutiveFailures ?? INFRASTRUCTURE_DEFAULTS.healthMonitor.maxConsecutiveFailures;
  }

  register(moduleId: string, check: HealthCheckFn, options: RegisterHealthOptions = {}): void {
    if (this.modules.has(moduleId)) {
      throw new HealthMonitorError(`Module "${moduleId}" is already registered`, { moduleId });
    }

    this.modules.set(moduleId, {
      check,
      maxConsecutiveFailures: options.maxConsecutiveFailures ?? this.defaultMaxConsecutiveFailures,
      onFailureThresholdExceeded: options.onFailureThresholdExceeded,
      record: {
        moduleId,
        status: 'stopped',
        lastHeartbeat: null,
        lastCheckedAt: null,
        failureCount: 0,
      },
    });

    this.logger.debug(`Health Monitor: registered "${moduleId}"`);
  }

  unregister(moduleId: string): void {
    this.modules.delete(moduleId);
    this.logger.debug(`Health Monitor: unregistered "${moduleId}"`);
  }

  heartbeat(moduleId: string): void {
    const entry = this.modules.get(moduleId);
    if (!entry) {
      throw new HealthMonitorError(`Cannot heartbeat unknown module "${moduleId}"`, { moduleId });
    }
    entry.record.lastHeartbeat = Date.now();
  }

  getStatus(moduleId: string): ModuleStatus | undefined {
    return this.modules.get(moduleId)?.record.status;
  }

  getRecord(moduleId: string): HealthRecord | undefined {
    const entry = this.modules.get(moduleId);
    return entry ? { ...entry.record } : undefined;
  }

  getAll(): HealthRecord[] {
    return Array.from(this.modules.values()).map((entry) => ({ ...entry.record }));
  }

  startMonitoring(intervalMs = INFRASTRUCTURE_DEFAULTS.healthMonitor.pollIntervalMs): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.pollAll();
    }, intervalMs);
    // Do not keep the Node.js process alive solely for health polling.
    this.timer.unref?.();
    this.logger.info(`Health Monitor: polling started (every ${intervalMs}ms)`);
  }

  stopMonitoring(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('Health Monitor: polling stopped');
    }
  }

  async checkNow(moduleId: string): Promise<ModuleStatus> {
    const entry = this.modules.get(moduleId);
    if (!entry) {
      throw new HealthMonitorError(`Cannot check unknown module "${moduleId}"`, { moduleId });
    }
    return this.poll(moduleId, entry);
  }

  private async pollAll(): Promise<void> {
    await Promise.all(
      Array.from(this.modules.entries()).map(([moduleId, entry]) => this.poll(moduleId, entry)),
    );
  }

  private async poll(moduleId: string, entry: RegisteredModule): Promise<ModuleStatus> {
    entry.record.lastCheckedAt = Date.now();

    try {
      const status = await entry.check();
      entry.record.status = status;

      if (status === 'failed') {
        await this.handleFailure(moduleId, entry);
      } else {
        if (entry.record.failureCount > 0) {
          this.logger.info(
            `Module "${moduleId}" recovered after ${entry.record.failureCount} failure(s)`,
          );
        }
        entry.record.failureCount = 0;
        this.eventSystem?.emit({
          name: SYSTEM_EVENTS.HEALTH_CHECK_PASSED,
          category: 'system',
          priority: 'low',
          timestamp: Date.now(),
          payload: { moduleId, status },
        });
      }

      return status;
    } catch (error) {
      entry.record.status = 'failed';
      await this.handleFailure(moduleId, entry, error);
      return 'failed';
    }
  }

  private async handleFailure(
    moduleId: string,
    entry: RegisteredModule,
    error?: unknown,
  ): Promise<void> {
    entry.record.failureCount += 1;
    this.logger.warn(
      `Health check failed for "${moduleId}" (count: ${entry.record.failureCount})`,
      {
        error: error instanceof Error ? error.message : undefined,
      },
    );

    this.eventSystem?.emit({
      name: SYSTEM_EVENTS.HEALTH_CHECK_FAILED,
      category: 'system',
      priority: 'high',
      timestamp: Date.now(),
      payload: { moduleId, failureCount: entry.record.failureCount },
    });

    if (
      entry.record.failureCount >= entry.maxConsecutiveFailures &&
      entry.onFailureThresholdExceeded
    ) {
      this.logger.error(
        `Module "${moduleId}" exceeded ${entry.maxConsecutiveFailures} consecutive failures — triggering restart callback`,
      );
      entry.record.status = 'restarting';
      await entry.onFailureThresholdExceeded();
      entry.record.failureCount = 0;
    }
  }
}
