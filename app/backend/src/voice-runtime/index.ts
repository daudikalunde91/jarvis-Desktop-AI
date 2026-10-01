/**
 * Voice Runtime Framework barrel.
 *
 * Runtime orchestration only: connects AudioManager (Milestone 3),
 * Communication Bus / Event System / Health Monitor (Milestone 2), and
 * optional WakeWordManager / SpeechManager / VoiceManager providers (no
 * concrete implementation of any of the three exists in this project)
 * into one lifecycle-managed pipeline. No AI Brain, intent detection, or
 * command execution exists anywhere in this module.
 */
export * from '@backend/voice-runtime/types';
export * from '@backend/voice-runtime/errors';
export * from '@backend/voice-runtime/interfaces';
export * from '@backend/voice-runtime/models';
export * from '@backend/voice-runtime/events';
export * from '@backend/voice-runtime/VoiceRuntimeConfig';
export * from '@backend/voice-runtime/VoiceRuntimeFactory';
export * from '@backend/voice-runtime/VoiceRuntimeManager';
export * from '@backend/voice-runtime/tokens';
