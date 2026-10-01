import type { ILogger } from '@backend/logging/ILogger';
import type { IAgentDescriptor } from '@backend/shared/interfaces/IAgentDescriptor';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import { AgentManagerError } from '@backend/shared/errors/InfrastructureError';
import { SYSTEM_EVENTS } from '@backend/shared/events/systemEvents';

import type {
  AgentRecord,
  IAgentManager,
  LoadAgentOptions,
} from '@backend/infrastructure/agent-manager/IAgentManager';
import type { IHealthMonitor } from '@backend/infrastructure/health-monitor/IHealthMonitor';
import type { IEventSystem } from '@backend/infrastructure/event-system/IEventSystem';

interface ManagedAgent {
  agent: IAgentDescriptor;
  status: ModuleStatus;
  dependencies: string[];
}

/**
 * Agent lifecycle infrastructure. No concrete agents are implemented —
 * this class only knows how to load/unload/enable/disable/restart
 * anything satisfying `IAgentDescriptor`, validate declared dependencies,
 * and (optionally) wire each agent into the Health Monitor.
 */
export class AgentManager implements IAgentManager {
  private readonly agents = new Map<string, ManagedAgent>();

  constructor(
    private readonly logger: ILogger,
    private readonly healthMonitor?: IHealthMonitor,
    private readonly eventSystem?: IEventSystem,
  ) {}

  async loadAgent(agent: IAgentDescriptor, options: LoadAgentOptions = {}): Promise<void> {
    if (this.agents.has(agent.id)) {
      throw new AgentManagerError(`Agent "${agent.id}" is already loaded`, { id: agent.id });
    }

    const dependencies = options.dependencies ?? [];
    this.validateDependencies(agent.id, dependencies);

    this.agents.set(agent.id, { agent, status: 'starting', dependencies });
    this.emit(SYSTEM_EVENTS.MODULE_LOADED, agent.id, 'normal');

    try {
      await agent.load();
      this.setStatus(agent.id, 'running');

      this.healthMonitor?.register(agent.id, () => agent.healthCheck(), {
        onFailureThresholdExceeded: () => this.restartAgent(agent.id),
      });

      this.logger.info(`Agent "${agent.name}" (${agent.id}) loaded`, { dependencies });
    } catch (error) {
      this.setStatus(agent.id, 'failed');
      this.emit(SYSTEM_EVENTS.MODULE_FAILED, agent.id, 'high');
      throw new AgentManagerError(`Agent "${agent.id}" failed to load`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async unloadAgent(id: string): Promise<void> {
    const managed = this.requireAgent(id);

    const dependents = Array.from(this.agents.values()).filter((m) => m.dependencies.includes(id));
    if (dependents.length > 0) {
      throw new AgentManagerError(
        `Cannot unload "${id}": still depended on by ${dependents
          .map((d) => d.agent.id)
          .join(', ')}`,
        { id, dependents: dependents.map((d) => d.agent.id) },
      );
    }

    await managed.agent.unload();
    this.healthMonitor?.unregister(id);
    this.agents.delete(id);
    this.emit(SYSTEM_EVENTS.MODULE_UNLOADED, id, 'normal');
    this.logger.info(`Agent "${managed.agent.name}" (${id}) unloaded`);
  }

  async enableAgent(id: string): Promise<void> {
    const managed = this.requireAgent(id);
    await managed.agent.enable();
    this.setStatus(id, 'running');
    this.emit(SYSTEM_EVENTS.MODULE_ENABLED, id, 'normal');
  }

  async disableAgent(id: string): Promise<void> {
    const managed = this.requireAgent(id);
    await managed.agent.disable();
    this.setStatus(id, 'stopped');
    this.emit(SYSTEM_EVENTS.MODULE_DISABLED, id, 'normal');
  }

  async restartAgent(id: string): Promise<void> {
    const managed = this.requireAgent(id);
    this.setStatus(id, 'restarting');
    this.logger.info(`Restarting agent "${managed.agent.name}" (${id})`);

    try {
      await managed.agent.disable();
      await managed.agent.enable();
      this.setStatus(id, 'running');
      this.emit(SYSTEM_EVENTS.MODULE_RESTARTED, id, 'normal');
    } catch (error) {
      this.setStatus(id, 'failed');
      this.emit(SYSTEM_EVENTS.MODULE_FAILED, id, 'critical');
      throw new AgentManagerError(`Agent "${id}" failed to restart`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getStatus(id: string): ModuleStatus | undefined {
    return this.agents.get(id)?.status;
  }

  list(): AgentRecord[] {
    return Array.from(this.agents.values()).map((m) => ({
      id: m.agent.id,
      name: m.agent.name,
      status: m.status,
      dependencies: [...m.dependencies],
    }));
  }

  private validateDependencies(agentId: string, dependencies: string[]): void {
    for (const dependencyId of dependencies) {
      const dependency = this.agents.get(dependencyId);
      if (!dependency) {
        throw new AgentManagerError(
          `Agent "${agentId}" declares dependency "${dependencyId}" which is not loaded`,
          { agentId, dependencyId },
        );
      }
      if (dependency.status !== 'running') {
        throw new AgentManagerError(
          `Agent "${agentId}" depends on "${dependencyId}", which is not running (status: ${dependency.status})`,
          { agentId, dependencyId, status: dependency.status },
        );
      }
    }
  }

  private requireAgent(id: string): ManagedAgent {
    const managed = this.agents.get(id);
    if (!managed) {
      throw new AgentManagerError(`No agent loaded with id "${id}"`, { id });
    }
    return managed;
  }

  private setStatus(id: string, status: ModuleStatus): void {
    const managed = this.agents.get(id);
    if (managed) {
      managed.status = status;
    }
  }

  private emit(
    name: string,
    agentId: string,
    priority: 'low' | 'normal' | 'high' | 'critical',
  ): void {
    this.eventSystem?.emit({
      name,
      category: 'agent',
      priority,
      timestamp: Date.now(),
      payload: { agentId },
    });
  }
}
