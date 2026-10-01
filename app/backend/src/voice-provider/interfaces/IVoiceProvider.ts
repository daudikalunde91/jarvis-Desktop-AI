import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { VoiceGender } from '@backend/voice-provider/types/VoiceGender';
import type { VoiceDeploymentMode } from '@backend/voice-provider/types/VoiceDeploymentMode';
import type { VoiceResponseReadyEvent } from '@backend/voice-runtime/interfaces/IVoiceManager';

export interface VoiceCapabilities {
  genders: VoiceGender[];
  languages: string[];
  supportsSSML: boolean;
  deploymentMode: VoiceDeploymentMode;
}

/**
 * Contract a future concrete TTS engine (OpenAI TTS, ElevenLabs, Azure
 * Speech, Google Cloud TTS, Amazon Polly, Piper, Kokoro, ...) would
 * implement. No such engine exists anywhere in this project — this
 * interface exists so `VoiceProviderRegistry` and `VoiceManager` have
 * something concrete to register and orchestrate against.
 */
export interface IVoiceProvider {
  readonly id: string;
  readonly name: string;
  initialize(): void | Promise<void>;
  startSynthesis(sessionId: string, text: string): void | Promise<void>;
  cancelSynthesis(sessionId: string): void | Promise<void>;
  onSynthesisComplete(handler: (event: VoiceResponseReadyEvent) => void): () => void;
  getCapabilities(): VoiceCapabilities;
  healthCheck(): ModuleStatus | Promise<ModuleStatus>;
}
