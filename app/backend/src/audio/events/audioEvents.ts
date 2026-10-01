/**
 * Well-known event names for the audio subsystem, emitted through the
 * *existing* Event System (Milestone 2) — no new event engine is
 * introduced. Mirrors the pattern of `shared/events/systemEvents.ts`.
 */
export const AUDIO_EVENTS = {
  SESSION_STARTED: 'audio.session.started',
  SESSION_ENDED: 'audio.session.ended',
  SESSION_FAILED: 'audio.session.failed',
  DEVICE_REGISTERED: 'audio.device.registered',
  DEVICE_UNREGISTERED: 'audio.device.unregistered',
  DEFAULT_DEVICE_CHANGED: 'audio.device.default-changed',
  STAGE_REGISTERED: 'audio.pipeline.stage-registered',
  STAGE_UNREGISTERED: 'audio.pipeline.stage-unregistered',
  STAGE_HEALTH_FAILED: 'audio.pipeline.stage-health-failed',
} as const;

export type AudioEventName = (typeof AUDIO_EVENTS)[keyof typeof AUDIO_EVENTS];
