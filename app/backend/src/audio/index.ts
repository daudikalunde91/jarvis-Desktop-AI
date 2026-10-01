/**
 * Audio Pipeline Architecture barrel.
 *
 * Architecture only: interfaces, models, routing, and orchestration for
 * the audio pipeline (microphone input -> buffer -> noise reduction ->
 * echo cancellation -> wake-word/STT/TTS routing -> speaker output).
 * No microphone capture, no codec, no STT/TTS engine, no wake-word
 * detector, and no AI logic exist anywhere in this module.
 */
export * from '@backend/audio/types';
export * from '@backend/audio/errors';
export * from '@backend/audio/interfaces';
export * from '@backend/audio/models';
export * from '@backend/audio/buffer';
export * from '@backend/audio/metrics';
export * from '@backend/audio/pipeline';
export * from '@backend/audio/events';
export * from '@backend/audio/channels';
export * from '@backend/audio/AudioManagerConfig';
export * from '@backend/audio/AudioRouter';
export * from '@backend/audio/AudioFactory';
export * from '@backend/audio/AudioManager';
export * from '@backend/audio/tokens';
