/**
 * Channel names used by AudioRouter when publishing through the
 * *existing* Event System. Kept separate from `audioEvents.ts` (which
 * covers lifecycle notifications) — these are the five data routes the
 * milestone's "Audio Router" section requires.
 */
export const AUDIO_CHANNELS = {
  MICROPHONE: 'audio.route.microphone',
  WAKE_WORD: 'audio.route.wake-word',
  SPEECH_TO_TEXT: 'audio.route.speech-to-text',
  TTS_OUTPUT: 'audio.route.tts-output',
  MONITORING: 'audio.route.monitoring',
} as const;

export type AudioChannel = (typeof AUDIO_CHANNELS)[keyof typeof AUDIO_CHANNELS];
