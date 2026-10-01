import type { IVoiceProviderFactory } from '@backend/voice-provider/interfaces/IVoiceProviderFactory';
import { VoiceProfile, type VoiceProfileInput } from '@backend/voice-provider/models/VoiceProfile';

/** Centralizes construction of VoiceProfile instances. */
export class VoiceProviderFactory implements IVoiceProviderFactory {
  createProfile(input: VoiceProfileInput): VoiceProfile {
    return new VoiceProfile(input);
  }
}
