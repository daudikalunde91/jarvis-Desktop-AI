import type { ISpeechProvider } from '@backend/speech-to-text/interfaces/ISpeechProvider';

/** Catalog of available STT providers. Mirrors `ICapabilityRegistry` (Milestone 2). */
export interface ISpeechProviderRegistry {
  register(provider: ISpeechProvider): void;
  unregister(providerId: string): void;
  get(providerId: string): ISpeechProvider | undefined;
  list(): ISpeechProvider[];
  has(providerId: string): boolean;
}
