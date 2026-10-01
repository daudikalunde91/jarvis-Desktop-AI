/**
 * Lightweight descriptor for a unit of speech input. Deliberately does
 * not redefine an audio payload/format — real audio bytes conceptually
 * arrive via the existing Audio Pipeline's `AudioRouter.onSpeechData`
 * channel (Milestone 3.4), not through this type.
 */
export interface SpeechChunk {
  sessionId: string;
  sequence: number;
  timestamp: number;
}
