import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { SpeechResult } from '@backend/speech-to-text/models/SpeechResult';

export interface SpeechProviderCapabilities {
  languages: string[];
  supportsStreaming: boolean;
  supportsOffline: boolean;
  supportsAutoLanguageDetection: boolean;
}

/**
 * Contract a future concrete STT engine (Whisper.cpp, Google STT, Azure
 * Speech, ...) would implement. No such engine exists anywhere in this
 * project — this interface exists so `SpeechProviderRegistry` and
 * `SpeechManager` have something concrete to register and orchestrate
 * against.
 */
export interface ISpeechProvider {
  readonly id: string;
  readonly name: string;
  initialize(): void | Promise<void>;
  startStreaming(sessionId: string, language?: string): void | Promise<void>;
  stopStreaming(sessionId: string): void | Promise<void>;
  onPartialResult(handler: (result: SpeechResult) => void): () => void;
  onFinalResult(handler: (result: SpeechResult) => void): () => void;
  getCapabilities(): SpeechProviderCapabilities;
  healthCheck(): ModuleStatus | Promise<ModuleStatus>;
}
