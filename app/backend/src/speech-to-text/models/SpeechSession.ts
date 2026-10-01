import { generateId } from '@backend/shared/utilities/generateId';
import type { SpeechSessionStatus } from '@backend/speech-to-text/types/SpeechSessionStatus';

export interface SpeechSessionInput {
  runtimeSessionId: string;
  language?: string;
  autoDetectLanguage?: boolean;
}

/**
 * One speech-recognition interaction, correlated with a Voice Runtime
 * session (Milestone 4.0) via `runtimeSessionId`. Holds no audio or
 * transcript payload permanently — transcripts flow through
 * `SpeechResult` events only.
 */
export class SpeechSession {
  public readonly id: string;
  public readonly runtimeSessionId: string;
  public readonly language: string;
  public readonly autoDetectLanguage: boolean;
  public readonly startedAt: number;
  public status: SpeechSessionStatus = 'idle';
  public endedAt: number | null = null;

  constructor(input: SpeechSessionInput) {
    this.id = generateId();
    this.runtimeSessionId = input.runtimeSessionId;
    this.language = input.language ?? 'en-US';
    this.autoDetectLanguage = input.autoDetectLanguage ?? false;
    this.startedAt = Date.now();
  }

  end(status: Extract<SpeechSessionStatus, 'completed' | 'failed'> = 'completed'): void {
    this.status = status;
    this.endedAt = Date.now();
  }
}
