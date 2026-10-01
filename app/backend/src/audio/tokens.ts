import { InjectionToken } from '@backend/shared/types/Token';
import type { IAudioManager } from '@backend/audio/interfaces/IAudioManager';
import type { IAudioRouter } from '@backend/audio/interfaces/IAudioRouter';
import type { IAudioFactory } from '@backend/audio/interfaces/IAudioFactory';

/**
 * DI Container tokens for the Audio Pipeline Architecture. Registered
 * into the *same* DI Container instance created in Milestone 2
 * (`bootstrap/AppBootstrapper.ts`) — no second container, no change to
 * the DIContainer implementation itself.
 */
export const AUDIO_TOKENS = {
  AudioManager: new InjectionToken<IAudioManager>('AudioManager'),
  AudioRouter: new InjectionToken<IAudioRouter>('AudioRouter'),
  AudioFactory: new InjectionToken<IAudioFactory>('AudioFactory'),
} as const;
