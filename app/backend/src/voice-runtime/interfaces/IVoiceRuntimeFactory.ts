import type {
  IVoiceSession,
  IVoiceSessionMetadata,
} from '@backend/voice-runtime/interfaces/IVoiceSession';

export interface CreateVoiceSessionInput {
  audioSessionId?: string | null;
  language?: string;
  timeoutMs?: number;
  metadata?: IVoiceSessionMetadata;
}

/**
 * Centralizes construction of runtime domain objects so
 * VoiceRuntimeManager depends on this interface instead of a concrete
 * VoiceSession class (Dependency Inversion), matching the AudioFactory
 * pattern from Milestone 3.
 */
export interface IVoiceRuntimeFactory {
  createSession(input: CreateVoiceSessionInput): IVoiceSession;
}
