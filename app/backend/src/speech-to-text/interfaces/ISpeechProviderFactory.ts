import type {
  SpeechSession,
  SpeechSessionInput,
} from '@backend/speech-to-text/models/SpeechSession';
import type { SpeechResult } from '@backend/speech-to-text/models/SpeechResult';

export interface CreateSpeechResultInput {
  sessionId: string;
  text: string;
  confidence?: number | null;
  isFinal: boolean;
  language?: string | null;
}

/**
 * Centralizes construction of speech-to-text domain objects so
 * `SpeechManager` depends on this interface instead of concrete model
 * classes — mirrors `AudioFactory` / `VoiceRuntimeFactory`.
 */
export interface ISpeechProviderFactory {
  createSession(input: SpeechSessionInput): SpeechSession;
  createResult(input: CreateSpeechResultInput): SpeechResult;
}
