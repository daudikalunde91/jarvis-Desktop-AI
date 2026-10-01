import { InjectionToken } from '@backend/shared/types/Token';
import type { IWakeWordProviderRegistry } from '@backend/wake-word/interfaces/IWakeWordProviderRegistry';
import type { IWakeWordProviderFactory } from '@backend/wake-word/interfaces/IWakeWordProviderFactory';
import type { IWakeWordManager } from '@backend/voice-runtime/interfaces/IWakeWordManager';

/**
 * DI Container tokens for the Wake Word Architecture (Milestone 3.3),
 * registered into the *same* DI Container instance from Milestones 2–4.
 * `WakeWordManager` is registered against the *existing* `IWakeWordManager`
 * token space conceptually used by Milestone 4.0 — no second/duplicate
 * wake-word manager type is introduced.
 */
export const WAKE_WORD_TOKENS = {
  WakeWordProviderRegistry: new InjectionToken<IWakeWordProviderRegistry>(
    'WakeWordProviderRegistry',
  ),
  WakeWordProviderFactory: new InjectionToken<IWakeWordProviderFactory>('WakeWordProviderFactory'),
  WakeWordManager: new InjectionToken<IWakeWordManager>('WakeWordManager'),
} as const;
