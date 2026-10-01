import type { ILogger } from '@backend/logging/ILogger';
import type { IHealthMonitor } from '@backend/infrastructure/health-monitor';
import type { IEventSystem } from '@backend/infrastructure/event-system';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

import type { IAudioFactory } from '@backend/audio/interfaces/IAudioFactory';
import type { IAudioRouter } from '@backend/audio/interfaces/IAudioRouter';
import type { IAudioSession } from '@backend/audio/interfaces/IAudioSession';
import type { IAudioDevice } from '@backend/audio/interfaces/IAudioDevice';
import type { IAudioPipelineStage } from '@backend/audio/interfaces/IAudioPipelineStage';
import type { IAudioChunk } from '@backend/audio/interfaces/IAudioChunk';
import type {
  AudioStatistics,
  IAudioManager,
  StartSessionOptions,
} from '@backend/audio/interfaces/IAudioManager';
import type { AudioManagerConfig } from '@backend/audio/AudioManagerConfig';
import { AUDIO_PIPELINE_STAGE_NAMES } from '@backend/audio/types/AudioPipelineStageName';
import { AudioBufferQueue } from '@backend/audio/buffer/AudioBufferQueue';
import { LatencyTracker } from '@backend/audio/metrics/LatencyTracker';
import { AUDIO_EVENTS } from '@backend/audio/events/audioEvents';
import {
  AudioDeviceError,
  AudioPipelineError,
  AudioSessionError,
} from '@backend/audio/errors/AudioError';

/**
 * Orchestrates the audio pipeline end to end: session lifecycle, device
 * management, stage orchestration, buffer management, pipeline health,
 * and statistics.
 *
 * AudioManager never contains provider-specific logic — it holds and
 * sequences `IAudioPipelineStage` implementations without knowing
 * anything about a real microphone, codec, noise-reduction algorithm,
 * or speech engine. None of those implementations exist in this
 * milestone.
 */
export class AudioManager implements IAudioManager {
  private readonly sessions = new Map<string, IAudioSession>();
  private readonly sessionBuffers = new Map<string, AudioBufferQueue<IAudioChunk>>();
  private readonly devices = new Map<string, IAudioDevice>();
  private readonly stages = new Map<string, IAudioPipelineStage>();
  private readonly latencyTracker = new LatencyTracker();

  private sessionsStarted = 0;
  private sessionsEnded = 0;
  private chunksProcessed = 0;

  constructor(
    private readonly logger: ILogger,
    private readonly factory: IAudioFactory,
    private readonly router: IAudioRouter,
    private readonly config: AudioManagerConfig,
    private readonly healthMonitor?: IHealthMonitor,
    private readonly eventSystem?: IEventSystem,
  ) {}

  // ---- Session lifecycle -------------------------------------------------

  startSession(options: StartSessionOptions = {}): IAudioSession {
    const activeCount = this.listSessions().filter(
      (s) => s.status === 'active' || s.status === 'starting',
    ).length;

    if (activeCount >= this.config.maxConcurrentSessions) {
      throw new AudioSessionError(
        `Cannot start a new audio session: max concurrent sessions (${this.config.maxConcurrentSessions}) reached`,
      );
    }

    const session = this.factory.createSession(options);
    this.sessions.set(session.id, session);
    this.sessionBuffers.set(
      session.id,
      new AudioBufferQueue<IAudioChunk>(this.config.bufferCapacity),
    );
    this.sessionsStarted += 1;
    session.status = 'active';

    this.logger.info(`Audio session started: ${session.id}`, {
      inputDeviceId: session.inputDeviceId,
      outputDeviceId: session.outputDeviceId,
    });

    this.eventSystem?.emit({
      name: AUDIO_EVENTS.SESSION_STARTED,
      category: 'system',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { sessionId: session.id },
    });

    return session;
  }

  endSession(sessionId: string): IAudioSession {
    const session = this.requireSession(sessionId);

    session.status = 'ended';
    session.endTime = Date.now();
    session.latencyMs = session.endTime - session.startTime;

    // Privacy guarantee: buffered audio for this session is discarded now.
    this.sessionBuffers.get(sessionId)?.clear();
    this.sessionBuffers.delete(sessionId);

    if (session.latencyMs !== null) {
      this.latencyTracker.record(session.latencyMs);
    }
    this.sessionsEnded += 1;

    this.logger.info(`Audio session ended: ${sessionId}`, { latencyMs: session.latencyMs });

    this.eventSystem?.emit({
      name: AUDIO_EVENTS.SESSION_ENDED,
      category: 'system',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { sessionId, latencyMs: session.latencyMs },
    });

    return session;
  }

