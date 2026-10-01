import type { ILogger } from '@backend/logging/ILogger';
import type { ILifecycle } from '@backend/shared/interfaces/ILifecycle';
import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';
import type { ICapability } from '@backend/shared/interfaces/ICapability';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

/**
 * Reusable base for future concrete plugins. Distinct from BaseAgent:
 * plugins declare a single ICapability describing what they add to the
 * system, rather than acting autonomously. No plugin behavior is
 * implemented anywhere in this milestone.
 */
export abstract class BasePlugin implements ILifecycle, IHealthCheckable {
  protected constructor(
    public readonly id: string,
    public readonly name: string,
    protected readonly logger: ILogger,
  ) {}

  /** Describes this plugin's capability for registration with the Capability Registry. */
  abstract getCapability(): ICapability;

  load(): void | Promise<void> {
    this.logger.debug(`Plugin "${this.name}" load() not overridden — default no-op`);
  }

  unload(): void | Promise<void> {
    this.logger.debug(`Plugin "${this.name}" unload() not overridden — default no-op`);
  }

  enable(): void | Promise<void> {
    this.logger.debug(`Plugin "${this.name}" enable() not overridden — default no-op`);
  }

  disable(): void | Promise<void> {
    this.logger.debug(`Plugin "${this.name}" disable() not overridden — default no-op`);
  }

  healthCheck(): ModuleStatus | Promise<ModuleStatus> {
    return 'running';
  }
}
