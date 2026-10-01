/** Lifecycle states of a single VoiceSession. */
export const VOICE_SESSION_STATES = [
  'listening-for-wake-word',
  'active',
  'processing',
  'responding',
  'ended',
  'timed-out',
  'failed',
] as const;
export type VoiceSessionState = (typeof VOICE_SESSION_STATES)[number];