  getSession(sessionId: string): IAudioSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): IAudioSession[] {
    return Array.from(this.sessions.values());
  }

  // ---- Device management --------------------------------------------------

  registerDevice(device: IAudioDevice): void {
    if (this.devices.has(device.id)) {
      throw new AudioDeviceError(`Device "${device.id}" is already registered`, { id: device.id });
    }
    this.devices.set(device.id, device);
    this.logger.info(
      `Audio device registered: ${device.name} (${device.type}/${device.connection})`,
    );

    this.eventSystem?.emit({
      name: AUDIO_EVENTS.DEVICE_REGISTERED,
      category: 'system',
      priority: 'low',
      timestamp: Date.now(),
      payload: { deviceId: device.id },
    });
  }

  unregisterDevice(deviceId: string): void {
    if (!this.devices.has(deviceId)) {
      throw new AudioDeviceError(`Cannot unregister unknown device "${deviceId}"`, { deviceId });
    }
    this.devices.delete(deviceId);

    this.eventSystem?.emit({
      name: AUDIO_EVENTS.DEVICE_UNREGISTERED,
      category: 'system',
      priority: 'low',
      timestamp: Date.now(),
      payload: { deviceId },
    });
  }

  listDevices(type?: IAudioDevice['type']): IAudioDevice[] {
    const all = Array.from(this.devices.values());
    return type ? all.filter((d) => d.type === type) : all;
  }

  getDefaultDevice(type: IAudioDevice['type']): IAudioDevice | undefined {
    return this.listDevices(type).find((d) => d.isDefault);
  }

  setDefaultDevice(deviceId: string): void {
    const target = this.devices.get(deviceId);
    if (!target) {
      throw new AudioDeviceError(`Cannot set default: unknown device "${deviceId}"`, { deviceId });
    }
    for (const device of this.devices.values()) {
      if (device.type === target.type) {
        device.isDefault = device.id === deviceId;
      }
    }

    this.eventSystem?.emit({
      name: AUDIO_EVENTS.DEFAULT_DEVICE_CHANGED,
      category: 'system',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { deviceId, type: target.type },
    });
  }

  // ---- Pipeline orchestration ----------------------------------------------

  registerStage(stage: IAudioPipelineStage): void {
    if (this.stages.has(stage.name)) {
      throw new AudioPipelineError(`Stage "${stage.name}" is already registered`, {
        name: stage.name,
      });
    }
    this.stages.set(stage.name, stage);

    this.healthMonitor?.register(`audio-stage:${stage.name}`, () => stage.healthCheck(), {
      onFailureThresholdExceeded: () => {
        this.eventSystem?.emit({
          name: AUDIO_EVENTS.STAGE_HEALTH_FAILED,
          category: 'system',
          priority: 'high',
          timestamp: Date.now(),
          payload: { stage: stage.name },
        });
      },
    });

    this.eventSystem?.emit({
      name: AUDIO_EVENTS.STAGE_REGISTERED,
      category: 'system',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { stage: stage.name },
    });

    this.logger.info(`Audio pipeline stage registered: ${stage.name}`);
  }

  unregisterStage(name: string): void {
    const stage = this.stages.get(name);
    if (!stage) {
      throw new AudioPipelineError(`Cannot unregister unknown stage "${name}"`, { name });
    }
    this.stages.delete(name);
    this.healthMonitor?.unregister(`audio-stage:${name}`);

    this.eventSystem?.emit({
      name: AUDIO_EVENTS.STAGE_UNREGISTERED,
      category: 'system',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { stage: name },
    });
  }

  listStages(): IAudioPipelineStage[] {
    return AUDIO_PIPELINE_STAGE_NAMES.map((name) => this.stages.get(name)).filter(
      (stage): stage is IAudioPipelineStage => Boolean(stage),
    );
  }

  async processChunk(chunk: IAudioChunk): Promise<IAudioChunk | null> {
    const startedAt = Date.now();
    let current: IAudioChunk | null = chunk;

    const buffer = this.sessionBuffers.get(chunk.metadata.sessionId);
    buffer?.push(chunk);

    for (const stage of this.listStages()) {
      if (!current) break;
      current = await stage.process(current);
    }

    this.chunksProcessed += 1;
    this.latencyTracker.record(Date.now() - startedAt);

    if (current) {
      this.router.routeMonitoringData(current);
    }

    return current;
  }

  // ---- Pipeline health ------------------------------------------------------

  getPipelineHealth(): Record<string, ModuleStatus> {
    const health: Record<string, ModuleStatus> = {};
    for (const name of this.stages.keys()) {
      health[name] = this.healthMonitor?.getStatus(`audio-stage:${name}`) ?? 'stopped';
    }
    return health;
  }

  // ---- Statistics -------------------------------------------------------------

  getStatistics(): AudioStatistics {
    return {
      sessionsStarted: this.sessionsStarted,
      sessionsEnded: this.sessionsEnded,
      activeSessions: this.listSessions().filter((s) => s.status === 'active').length,
      chunksProcessed: this.chunksProcessed,
      averageLatencyMs: this.latencyTracker.average,
    };
  }

  async dispose(): Promise<void> {
    for (const buffer of this.sessionBuffers.values()) {
      buffer.clear();
    }
    this.sessionBuffers.clear();

    for (const stage of this.stages.values()) {
      await stage.dispose();
      this.healthMonitor?.unregister(`audio-stage:${stage.name}`);
    }
    this.stages.clear();

    this.logger.info('AudioManager disposed');
  }

  private requireSession(sessionId: string): IAudioSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AudioSessionError(`No audio session found with id "${sessionId}"`, { sessionId });
    }
    return session;
  }
}
