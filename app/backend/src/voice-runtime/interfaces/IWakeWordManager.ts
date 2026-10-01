import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';

export interface WakeWordDetectedEvent {
  timestamp: number;
  deviceId: string | null;
}

/**
 * Contract for a future wake-word engine. No detection algorithm is
 * implemented anywhere in this project — this interface exists solely
 * so VoiceRuntimeManager has something concrete to orchestrate against.
 * The runtime operates correctly with this subsystem entirely absent
 * (see VOICE_RUNTIME.md).
 */
export interface IWakeWordManager extends IHealthCheckable {
  startListening(): void | Promise<void>;
  stopListening(): void | Promise<void>;
  onWakeWordDetected(handler: (event: WakeWordDetectedEvent) => void): () => void;
}
