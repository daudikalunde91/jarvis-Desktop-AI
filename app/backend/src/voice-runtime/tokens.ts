import { InjectionToken } from '@backend/shared/types/Token';
import type { IVoiceRuntimeManager } from '@backend/voice-runtime/interfaces/IVoiceRuntimeManager';
import type { IVoiceRuntimeFactory } from '@backend/voice-runtime/interfaces/IVoiceRuntimeFactory';
import type { IWakeWordManager } from '@backend/voice-runtime/interfaces/IWakeWordManager';
import type { ISpeechManager } from '@backend/voice-runtime/interfaces/ISpeechManager';
import type { IVoiceManager } from '@backend/voice-runtime/interfaces/IVoiceManager';

/**
 * DI Container tokens for the Voice Runtime Framework, registered into
 * the *same* DI Container instance created in Milestone 2 and extended
 * in Milestone 3. `DIContainer.ts` itself is not modified.
 *
 * `WakeWordManager` / `SpeechManager` / `VoiceManager` tokens are
 * declared here so a future provider milestone has a stable token to
 * register against, but nothing registers a concrete implementation for
 * them yet — no such implementation exists in this project. See
 * VOICE_RUNTIME.md for how VoiceRuntimeManager operates with these
 * subsystems absent.
 */
export const VOICE_RUNTIME_TOKENS = {
  VoiceRuntimeManager: new InjectionToken<IVoiceRuntimeManager>('VoiceRuntimeManager'),
  VoiceRuntimeFactory: new InjectionToken<IVoiceRuntimeFactory>('VoiceRuntimeFactory'),
  WakeWordManager: new InjectionToken<IWakeWordManager>('WakeWordManager'),
  SpeechManager: new InjectionToken<ISpeechManager>('SpeechManager'),
  VoiceManager: new InjectionToken<IVoiceManager>('VoiceManager'),
} as const;
