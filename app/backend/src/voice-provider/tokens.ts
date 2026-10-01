import { InjectionToken } from '@backend/shared/types/Token';
import type { IVoiceProviderRegistry } from '@backend/voice-provider/interfaces/IVoiceProviderRegistry';
import type { IVoiceProviderFactory } from '@backend/voice-provider/interfaces/IVoiceProviderFactory';
import type { IVoiceManager } from '@backend/voice-runtime/interfaces/IVoiceManager';

/**
 * DI Container tokens for the Voice Provider Architecture (Milestone
 * 3.1), registered into the *same* DI Container instance from
 * Milestones 2–4. `VoiceManager` is the concrete implementation of
 * Milestone 4.0's `IVoiceManager` — no duplicate voice manager type.
 */
export const VOICE_PROVIDER_TOKENS = {
  VoiceProviderRegistry: new InjectionToken<IVoiceProviderRegistry>('VoiceProviderRegistry'),
  VoiceProviderFactory: new InjectionToken<IVoiceProviderFactory>('VoiceProviderFactory'),
  VoiceManager: new InjectionToken<IVoiceManager>('VoiceManager'),
} as const;
