import type { ICapability, CapabilityFilter } from '@backend/shared/interfaces/ICapability';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

/**
 * Where every future Agent and Plugin registers itself. Purely a
 * catalog — it stores descriptors and answers queries; it never
 * executes, loads, or manages the lifecycle of what it describes (that
 * is AgentManager's job).
 */
export interface ICapabilityRegistry {
  register(capability: ICapability): void;
  unregister(name: string): void;
  discover(filter?: CapabilityFilter): ICapability[];
  query(name: string): ICapability | undefined;
  updateStatus(name: string, status: ModuleStatus): void;
  getHealthStatus(name: string): ModuleStatus | undefined;
  has(name: string): boolean;
  list(): ICapability[];
}
