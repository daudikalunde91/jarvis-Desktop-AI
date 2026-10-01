import type { ILogger } from '@backend/logging/ILogger';
import type { IAgentDescriptor } from '@backend/shared/interfaces/IAgentDescriptor';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

/**
 * Reusable base for future concrete agents. Provides default no-op
 * lifecycle hooks so a minimal agent only needs to override what it
 * actually uses. No agent behavior is implemented anywhere in this
 * milestone — this class exists purely as a contract for later ones.
 */
export abstract class BaseAgent implements IAgentDescriptor {
  protected constructor(
    public readonly id: string,
    public readonly name: string,
    protected readonly logger: ILogger,
  ) {}

  load(): void | Promise<void> {
    this.logger.debug(`Agent "${this.name}" load() not overridden — default no-op`);
  }

  unload(): void | Promise<void> {
    this.logger.debug(`Agent "${this.name}" unload() not overridden — default no-op`);
  }

  enable(): void | Promise<void> {
    this.logger.debug(`Agent "${this.name}" enable() not overridden — default no-op`);
  }

  disable(): void | Promise<void> {
    this.logger.debug(`Agent "${this.name}" disable() not overridden — default no-op`);
  }

  healthCheck(): ModuleStatus | Promise<ModuleStatus> {
    return 'running';
  }
}
