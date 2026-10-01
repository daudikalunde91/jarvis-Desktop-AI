import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';

export interface SpeechRecognizedEvent {
  sessionId: string;
  text: string;
  confidence: number | null;
}

/**
 * Contract for a future Speech-to-Text engine. No recognition logic is
 * implemented anywhere in this project.
 */
export interface ISpeechManager extends IHealthCheckable {
  startRecognition(sessionId: string): void | Promise<void>;
  stopRecognition(sessionId: string): void | Promise<void>;
  onSpeechStarted(handler: (sessionId: string) => void): () => void;
  onSpeechFinished(handler: (sessionId: string) => void): () => void;
  onSpeechRecognized(handler: (event: SpeechRecognizedEvent) => void): () => void;
}
