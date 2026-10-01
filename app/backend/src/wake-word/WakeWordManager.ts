import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IAudioRouter } from '@backend/audio/interfaces/IAudioRouter';
import type {
  IWakeWordManager,
  WakeWordDetectedEvent,
} from '@backend/voice-runtime/interfaces/IWakeWordManager';

import type { IWakeWordProviderRegistry } from '@backend/wake-word/interfaces/IWakeWordProviderRegistry';
import type { ProviderWakeWordDetection } from '@backend/wake-word/interfaces/IWakeWordProvider';
import type { ITrustedVoiceVerifier } from '@backend/wake-word/interfaces/ITrustedVoiceVerifier';
import { WakeWordProfile } from '@backend/wake-word/models/WakeWordProfile';
import type { DetectionState } from '@backend/wake-word/types/DetectionState';
import { WakeWordError } from '@backend/wake-word/errors/WakeWordError';

/**
 * Concrete implementation of the Wake Word Architecture (Milestone 3.3),
 * and simultaneously the concrete class that satisfies Milestone 4.0's
 * `IWakeWordManager` contract — this is the integration boundary: M4.0
 * defines the thin runtime-facing interface, M3.3 provides the real
 * provider-registry/profile/detection-state architecture underneath it.
 * No separate/duplicate "wake word manager" exists anywhere else.
 *
 * No real wake-word detection happens here — `startListening()` /
 * `stopListening()` only delegate to an *active provider* if one has
 * been registered, and none is registered anywhere in this project.
 */
export class WakeWordManager implements IWakeWordManager {
  private activeProviderId: string | null = null;
  private detectionState: DetectionState = 'idle';
  private lastTriggeredAt: number | null = null;
  private readonly handlers = new Set<(event: WakeWordDetectedEvent) => void>();
  private readonly providerUnsubscribers = new Map<string, () => void>();

  constructor(
    private readonly logger: ILogger,
    private readonly registry: IWakeWordProviderRegistry,
    private profile: WakeWordProfile,
    private readonly audioRouter?: IAudioRouter,
    private readonly secureWakeVerifier?: ITrustedVoiceVerifier,
  ) {
    // Dormant hook into the existing Audio Pipeline's dedicated wake-word
    // route (Milestone 3.4). Nothing publishes to this channel yet since
    // no microphone capture exists — this only proves the wiring is in
    // place for when it does.
    this.audioRouter?.onWakeWordData(() => {
      this.logger.debug(
        'WakeWordManager received routed audio data (no provider processes it yet)',
      );
    });
  }

  startListening(): void | Promise<void> {
    if (!this.profile.enabled) {
      this.detectionState = 'disabled';
      this.logger.debug('WakeWordManager.startListening() called but profile is disabled');
      return;
    }

    const provider = this.getActiveProvider();
    if (!provider) {
      this.detectionState = 'listening';
      this.logger.debug(
        'WakeWordManager.startListening(): no active provider registered — listening state only',
      );
      return;
    }

    this.detectionState = 'listening';
    return provider.startListening();
  }

  stopListening(): void | Promise<void> {
    const provider = this.getActiveProvider();
    this.detectionState = 'idle';
    if (provider) {
      return provider.stopListening();
    }
  }

  onWakeWordDetected(handler: (event: WakeWordDetectedEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  healthCheck(): ModuleStatus | Promise<ModuleStatus> {
    const provider = this.getActiveProvider();
    if (!provider) return 'stopped';
    return provider.healthCheck();
  }

  // ---- Wake Word Architecture (M3.3) surface, beyond the M4.0 contract ----

  registerProvider(provider: Parameters<IWakeWordProviderRegistry['register']>[0]): void {
    this.registry.register(provider);
    const unsubscribe = provider.onDetected((event) => this.handleProviderDetection(event));
    this.providerUnsubscribers.set(provider.id, unsubscribe);
  }

  unregisterProvider(providerId: string): void {
    this.providerUnsubscribers.get(providerId)?.();
    this.providerUnsubscribers.delete(providerId);
    this.registry.unregister(providerId);
    if (this.activeProviderId === providerId) {
      this.activeProviderId = null;
    }
  }

  setActiveProvider(providerId: string): void {
    if (!this.registry.has(providerId)) {
      throw new WakeWordError(
        `Cannot activate unknown wake-word provider "${providerId}"`,
        'WAKE_WORD_PROVIDER_ERROR',
        {
          providerId,
        },
      );
    }
    this.activeProviderId = providerId;
  }

  getActiveProvider() {
    return this.activeProviderId ? this.registry.get(this.activeProviderId) : undefined;
  }

  getProfile(): WakeWordProfile {
    return this.profile;
  }

  setProfile(profile: WakeWordProfile): void {
    this.profile = profile;
  }

  getDetectionState(): DetectionState {
    return this.detectionState;
  }

  /** Architecture prep for a future Secure Wake Mode — unused today, no verification logic exists. */
  getSecureWakeVerifier(): ITrustedVoiceVerifier | undefined {
    return this.secureWakeVerifier;
  }

  /** Called by an active provider whenever it believes it heard the wake word. */
  private handleProviderDetection(event: ProviderWakeWordDetection): void {
    if (this.detectionState !== 'listening') {
      return; // paused, disabled, or already in cooldown
    }

    if (event.confidence !== undefined && event.confidence < this.profile.confidenceThreshold) {
      this.logger.debug('Wake-word detection below confidence threshold — ignored', {
        confidence: event.confidence,
        threshold: this.profile.confidenceThreshold,
      });
      return;
    }

    const now = Date.now();
    if (this.lastTriggeredAt !== null && now - this.lastTriggeredAt < this.profile.cooldownMs) {
      this.logger.debug('Wake-word detection ignored — still in cooldown window');
      return;
    }

    this.lastTriggeredAt = now;
    this.detectionState = 'triggered';

    const forwarded: WakeWordDetectedEvent = {
      timestamp: event.timestamp,
      deviceId: event.deviceId,
    };
    for (const handler of this.handlers) {
      handler(forwarded);
    }

    this.detectionState = 'cooldown';
    setTimeout(() => {
      if (this.detectionState === 'cooldown') {
        this.detectionState = 'listening';
      }
    }, this.profile.cooldownMs).unref?.();
  }
}
