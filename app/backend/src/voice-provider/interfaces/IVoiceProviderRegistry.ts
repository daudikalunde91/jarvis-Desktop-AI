import type { IVoiceProvider } from '@backend/voice-provider/interfaces/IVoiceProvider';

/** Catalog of available TTS providers. Mirrors `ICapabilityRegistry` (Milestone 2). */
export interface IVoiceProviderRegistry {
  register(provider: IVoiceProvider): void;
  unregister(providerId: string): void;
  get(providerId: string): IVoiceProvider | undefined;
  list(): IVoiceProvider[];
  has(providerId: string): boolean;
}
