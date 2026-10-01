/**
 * Voice Provider Architecture (Milestone 3.1) barrel.
 *
 * Architecture only: no real Text-to-Speech engine, no downloaded voice
 * models, no external API calls. `VoiceManager` is the concrete class
 * that satisfies Milestone 4.0's `IVoiceManager` contract. The default
 * profile is a female, natural/calm/professional/friendly/clear voice —
 * fully configurable, never hardcoded to one provider.
 */
export * from '@backend/voice-provider/types';
export * from '@backend/voice-provider/errors';
export * from '@backend/voice-provider/interfaces';
export * from '@backend/voice-provider/models';
export * from '@backend/voice-provider/VoiceProviderRegistry';
export * from '@backend/voice-provider/VoiceProviderFactory';
export * from '@backend/voice-provider/VoiceManager';
export * from '@backend/voice-provider/tokens';
