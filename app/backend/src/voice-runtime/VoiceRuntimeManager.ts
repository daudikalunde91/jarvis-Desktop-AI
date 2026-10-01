import type { ILogger } from '@backend/logging/ILogger';
import type { ICommunicationBus } from '@backend/infrastructure/communication-bus';
import type { IEventSystem } from '@backend/infrastructure/event-system';
import type { IHealthMonitor } from '@backend/infrastructure/health-monitor';
import type { IAudioManager } from '@backend/audio/interfaces/IAudioManager';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import { delay } from '@backend/shared/utilities/delay';
import { exponentialBackoff } from '@backend/shared/utilities/backoff';

import type { IWakeWordManager } from '@backend/voice-runtime/interfaces/IWakeWordManager';
import type { ISpeechManager } from '@backend/voice-runtime/interfaces/ISpeechManager';
import type { IVoiceManager } from '@backend/voice-runtime/interfaces/IVoiceManager';
import type { IVoiceRuntimeFactory } from '@backend/voice-runtime/interfaces/IVoiceRuntimeFactory';
import type { IVoiceSession } from '@backend/voice-runtime/interfaces/IVoiceSession';
import type {
  IVoiceRuntimeManager,
  StartVoiceSessionOptions,
  VoiceRuntimeStatistics,
} from '@backend/voice-runtime/interfaces/IVoiceRuntimeManager';
import type { VoiceRuntimeState } from '@backend/voice-runtime/types/VoiceRuntimeState';
import type { VoiceSubsystemName } from '@backend/voice-runtime/types/VoiceSubsystemName';
import type { VoiceRuntimeConfig } from '@backend/voice-runtime/VoiceRuntimeConfig';
import { VOICE_RUNTIME_EVENTS } from '@backend/voice-runtime/events/voiceRuntimeEvents';
import {
  VoiceRuntimeStateError,
  VoiceSessionError,
  VoiceSubsystemError,
} from '@backend/voice-runtime/errors/VoiceRuntimeError';

export interface VoiceRuntimeManagerDependencies {
  audioManager: IAudioManager;
  factory: IVoiceRuntimeFactory;
  communicationBus?: ICommunicationBus;
  eventSystem: IEventSystem;
  healthMonitor: IHealthMonitor;
  wakeWordManager?: IWakeWordManager;
  speechManager?: ISpeechManager;
  voiceManager?: IVoiceManager;
}

/**
 * Connects the already-designed voice architecture into one runtime
 * pipeline: initializes the connected subsystems, drives the runtime
 * lifecycle, manages VoiceSessions, aggregates health, and reports
 * statistics.
 *
 * `wakeWordManager`, `speechManager`, and `voiceManager` are optional —
 * no concrete implementation of any of them exists in this project.
 * VoiceRuntimeManager degrades gracefully when they're absent: it still
 * initializes, starts, and reports health/statistics correctly with only
 * `IAudioManager` connected. This is not a stub — it's the intended
 * operating mode until a provider milestone supplies a real
 * implementation of one of those three interfaces.
 *
 * Never connects to an AI Brain: `SPEECH_RECOGNIZED` is emitted for any
 * future consumer to pick up, but nothing in this class forwards it
 * anywhere, interprets it, or acts on it.
 */
export class VoiceRuntimeManager implements IVoiceRuntimeManager {
  private readonly audioManager: IAudioManager;
  private readonly factory: IVoiceRuntimeFactory;
  private readonly communicationBus?: ICommunicationBus;
  private readonly eventSystem: IEventSystem;
  private readonly healthMonitor: IHealthMonitor;
  private readonly wakeWordManager?: IWakeWordManager;
  private readonly speechManager?: ISpeechManager;
  private readonly voiceManager?: IVoiceManager;

  private state: VoiceRuntimeState = 'idle';
  private initialized = false;
  private startedAt: number | null = null;

  private readonly sessions = new Map<string, IVoiceSession>();
  private readonly sessionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly unsubscribers: Array<() => void> = [];

  private readonly stats = {
    sessionsStarted: 0,
    sessionsEnded: 0,
    sessionsTimedOut: 0,
    wakeWordDetections: 0,
    speechRecognitions: 0,
    errors: 0,
  };

  constructor(
    private readonly logger: ILogger,
    deps: VoiceRuntimeManagerDependencies,
    private readonly config: VoiceRuntimeConfig,
  ) {
    this.audioManager = deps.audioManager;
    this.factory = deps.factory;
    this.communicationBus = deps.communicationBus;
    this.eventSystem = deps.eventSystem;
    this.healthMonitor = deps.healthMonitor;
    this.wakeWordManager = deps.wakeWordManager;
    this.speechManager = deps.speechManager;
    this.voiceManager = deps.voiceManager;
  }

