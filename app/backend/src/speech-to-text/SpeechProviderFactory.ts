import type {
  CreateSpeechResultInput,
  ISpeechProviderFactory,
} from '@backend/speech-to-text/interfaces/ISpeechProviderFactory';
import {
  SpeechSession,
  type SpeechSessionInput,
} from '@backend/speech-to-text/models/SpeechSession';
import type { SpeechResult } from '@backend/speech-to-text/models/SpeechResult';

/** Centralizes construction of SpeechSession and SpeechResult instances. */
export class SpeechProviderFactory implements ISpeechProviderFactory {
  createSession(input: SpeechSessionInput): SpeechSession {
    return new SpeechSession(input);
  }

  createResult(input: CreateSpeechResultInput): SpeechResult {
    return {
      sessionId: input.sessionId,
      text: input.text,
      confidence: input.confidence ?? null,
      isFinal: input.isFinal,
      language: input.language ?? null,
      timestamp: Date.now(),
    };
  }
}
