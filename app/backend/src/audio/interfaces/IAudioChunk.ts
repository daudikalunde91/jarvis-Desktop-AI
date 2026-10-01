import type { AudioFormat } from '@backend/audio/types/AudioFormat';

/**
 * The envelope every stage of the pipeline passes along. `payload` is
 * intentionally generic (`Uint8Array` placeholder) — no codec, no real
 * capture. Chunks exist only to prove the pipeline can move structured
 * data end to end.
 */
export interface IAudioChunkMetadata {
  sessionId: string;
  sequence: number;
  capturedAt: number;
  format: AudioFormat;
  /** Free-form, non-audio annotations (e.g. a future VAD confidence score). */
  tags?: Record<string, unknown>;
}

export interface IAudioChunk {
  metadata: IAudioChunkMetadata;
  /** Placeholder payload — never persisted, never written to disk. */
  payload: Uint8Array;
}
