import type { IAgentDescriptor } from '@backend/shared/interfaces/IAgentDescriptor';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

export interface LoadAgentOptions {
  /** IDs of other agents that must already be loaded and running. */
  dependencies?: string[];
}

export interface AgentRecord {
  id: string;
  name: string;
  status: ModuleStatus;
  dependencies: string[];
}

/**
 * Infrastructure for loading, unloading, enabling, disabling, and
 * restarting agents, plus validating their declared dependencies. Does
 * NOT implement any concrete agent — `IAgentDescriptor` is satisfied by
 * `BaseAgent` subclasses that don't exist yet.
 */
export interface IAgentManager {
  loadAgent(agent: IAgentDescriptor, options?: LoadAgentOptions): Promise<void>;
  unloadAgent(id: string): Promise<void>;
  enableAgent(id: string): Promise<void>;
  disableAgent(id: string): Promise<void>;
  restartAgent(id: string): Promise<void>;
  getStatus(id: string): ModuleStatus | undefined;
  list(): AgentRecord[];
}
