import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IAudioRouter } from '@backend/audio/interfaces/IAudioRouter';
import type {
  ISpeechManager,
  SpeechRecognizedEvent,
} from '@backend/voice-runtime/interfaces/ISpeechManager';

import type { ISpeechProviderRegistry } from '@backend/speech-to-text/interfaces/ISpeechProviderRegistry';
import type { ISpeechProviderFactory } from '@backend/speech-to-text/interfaces/ISpeechProviderFactory';
import type { SpeechSession } from '@backend/speech-to-text/models/SpeechSession';
import type { SpeechResult } from '@backend/speech-to-text/models/SpeechResult';
import { SpeechError, SpeechSessionError } from '@backend/speech-to-text/errors/SpeechError';

export interface SpeechManagerConfig {
  defaultLanguage: string;
  autoDetectLanguage: boolean;
}

/**
 * Concrete implementation of the Speech-to-Text Architecture (Milestone
 * 3.2), and simultaneously the concrete class that satisfies Milestone
 * 4.0's `ISpeechManager` contract — the same integration boundary
 * `WakeWordManager` uses for M3.3. No separate/duplicate "speech
 * manager" exists anywhere else.
 *
 * No real speech recognition happens here — `startRecognition()` /
 * `stopRecognition()` only delegate to an *active provider* if one has
 * been registered, and none is registered anywhere in this project.
 */
export class SpeechManager implements ISpeechManager {
  private activeProviderId: string | null = null;
  private readonly sessions = new Map<string, SpeechSession>();
  private readonly startedHandlers = new Set<(sessionId: string) => void>();
  private readonly finishedHandlers = new Set<(sessionId: string) => void>();
  private readonly recognizedHandlers = new Set<(event: SpeechRecognizedEvent) => void>();
  private readonly providerUnsubscribers = new Map<string, Array<() => void>>();

  constructor(
    private readonly logger: ILogger,
    private readonly registry: ISpeechProviderRegistry,
    private readonly factory: ISpeechProviderFactory,
    private readonly config: SpeechManagerConfig,
    private readonly audioRouter?: IAudioRouter,
  ) {
    // Dormant hook into the existing Audio Pipeline's dedicated
    // speech-to-text route (Milestone 3.4). Nothing publishes to this
    // channel yet since no microphone capture exists.
    this.audioRouter?.onSpeechData(() => {
      this.logger.debug('SpeechManager received routed audio data (no provider processes it yet)');
    });
  }

  startRecognition(sessionId: string): void | Promise<void> {
    if (this.sessions.has(sessionId)) {
      this.logger.debug(`Speech recognition already tracked for session "${sessionId}"`);
      return;
    }

    const session = this.factory.createSession({
      runtimeSessionId: sessionId,
      language: this.config.defaultLanguage,
      autoDetectLanguage: this.config.autoDetectLanguage,
    });
    session.status = 'listening';
    this.sessions.set(sessionId, session);

    const provider = this.getActiveProvider();
    if (!provider) {
      this.logger.debug(`No active speech provider — session "${sessionId}" tracked but idle`);
      return;
    }

    return provider.startStreaming(sessionId, session.language);
  }

  stopRecognition(sessionId: string): void | Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.end('completed');

    const provider = this.getActiveProvider();
    if (provider) {
      return provider.stopStreaming(sessionId);
    }
  }

  onSpeechStarted(handler: (sessionId: string) => void): () => void {
    this.startedHandlers.add(handler);
    return () => this.startedHandlers.delete(handler);
  }

  onSpeechFinished(handler: (sessionId: string) => void): () => void {
    this.finishedHandlers.add(handler);
    return () => this.finishedHandlers.delete(handler);
  }

  onSpeechRecognized(handler: (event: SpeechRecognizedEvent) => void): () => void {
    this.recognizedHandlers.add(handler);
    return () => this.recognizedHandlers.delete(handler);
  }

  healthCheck(): ModuleStatus | Promise<ModuleStatus> {
    const provider = this.getActiveProvider();
    if (!provider) return 'stopped';
    return provider.healthCheck();
  }

  // ---- Speech-to-Text Architecture (M3.2) surface, beyond the M4.0 contract ----

  registerProvider(provider: Parameters<ISpeechProviderRegistry['register']>[0]): void {
    this.registry.register(provider);
    const unsubscribers = [
      provider.onPartialResult((result) => this.handlePartialResult(result)),
      provider.onFinalResult((result) => this.handleFinalResult(result)),
    ];
    this.providerUnsubscribers.set(provider.id, unsubscribers);
  }

  unregisterProvider(providerId: string): void {
    this.providerUnsubscribers.get(providerId)?.forEach((unsubscribe) => unsubscribe());
    this.providerUnsubscribers.delete(providerId);
    this.registry.unregister(providerId);
    if (this.activeProviderId === providerId) {
      this.activeProviderId = null;
    }
  }

  setActiveProvider(providerId: string): void {
    if (!this.registry.has(providerId)) {
      throw new SpeechError(
        `Cannot activate unknown speech provider "${providerId}"`,
        'SPEECH_PROVIDER_ERROR',
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

  getSession(sessionId: string): SpeechSession | undefined {
    return this.sessions.get(sessionId);
  }

  private requireSession(sessionId: string): SpeechSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SpeechSessionError(`No speech session tracked for runtime session "${sessionId}"`, {
        sessionId,
      });
    }
    return session;
  }

  private handlePartialResult(result: SpeechResult): void {
    const session = this.sessions.get(result.sessionId);
    if (!session) return;

    if (session.status === 'listening') {
      session.status = 'processing';
      for (const handler of this.startedHandlers) {
        handler(result.sessionId);
      }
    }
  }

  private handleFinalResult(result: SpeechResult): void {
    const session = this.requireSession(result.sessionId);

    for (const handler of this.recognizedHandlers) {
      handler({ sessionId: result.sessionId, text: result.text, confidence: result.confidence });
    }

    session.end('completed');
    for (const handler of this.finishedHandlers) {
      handler(result.sessionId);
    }
  }
}