  // ---- Lifecycle ------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug('VoiceRuntimeManager already initialized — skipping');
      return;
    }
    if (this.state !== 'idle' && this.state !== 'stopped' && this.state !== 'failed') {
      throw new VoiceRuntimeStateError(`Cannot initialize from state "${this.state}"`);
    }

    this.setState('initializing');

    this.healthMonitor.register('voice-runtime:audio', () => 'running', {});
    if (this.wakeWordManager) {
      this.healthMonitor.register(
        'voice-runtime:wake-word',
        () => this.wakeWordManager!.healthCheck(),
        { onFailureThresholdExceeded: () => this.handleSubsystemFailure('wake-word') },
      );
    }
    if (this.speechManager) {
      this.healthMonitor.register('voice-runtime:speech', () => this.speechManager!.healthCheck(), {
        onFailureThresholdExceeded: () => this.handleSubsystemFailure('speech'),
      });
    }
    if (this.voiceManager) {
      this.healthMonitor.register('voice-runtime:voice', () => this.voiceManager!.healthCheck(), {
        onFailureThresholdExceeded: () => this.handleSubsystemFailure('voice'),
      });
    }

    this.wireSubsystemEvents();
    this.wireControlChannel();

    this.initialized = true;
    this.setState('idle');
    this.logger.info('Voice Runtime Framework initialized', {
      connectedSubsystems: this.listConnectedSubsystems(),
    });
  }

  async start(): Promise<void> {
    if (!this.initialized) {
      throw new VoiceRuntimeStateError('Cannot start before initialize() has completed');
    }
    if (this.state === 'running') return;
    if (this.state !== 'idle' && this.state !== 'stopped') {
      throw new VoiceRuntimeStateError(`Cannot start from state "${this.state}"`);
    }

    if (this.wakeWordManager) {
      await this.retrySubsystemOperation('wake-word', () => this.wakeWordManager!.startListening());
    }

    this.startedAt = Date.now();
    this.setState('running');
    this.logger.info('Voice Runtime Framework started');
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped' || this.state === 'idle') return;

    this.setState('stopping');

    for (const session of this.listVoiceSessions()) {
      if (
        session.state !== 'ended' &&
        session.state !== 'timed-out' &&
        session.state !== 'failed'
      ) {
        this.endVoiceSession(session.id);
      }
    }

    if (this.wakeWordManager) {
      try {
        await this.wakeWordManager.stopListening();
      } catch (error) {
        this.logger.warn('wake-word stopListening() threw during shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.startedAt = null;
    this.setState('stopped');
    this.logger.info('Voice Runtime Framework stopped');
  }

  async pause(): Promise<void> {
    if (this.state !== 'running') {
      throw new VoiceRuntimeStateError(`Cannot pause from state "${this.state}"`);
    }
    this.setState('pausing');

    if (this.wakeWordManager) {
      try {
        await this.wakeWordManager.stopListening();
      } catch (error) {
        this.logger.warn('wake-word stopListening() threw during pause', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.setState('paused');
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused') {
      throw new VoiceRuntimeStateError(`Cannot resume from state "${this.state}"`);
    }
    this.setState('resuming');

    if (this.wakeWordManager) {
      await this.retrySubsystemOperation('wake-word', () => this.wakeWordManager!.startListening());
    }

    this.setState('running');
  }

  /** Full teardown for app shutdown — releases every subscription and timer. */
  async dispose(): Promise<void> {
    for (const timer of this.sessionTimers.values()) {
      clearTimeout(timer);
    }
    this.sessionTimers.clear();

    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;

    this.healthMonitor.unregister('voice-runtime:audio');
    if (this.wakeWordManager) this.healthMonitor.unregister('voice-runtime:wake-word');
    if (this.speechManager) this.healthMonitor.unregister('voice-runtime:speech');
    if (this.voiceManager) this.healthMonitor.unregister('voice-runtime:voice');

    this.state = 'stopped';
    this.initialized = false;
    this.logger.info('VoiceRuntimeManager disposed');
  }

  // ---- Session lifecycle ------------------------------------------------------

  startVoiceSession(options: StartVoiceSessionOptions = {}): IVoiceSession {
    const session = this.factory.createSession({
      audioSessionId: options.audioSessionId ?? null,
      language: options.language,
      timeoutMs: this.config.defaultSessionTimeoutMs,
      metadata: options.metadata,
    });

    this.sessions.set(session.id, session);
    this.stats.sessionsStarted += 1;
    this.rescheduleSessionTimeout(session);

    this.logger.info(`Voice session started: ${session.id}`, {
      audioSessionId: session.audioSessionId,
    });

    return session;
  }

  endVoiceSession(sessionId: string): IVoiceSession {
    const session = this.requireSession(sessionId);

    if (session.state === 'ended' || session.state === 'timed-out' || session.state === 'failed') {
      return session;
    }

    session.state = 'ended';
    session.endedAt = Date.now();
    this.stats.sessionsEnded += 1;
    this.clearSessionTimer(sessionId);

    if (session.audioSessionId && this.audioManager.getSession(session.audioSessionId)) {
      try {
        this.audioManager.endSession(session.audioSessionId);
      } catch (error) {
        this.logger.debug('Underlying audio session already ended', {
          audioSessionId: session.audioSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.eventSystem.emit({
      name: VOICE_RUNTIME_EVENTS.SESSION_ENDED,
      category: 'system',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { sessionId, reason: 'ended' },
    });

    this.logger.info(`Voice session ended: ${sessionId}`);
    return session;
  }

  getVoiceSession(sessionId: string): IVoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  listVoiceSessions(): IVoiceSession[] {
    return Array.from(this.sessions.values());
  }

  // ---- Health & statistics -----------------------------------------------------

  getState(): VoiceRuntimeState {
    return this.state;
  }

  getRuntimeHealth(): Record<VoiceSubsystemName, ModuleStatus> {
    return {
      audio: this.healthMonitor.getStatus('voice-runtime:audio') ?? 'stopped',
      'wake-word': this.wakeWordManager
        ? (this.healthMonitor.getStatus('voice-runtime:wake-word') ?? 'stopped')
        : 'stopped',
      speech: this.speechManager
        ? (this.healthMonitor.getStatus('voice-runtime:speech') ?? 'stopped')
        : 'stopped',
      voice: this.voiceManager
        ? (this.healthMonitor.getStatus('voice-runtime:voice') ?? 'stopped')
        : 'stopped',
    };
  }

  getStatistics(): VoiceRuntimeStatistics {
    return {
      state: this.state,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : null,
      ...this.stats,
    };
  }

  // ---- Internal: subsystem event wiring -----------------------------------------

  private wireSubsystemEvents(): void {
    if (this.wakeWordManager) {
      this.unsubscribers.push(
        this.wakeWordManager.onWakeWordDetected((event) => {
          this.stats.wakeWordDetections += 1;
          this.eventSystem.emit({
            name: VOICE_RUNTIME_EVENTS.WAKE_WORD_DETECTED,
            category: 'user',
            priority: 'high',
            timestamp: Date.now(),
            payload: event,
          });

          if (this.state !== 'running') return;

          const session = this.startVoiceSession({});
          session.state = 'active';

          if (this.speechManager) {
            void this.retrySubsystemOperation('speech', () =>
              this.speechManager!.startRecognition(session.id),
            ).catch(() => {
              session.state = 'failed';
            });
          }
        }),
      );
    }

    if (this.speechManager) {
      this.unsubscribers.push(
        this.speechManager.onSpeechStarted((sessionId) => {
          const session = this.sessions.get(sessionId);
          if (!session) return;
          session.state = 'processing';
          this.rescheduleSessionTimeout(session);
          this.eventSystem.emit({
            name: VOICE_RUNTIME_EVENTS.SPEECH_STARTED,
            category: 'application',
            priority: 'normal',
            timestamp: Date.now(),
            payload: { sessionId },
          });
        }),
      );

      this.unsubscribers.push(
        this.speechManager.onSpeechFinished((sessionId) => {
          const session = this.sessions.get(sessionId);
          if (!session) return;
          this.rescheduleSessionTimeout(session);
          this.eventSystem.emit({
            name: VOICE_RUNTIME_EVENTS.SPEECH_FINISHED,
            category: 'application',
            priority: 'normal',
            timestamp: Date.now(),
            payload: { sessionId },
          });
        }),
      );

      this.unsubscribers.push(
        this.speechManager.onSpeechRecognized((event) => {
          this.stats.speechRecognitions += 1;
          const session = this.sessions.get(event.sessionId);
          if (session) this.rescheduleSessionTimeout(session);
          // Emitted for any future consumer (e.g. an AI Brain milestone).
          // Nothing here forwards it anywhere or acts on it.
          this.eventSystem.emit({
            name: VOICE_RUNTIME_EVENTS.SPEECH_RECOGNIZED,
            category: 'application',
            priority: 'normal',
            timestamp: Date.now(),
            payload: event,
          });
        }),
      );
    }

    if (this.voiceManager) {
      this.unsubscribers.push(
        this.voiceManager.onVoiceResponseReady((event) => {
          const session = this.sessions.get(event.sessionId);
          if (session) {
            session.state = 'responding';
            this.rescheduleSessionTimeout(session);
          }
          this.eventSystem.emit({
            name: VOICE_RUNTIME_EVENTS.VOICE_RESPONSE_READY,
            category: 'application',
            priority: 'normal',
            timestamp: Date.now(),
            payload: event,
          });
          this.endVoiceSession(event.sessionId);
        }),
      );
    }
  }

  private wireControlChannel(): void {
    if (!this.communicationBus) return;

    this.unsubscribers.push(
      this.communicationBus.subscribe<{ action: string }>('voice-runtime.control', (message) => {
        void this.handleControlCommand(
          message as { payload: unknown; metadata: { correlationId: string } },
        );
      }),
    );
  }

  private async handleControlCommand(message: {
    payload: unknown;
    metadata: { correlationId: string };
  }): Promise<void> {
    const action = (message.payload as { action?: string } | undefined)?.action;
    try {
      switch (action) {
        case 'start':
          await this.start();
          break;
        case 'stop':
          await this.stop();
          break;
        case 'pause':
          await this.pause();
          break;
        case 'resume':
          await this.resume();
          break;
        default:
          throw new VoiceRuntimeStateError(
            `Unknown voice-runtime control action "${String(action)}"`,
          );
      }
      this.communicationBus?.respond(message as never, { state: this.state }, true);
    } catch (error) {
      this.communicationBus?.respond(
        message as never,
        { error: error instanceof Error ? error.message : String(error) },
        false,
      );
    }
  }

  // ---- Internal: error recovery ---------------------------------------------------

  private async retrySubsystemOperation(
    name: VoiceSubsystemName,
    operation: () => void | Promise<void>,
  ): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxRetryAttempts; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error;
        this.stats.errors += 1;
        this.logger.warn(
          `Voice subsystem "${name}" operation failed (attempt ${attempt}/${this.config.maxRetryAttempts})`,
          { error: error instanceof Error ? error.message : String(error) },
        );
        this.eventSystem.emit({
          name: VOICE_RUNTIME_EVENTS.ERROR,
          category: 'system',
          priority: 'high',
          timestamp: Date.now(),
          payload: {
            subsystem: name,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          },
        });

        if (attempt < this.config.maxRetryAttempts) {
          await delay(exponentialBackoff(attempt, this.config.retryBackoffBaseMs));
        }
      }
    }

    throw new VoiceSubsystemError(
      `Voice subsystem "${name}" failed after ${this.config.maxRetryAttempts} attempts`,
      { name, cause: lastError instanceof Error ? lastError.message : String(lastError) },
    );
  }

  private handleSubsystemFailure(name: VoiceSubsystemName): void {
    this.stats.errors += 1;
    this.logger.error(`Voice subsystem "${name}" exceeded its failure threshold`);
    this.eventSystem.emit({
      name: VOICE_RUNTIME_EVENTS.ERROR,
      category: 'system',
      priority: 'critical',
      timestamp: Date.now(),
      payload: { subsystem: name, reason: 'health-threshold-exceeded' },
    });
  }

  // ---- Internal: helpers -----------------------------------------------------------

  private setState(next: VoiceRuntimeState): void {
    this.state = next;
    this.eventSystem.emit({
      name: VOICE_RUNTIME_EVENTS.STATE_CHANGED,
      category: 'system',
      priority: 'low',
      timestamp: Date.now(),
      payload: { state: next },
    });
  }

  private requireSession(sessionId: string): IVoiceSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new VoiceSessionError(`No voice session found with id "${sessionId}"`, { sessionId });
    }
    return session;
  }

  private rescheduleSessionTimeout(session: IVoiceSession): void {
    session.lastActivityAt = Date.now();
    this.clearSessionTimer(session.id);

    const timer = setTimeout(() => this.timeoutSession(session.id), session.timeoutMs);
    timer.unref?.();
    this.sessionTimers.set(session.id, timer);
  }

  private clearSessionTimer(sessionId: string): void {
    const timer = this.sessionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(sessionId);
    }
  }

  private timeoutSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.state === 'ended' || session.state === 'timed-out' || session.state === 'failed')
      return;

    session.state = 'timed-out';
    session.endedAt = Date.now();
    this.stats.sessionsTimedOut += 1;
    this.sessionTimers.delete(sessionId);

    this.logger.info(`Voice session timed out: ${sessionId}`);
    this.eventSystem.emit({
      name: VOICE_RUNTIME_EVENTS.SESSION_ENDED,
      category: 'system',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { sessionId, reason: 'timeout' },
    });
  }

  private listConnectedSubsystems(): VoiceSubsystemName[] {
    const connected: VoiceSubsystemName[] = ['audio'];
    if (this.wakeWordManager) connected.push('wake-word');
    if (this.speechManager) connected.push('speech');
    if (this.voiceManager) connected.push('voice');
    return connected;
  }
}
