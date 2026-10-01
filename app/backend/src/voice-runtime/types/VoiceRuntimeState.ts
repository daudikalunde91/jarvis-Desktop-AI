/**
 * Lifecycle states of the Voice Runtime itself (not a single session).
 * Mirrors the shape of `ModuleStatus` but is deliberately its own type —
 * the runtime has states (`paused`) that a generic module doesn't need.
 */
export const VOICE_RUNTIME_STATES = [
  'idle',
  'initializing',
  'running',
  'pausing',
  'paused',
  'resuming',
  'stopping',
  'stopped',
  'failed',
] as const;
export type VoiceRuntimeState = (typeof VOICE_RUNTIME_STATES)[number];
