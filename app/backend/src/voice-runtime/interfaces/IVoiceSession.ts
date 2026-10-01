import type { VoiceSessionState } from '@backend/voice-runtime/types/VoiceSessionState';

export interface IVoiceSessionMetadata {
  [key: string]: unknown;
}

/**
 * A single wake-word-to-response interaction. Correlates with (but is
 * distinct from) an `IAudioSession` from the Audio Pipeline Architecture
 * — a VoiceSession represents the runtime's view of "one voice
 * interaction," an AudioSession represents "one audio device session."
 */
export interface IVoiceSession {
  readonly id: string;
  readonly audioSessionId: string | null;
  readonly language: string;
  readonly startedAt: number;
  lastActivityAt: number;
  endedAt: number | null;
  readonly timeoutMs: number;
  state: VoiceSessionState;
  metadata: IVoiceSessionMetadata;
}
