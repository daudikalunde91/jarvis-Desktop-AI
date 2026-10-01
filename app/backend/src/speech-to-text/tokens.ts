import { InjectionToken } from '@backend/shared/types/Token';
import type { ISpeechProviderRegistry } from '@backend/speech-to-text/interfaces/ISpeechProviderRegistry';
import type { ISpeechProviderFactory } from '@backend/speech-to-text/interfaces/ISpeechProviderFactory';
import type { ISpeechManager } from '@backend/voice-runtime/interfaces/ISpeechManager';

/**
 * DI Container tokens for the Speech-to-Text Architecture (Milestone
 * 3.2), registered into the *same* DI Container instance from
 * Milestones 2–4. `SpeechManager` is the concrete implementation of
 * Milestone 4.0's `ISpeechManager` — no duplicate speech manager type.
 */
export const SPEECH_TOKENS = {
  SpeechProviderRegistry: new InjectionToken<ISpeechProviderRegistry>('SpeechProviderRegistry'),
  SpeechProviderFactory: new InjectionToken<ISpeechProviderFactory>('SpeechProviderFactory'),
  SpeechManager: new InjectionToken<ISpeechManager>('SpeechManager'),
} as const;
