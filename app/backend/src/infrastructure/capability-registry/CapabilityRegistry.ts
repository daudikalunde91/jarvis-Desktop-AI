import type { ILogger } from '@backend/logging/ILogger';
import type { ICapability, CapabilityFilter } from '@backend/shared/interfaces/ICapability';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import { CapabilityRegistryError } from '@backend/shared/errors/InfrastructureError';
import { SYSTEM_EVENTS } from '@backend/shared/events/systemEvents';

import type { ICapabilityRegistry } from '@backend/infrastructure/capability-registry/ICapabilityRegistry';
import type { IEventSystem } from '@backend/infrastructure/event-system/IEventSystem';

/**
 * In-memory Capability Registry, keyed by capability name.
 *
 * A capability is a description only — registering one does not start,
 * load, or execute anything. Optionally emits SYSTEM_EVENTS through an
 * injected IEventSystem so other infrastructure (e.g. a future dashboard)
 * can react to registration changes without this class knowing about them.
 */
export class CapabilityRegistry implements ICapabilityRegistry {
  private readonly capabilities = new Map<string, ICapability>();

  constructor(
    private readonly logger: ILogger,
    private readonly eventSystem?: IEventSystem,
  ) {}

  register(capability: ICapability): void {
    if (this.capabilities.has(capability.name)) {
      throw new CapabilityRegistryError(`Capability "${capability.name}" is already registered`, {
        name: capability.name,
      });
    }

    for (const dependency of capability.dependencies) {
      if (dependency === capability.name) {
        throw new CapabilityRegistryError(
          `Capability "${capability.name}" cannot depend on itself`,
        );
      }
    }

    this.capabilities.set(capability.name, { ...capability });
    this.logger.info(`Capability registered: ${capability.name}@${capability.version}`, {
      category: capability.category,
      owner: capability.owner,
    });

    this.eventSystem?.emit({
      name: SYSTEM_EVENTS.CAPABILITY_REGISTERED,
      category: 'system',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { name: capability.name, version: capability.version },
    });
  }

  unregister(name: string): void {
    if (!this.capabilities.has(name)) {
      throw new CapabilityRegistryError(`Cannot unregister unknown capability "${name}"`, {
        name,
      });
    }

    const dependents = this.list().filter((c) => c.dependencies.includes(name));
    if (dependents.length > 0) {
      throw new CapabilityRegistryError(
        `Cannot unregister "${name}": still depended on by ${dependents
          .map((d) => d.name)
          .join(', ')}`,
        { name, dependents: dependents.map((d) => d.name) },
      );
    }

    this.capabilities.delete(name);
    this.logger.info(`Capability unregistered: ${name}`);

    this.eventSystem?.emit({
      name: SYSTEM_EVENTS.CAPABILITY_UNREGISTERED,
      category: 'system',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { name },
    });
  }

  discover(filter?: CapabilityFilter): ICapability[] {
    let results = this.list();

    if (filter?.category) {
      results = results.filter((c) => c.category === filter.category);
    }
    if (filter?.status) {
      results = results.filter((c) => c.status === filter.status);
    }
    if (filter?.owner) {
      results = results.filter((c) => c.owner === filter.owner);
    }
    if (filter?.priority) {
      results = results.filter((c) => c.priority === filter.priority);
    }

    return results;
  }

  query(name: string): ICapability | undefined {
    const capability = this.capabilities.get(name);
    return capability ? { ...capability } : undefined;
  }

  updateStatus(name: string, status: ModuleStatus): void {
    const capability = this.capabilities.get(name);
    if (!capability) {
      throw new CapabilityRegistryError(`Cannot update status of unknown capability "${name}"`, {
        name,
      });
    }
    capability.status = status;
    this.logger.debug(`Capability "${name}" status changed to "${status}"`);
  }

  getHealthStatus(name: string): ModuleStatus | undefined {
    return this.capabilities.get(name)?.status;
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  list(): ICapability[] {
    return Array.from(this.capabilities.values()).map((c) => ({ ...c }));
  }
}
