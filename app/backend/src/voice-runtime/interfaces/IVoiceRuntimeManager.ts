import type {
  IVoiceSession,
  IVoiceSessionMetadata,
} from '@backend/voice-runtime/interfaces/IVoiceSession';
import type { VoiceRuntimeState } from '@backend/voice-runtime/types/VoiceRuntimeState';
import type { VoiceSubsystemName } from '@backend/voice-runtime/types/VoiceSubsystemName';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

export interface StartVoiceSessionOptions {
  audioSessionId?: string | null;
  language?: string;
  metadata?: IVoiceSessionMetadata;
}

export interface VoiceRuntimeStatistics {
  state: VoiceRuntimeState;
  uptimeMs: number | null;
  sessionsStarted: number;
  sessionsEnded: number;
  sessionsTimedOut: number;
  wakeWordDetections: number;
  speechRecognitions: number;
  errors: number;
}

/**
 * Orchestrates the voice runtime end to end: initializes the connected
 * subsystems, drives the runtime lifecycle (start/stop/pause/resume),
 * manages VoiceSessions, aggregates health, and reports statistics.
 *
 * VoiceRuntimeManager never implements provider behavior itself — it
 * only calls into whichever `IWakeWordManager` / `ISpeechManager` /
 * `IVoiceManager` were supplied at construction (all optional; none
 * exist in this project yet) and the existing `IAudioManager`.
 */
export interface IVoiceRuntimeManager {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  dispose(): Promise<void>;

  startVoiceSession(options?: StartVoiceSessionOptions): IVoiceSession;
  endVoiceSession(sessionId: string): IVoiceSession;
  getVoiceSession(sessionId: string): IVoiceSession | undefined;
  listVoiceSessions(): IVoiceSession[];

  getState(): VoiceRuntimeState;
  getRuntimeHealth(): Record<VoiceSubsystemName, ModuleStatus>;
  getStatistics(): VoiceRuntimeStatistics;
}
