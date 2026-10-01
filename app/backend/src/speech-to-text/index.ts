/**
 * Speech-to-Text Architecture (Milestone 3.2) barrel.
 *
 * Architecture only: no real transcription engine, no downloaded
 * models, no external API calls. `SpeechManager` is the concrete class
 * that satisfies Milestone 4.0's `ISpeechManager` contract. English and
 * Swahili are both first-class languages (see
 * `types/SupportedLanguage.ts`).
 */
export * from '@backend/speech-to-text/types';
export * from '@backend/speech-to-text/errors';
export * from '@backend/speech-to-text/interfaces';
export * from '@backend/speech-to-text/models';
export * from '@backend/speech-to-text/SpeechProviderRegistry';
export * from '@backend/speech-to-text/SpeechProviderFactory';
export * from '@backend/speech-to-text/SpeechManager';
export * from '@backend/speech-to-text/tokens';
