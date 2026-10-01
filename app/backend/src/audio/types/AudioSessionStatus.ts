/** Lifecycle states for an AudioSession. */
export const AUDIO_SESSION_STATUSES = [
  'idle',
  'starting',
  'active',
  'ending',
  'ended',
  'failed',
] as const;
export type AudioSessionStatus = (typeof AUDIO_SESSION_STATUSES)[number];
