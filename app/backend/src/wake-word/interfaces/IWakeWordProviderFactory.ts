import type { WakeWordProfile } from '@backend/wake-word/models/WakeWordProfile';
import type { SecureWakeLevel } from '@backend/wake-word/types/SecureWakeLevel';

export interface CreateWakeWordProfileInput {
  name?: string;
  wakeWordPhrase?: string;
  sensitivity?: number;
  confidenceThreshold?: number;
  cooldownMs?: number;
  secureWakeLevel?: SecureWakeLevel;
  enabled?: boolean;
}

/**
 * Centralizes construction of wake-word domain objects (profiles) so
 * `WakeWordManager` depends on this interface instead of the concrete
 * `WakeWordProfile` class — mirrors `AudioFactory` / `VoiceRuntimeFactory`.
 */
export interface IWakeWordProviderFactory {
  createProfile(input: CreateWakeWordProfileInput): WakeWordProfile;
}
