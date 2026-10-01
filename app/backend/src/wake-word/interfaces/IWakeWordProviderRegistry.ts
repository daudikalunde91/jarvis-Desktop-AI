import type { IWakeWordProvider } from '@backend/wake-word/interfaces/IWakeWordProvider';

/**
 * Catalog of available wake-word providers. Mirrors the
 * `ICapabilityRegistry` pattern from Milestone 2 — stores descriptors
 * and answers queries; never executes or manages provider lifecycle
 * itself (that's `WakeWordManager`'s job).
 */
export interface IWakeWordProviderRegistry {
  register(provider: IWakeWordProvider): void;
  unregister(providerId: string): void;
  get(providerId: string): IWakeWordProvider | undefined;
  list(): IWakeWordProvider[];
  has(providerId: string): boolean;
}
