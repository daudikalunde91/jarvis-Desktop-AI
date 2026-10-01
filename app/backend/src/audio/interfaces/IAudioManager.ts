import type { IAudioSession, IAudioSessionMetadata } from '@backend/audio/interfaces/IAudioSession';
import type { IAudioDevice } from '@backend/audio/interfaces/IAudioDevice';
import type { IAudioPipelineStage } from '@backend/audio/interfaces/IAudioPipelineStage';
import type { IAudioChunk } from '@backend/audio/interfaces/IAudioChunk';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

export interface StartSessionOptions {
  inputDeviceId?: string | null;
  outputDeviceId?: string | null;
  language?: string;
  metadata?: IAudioSessionMetadata;
}

export interface AudioStatistics {
  sessionsStarted: number;
  sessionsEnded: number;
  activeSessions: number;
  chunksProcessed: number;
  averageLatencyMs: number | null;
}

/**
 * Orchestrates the audio pipeline: session lifecycle, device management,
 * routing hand-off, buffer management, pipeline health, and statistics.
 * Never contains provider-specific logic (no microphone SDK, no codec,
 * no STT/TTS engine) — those are injected as `IAudioPipelineStage`
 * implementations by a future milestone.
 */
export interface IAudioManager {
  // Session lifecycle
  startSession(options?: StartSessionOptions): IAudioSession;
  endSession(sessionId: string): IAudioSession;
  getSession(sessionId: string): IAudioSession | undefined;
  listSessions(): IAudioSession[];

  // Device management
  registerDevice(device: IAudioDevice): void;
  unregisterDevice(deviceId: string): void;
  listDevices(type?: IAudioDevice['type']): IAudioDevice[];
  getDefaultDevice(type: IAudioDevice['type']): IAudioDevice | undefined;
  setDefaultDevice(deviceId: string): void;

  // Pipeline orchestration
  registerStage(stage: IAudioPipelineStage): void;
  unregisterStage(name: string): void;
  listStages(): IAudioPipelineStage[];
  processChunk(chunk: IAudioChunk): Promise<IAudioChunk | null>;

  // Pipeline health
  getPipelineHealth(): Record<string, ModuleStatus>;

  // Statistics
  getStatistics(): AudioStatistics;

  dispose(): void | Promise<void>;
}
