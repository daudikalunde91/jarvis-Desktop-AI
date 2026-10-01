import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IAudioRouter } from '@backend/audio/interfaces/IAudioRouter';
import type {
  IVoiceManager,
  VoiceResponseReadyEvent,
} from '@backend/voice-runtime/interfaces/IVoiceManager';

import type { IVoiceProviderRegistry } from '@backend/voice-provider/interfaces/IVoiceProviderRegistry';
import type { VoiceProfile } from '@backend/voice-provider/models/VoiceProfile';
import { VoiceProviderError } from '@backend/voice-provider/errors/VoiceProviderError';

/**
 * Concrete implementation of the Voice Provider Architecture (Milestone
 * 3.1), and simultaneously the concrete class that satisfies Milestone
 * 4.0's `IVoiceManager` contract — the same integration boundary
 * `WakeWordManager` and `SpeechManager` use for M3.3/M3.2. No
 * separate/duplicate "voice manager" exists anywhere else.
 *
 * No real speech synthesis happens here — `speak()` only delegates to
 * an *active provider* if one has been registered, and none is
 * registered anywhere in this project. Without a provider, a `speak()`
 * call is acknowledged (logged) but produces no
 * `onVoiceResponseReady` callback — this is expected: there is nothing
 * to actually synthesize a response, so the correlated VoiceSession
 * will time out via its own inactivity window rather than this class
 * fabricating a response.
 */
export class VoiceManager implements IVoiceManager {
  private activeProviderId: string | null = null;
  private readonly handlers = new Set<(event: VoiceResponseReadyEvent) => void>();
  private readonly providerUnsubscribers = new Map<string, () => void>();

  constructor(
    private readonly logger: ILogger,
    private readonly registry: IVoiceProviderRegistry,
    private defaultProfile: VoiceProfile,
    private readonly audioRouter?: IAudioRouter,
  ) {}

  speak(sessionId: string, text: string): void | Promise<void> {
    const provider = this.getActiveProvider();
    if (!provider) {
      this.logger.debug(`No active voice provider — speak() acknowledged with no synthesis`, {
        sessionId,
      });
      return;
    }

    return provider.startSynthesis(sessionId, text);
  }

  cancel(sessionId: string): void | Promise<void> {
    const provider = this.getActiveProvider();
    if (provider) {
      return provider.cancelSynthesis(sessionId);
    }
  }

  onVoiceResponseReady(handler: (event: VoiceResponseReadyEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  healthCheck(): ModuleStatus | Promise<ModuleStatus> {
    const provider = this.getActiveProvider();
    if (!provider) return 'stopped';
    return provider.healthCheck();
  }

  // ---- Voice Provider Architecture (M3.1) surface, beyond the M4.0 contract ----

  registerProvider(provider: Parameters<IVoiceProviderRegistry['register']>[0]): void {
    this.registry.register(provider);
    const unsubscribe = provider.onSynthesisComplete((event) =>
      this.handleSynthesisComplete(event),
    );
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
      throw new VoiceProviderError(`Cannot activate unknown voice provider "${providerId}"`, {
        providerId,
      });
    }
    this.activeProviderId = providerId;
  }

  getActiveProvider() {
    return this.activeProviderId ? this.registry.get(this.activeProviderId) : undefined;
  }

  getDefaultProfile(): VoiceProfile {
    return this.defaultProfile;
  }

  setDefaultProfile(profile: VoiceProfile): void {
    this.defaultProfile = profile;
  }

  private handleSynthesisComplete(event: VoiceResponseReadyEvent): void {
    // Route the synthesized-response marker through the existing Audio
    // Pipeline's dedicated TTS-output channel (Milestone 3.4) so any
    // future speaker-output stage can observe it — dormant today since
    // no real synthesis produces audio.
    this.audioRouter?.routeTTSOutput({
      payload: new Uint8Array(),
      metadata: {
        sessionId: event.sessionId,
        sequence: 0,
        capturedAt: Date.now(),
        format: {
          sampleRateHz: this.defaultProfile.metadata.sampleRateHz,
          channels: 1,
          bitDepth: 16,
        },
      },
    });

    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
