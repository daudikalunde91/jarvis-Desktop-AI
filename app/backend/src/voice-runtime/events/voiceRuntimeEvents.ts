/**
 * The runtime event flow this milestone requires, emitted through the
 * *existing* Event System (Milestone 2) — no new event engine. Mirrors
 * `audio/events/audioEvents.ts` and `shared/events/systemEvents.ts`.
 */
export const VOICE_RUNTIME_EVENTS = {
  WAKE_WORD_DETECTED: 'voice.runtime.wake-word-detected',
  SPEECH_STARTED: 'voice.runtime.speech-started',
  SPEECH_FINISHED: 'voice.runtime.speech-finished',
  SPEECH_RECOGNIZED: 'voice.runtime.speech-recognized',
  VOICE_RESPONSE_READY: 'voice.runtime.voice-response-ready',
  SESSION_ENDED: 'voice.runtime.session-ended',
  ERROR: 'voice.runtime.error',
  STATE_CHANGED: 'voice.runtime.state-changed',
} as const;

export type VoiceRuntimeEventName =
  (typeof VOICE_RUNTIME_EVENTS)[keyof typeof VOICE_RUNTIME_EVENTS];
