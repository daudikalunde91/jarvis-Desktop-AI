import type { VoiceProfile, VoiceProfileInput } from '@backend/voice-provider/models/VoiceProfile';

/**
 * Centralizes construction of voice-provider domain objects so
 * `VoiceManager` depends on this interface instead of the concrete
 * `VoiceProfile` class — mirrors `AudioFactory` / `VoiceRuntimeFactory`.
 */
export interface IVoiceProviderFactory {
  createProfile(input: VoiceProfileInput): VoiceProfile;
}
