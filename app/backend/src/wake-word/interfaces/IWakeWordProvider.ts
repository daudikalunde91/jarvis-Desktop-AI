import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { WakeWordDetectedEvent } from '@backend/voice-runtime/interfaces/IWakeWordManager';

export interface WakeWordCapabilities {
  supportsOffline: boolean;
  supportsCustomWakeWord: boolean;
  supportedWakeWords: string[];
  languages: string[];
}

/**
 * Provider-level detection detail. Extends (never modifies) the M4.0
 * `WakeWordDetectedEvent` shape with a provider `confidence` score, used
 * internally by `WakeWordManager` for confidence-threshold filtering
 * before forwarding a plain `WakeWordDetectedEvent` up to the runtime.
 */
export interface ProviderWakeWordDetection extends WakeWordDetectedEvent {
  confidence?: number;
}

/**
 * Contract a future concrete wake-word engine (Porcupine, openWakeWord,
 * a custom model, ...) would implement. No such engine exists anywhere
 * in this project — this interface exists so `WakeWordProviderRegistry`
 * and `WakeWordManager` have something concrete to register and
 * orchestrate against.
 */
export interface IWakeWordProvider {
  readonly id: string;
  readonly name: string;
  initialize(): void | Promise<void>;
  startListening(): void | Promise<void>;
  stopListening(): void | Promise<void>;
  onDetected(handler: (event: ProviderWakeWordDetection) => void): () => void;
  getCapabilities(): WakeWordCapabilities;
  healthCheck(): ModuleStatus | Promise<ModuleStatus>;
}
