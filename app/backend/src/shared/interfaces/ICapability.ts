import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { Priority } from '@backend/shared/types/Priority';

/**
 * Everything a future Agent or Plugin must declare to register itself
 * with the Capability Registry. Purely descriptive — no behavior.
 */
export interface ICapability {
  name: string;
  version: string;
  description: string;
  owner: string;
  permissionsRequired: string[];
  priority: Priority;
  offlineSupport: boolean;
  status: ModuleStatus;
  dependencies: string[];
  estimatedExecutionTimeMs: number;
  category: string;
}

export type CapabilityFilter = Partial<
  Pick<ICapability, 'category' | 'status' | 'owner' | 'priority'>
>;
