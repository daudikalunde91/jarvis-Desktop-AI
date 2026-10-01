import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';

export interface VoiceResponseReadyEvent {
  sessionId: string;
  text: string;
}

/**
 * Contract for a future voice-output (Text-to-Speech) manager. No
 * synthesis logic is implemented anywhere in this project. Named
 * "VoiceManager" (not "TTSManager") to match the milestone's own
 * requested class list.
 */
export interface IVoiceManager extends IHealthCheckable {
  speak(sessionId: string, text: string): void | Promise<void>;
  cancel(sessionId: string): void | Promise<void>;
  onVoiceResponseReady(handler: (event: VoiceResponseReadyEvent) => void): () => void;
}
