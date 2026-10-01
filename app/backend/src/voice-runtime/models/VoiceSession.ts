import type {
  IVoiceSession,
  IVoiceSessionMetadata,
} from '@backend/voice-runtime/interfaces/IVoiceSession';
import type { VoiceSessionState } from '@backend/voice-runtime/types/VoiceSessionState';
import { generateId } from '@backend/shared/utilities/generateId';

export interface VoiceSessionInput {
  audioSessionId?: string | null;
  language?: string;
  timeoutMs?: number;
  metadata?: IVoiceSessionMetadata;
}

/**
 * Concrete VoiceSession model. Holds identifiers, timing, and state
 * only — never audio or transcript payloads (those flow through events;
 * see VOICE_RUNTIME_EVENTS.md).
 */
export class VoiceSession implements IVoiceSession {
  public readonly id: string;
  public readonly audioSessionId: string | null;
  public readonly language: string;
  public readonly startedAt: number;
  public lastActivityAt: number;
  public endedAt: number | null = null;
  public readonly timeoutMs: number;
  public state: VoiceSessionState = 'listening-for-wake-word';
  public metadata: IVoiceSessionMetadata;

  constructor(input: VoiceSessionInput = {}) {
    this.id = generateId();
    this.audioSessionId = input.audioSessionId ?? null;
    this.language = input.language ?? 'en-US';
    this.startedAt = Date.now();
    this.lastActivityAt = this.startedAt;
    this.timeoutMs = input.timeoutMs ?? 30_000;
    this.metadata = input.metadata ?? {};
  }

  /** Resets the inactivity clock — called whenever a runtime event touches this session. */
  touch(): void {
    this.lastActivityAt = Date.now();
  }

  isExpired(now: number = Date.now()): boolean {
    return now - this.lastActivityAt > this.timeoutMs;
  }

  end(state: Extract<VoiceSessionState, 'ended' | 'timed-out' | 'failed'> = 'ended'): void {
    this.state = state;
    this.endedAt = Date.now();
  }
}
