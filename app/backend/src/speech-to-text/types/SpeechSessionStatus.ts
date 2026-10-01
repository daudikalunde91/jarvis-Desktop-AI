/** Lifecycle status of a single SpeechSession. */
export const SPEECH_SESSION_STATUSES = [
  'idle',
  'listening',
  'processing',
  'completed',
  'failed',
] as const;
export type SpeechSessionStatus = (typeof SPEECH_SESSION_STATUSES)[number];
