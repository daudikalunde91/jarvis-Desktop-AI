import type { AudioSessionStatus } from '@backend/audio/types/AudioSessionStatus';

export interface IAudioSessionMetadata {
  [key: string]: unknown;
}

/**
 * A single end-to-end audio interaction: which devices, which language,
 * how long it ran, and how it ended. No audio is stored on the session
 * itself — only descriptive/timing metadata.
 */
export interface IAudioSession {
  readonly id: string;
  readonly inputDeviceId: string | null;
  readonly outputDeviceId: string | null;
  readonly language: string;
  readonly startTime: number;
  endTime: number | null;
  /** Populated once the session ends: endTime - startTime. */
  latencyMs: number | null;
  status: AudioSessionStatus;
  metadata: IAudioSessionMetadata;
}
