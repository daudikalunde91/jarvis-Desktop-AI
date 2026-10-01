import { vi } from 'vitest';

import { AudioManager } from '@backend/audio/AudioManager';
import { AudioFactory } from '@backend/audio/AudioFactory';
import { AudioRouter } from '@backend/audio/AudioRouter';
import { EventSystem } from '@backend/infrastructure/event-system';
import { HealthMonitor } from '@backend/infrastructure/health-monitor';
import { CommunicationBus } from '@backend/infrastructure/communication-bus';
import { VoiceRuntimeManager } from '@backend/voice-runtime/VoiceRuntimeManager';
import { VoiceRuntimeFactory } from '@backend/voice-runtime/VoiceRuntimeFactory';
import type {
  IWakeWordManager,
  WakeWordDetectedEvent,
} from '@backend/voice-runtime/interfaces/IWakeWordManager';
import type {
  ISpeechManager,
  SpeechRecognizedEvent,
} from '@backend/voice-runtime/interfaces/ISpeechManager';
import type {
  IVoiceManager,
  VoiceResponseReadyEvent,
} from '@backend/voice-runtime/interfaces/IVoiceManager';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import { createTestLogger } from '../support/testLogger';

/** A minimal, fully-controllable fake so tests can trigger events on demand. */
export function makeFakeWakeWordManager() {
  const handlers = new Set<(event: WakeWordDetectedEvent) => void>();
  const fake: IWakeWordManager & { trigger: (event?: Partial<WakeWordDetectedEvent>) => void } = {
    startListening: vi.fn(),
    stopListening: vi.fn(),
    onWakeWordDetected: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    healthCheck: (): ModuleStatus => 'running',
    trigger: (event = {}) => {
      handlers.forEach((h) => h({ timestamp: Date.now(), deviceId: null, ...event }));
    },
  };
  return fake;
}

export function makeFakeSpeechManager() {
  const startedHandlers = new Set<(sessionId: string) => void>();
  const finishedHandlers = new Set<(sessionId: string) => void>();
  const recognizedHandlers = new Set<(event: SpeechRecognizedEvent) => void>();

  const fake: ISpeechManager & {
    triggerStarted: (sessionId: string) => void;
    triggerFinished: (sessionId: string) => void;
    triggerRecognized: (event: SpeechRecognizedEvent) => void;
  } = {
    startRecognition: vi.fn(),
    stopRecognition: vi.fn(),
    onSpeechStarted: (handler) => {
      startedHandlers.add(handler);
      return () => startedHandlers.delete(handler);
    },
    onSpeechFinished: (handler) => {
      finishedHandlers.add(handler);
      return () => finishedHandlers.delete(handler);
    },
    onSpeechRecognized: (handler) => {
      recognizedHandlers.add(handler);
      return () => recognizedHandlers.delete(handler);
    },
    healthCheck: (): ModuleStatus => 'running',
    triggerStarted: (sessionId) => startedHandlers.forEach((h) => h(sessionId)),
    triggerFinished: (sessionId) => finishedHandlers.forEach((h) => h(sessionId)),
    triggerRecognized: (event) => recognizedHandlers.forEach((h) => h(event)),
  };
  return fake;
}

export function makeFakeVoiceManager() {
  const handlers = new Set<(event: VoiceResponseReadyEvent) => void>();
  const fake: IVoiceManager & { triggerResponseReady: (event: VoiceResponseReadyEvent) => void } = {
    speak: vi.fn(),
    cancel: vi.fn(),
    onVoiceResponseReady: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    healthCheck: (): ModuleStatus => 'running',
    triggerResponseReady: (event) => handlers.forEach((h) => h(event)),
  };
  return fake;
}

export function makeRuntime(
  overrides: {
    wakeWordManager?: ReturnType<typeof makeFakeWakeWordManager>;
    speechManager?: ReturnType<typeof makeFakeSpeechManager>;
    voiceManager?: ReturnType<typeof makeFakeVoiceManager>;
    sessionTimeoutMs?: number;
    maxRetryAttempts?: number;
  } = {},
) {
  const logger = createTestLogger();
  const eventSystem = new EventSystem(logger);
  const healthMonitor = new HealthMonitor(logger, eventSystem);
  const communicationBus = new CommunicationBus(logger);
  const audioFactory = new AudioFactory();
  const audioRouter = new AudioRouter(logger, eventSystem);
  const audioManager = new AudioManager(
    logger,
    audioFactory,
    audioRouter,
    { bufferCapacity: 10, maxConcurrentSessions: 5 },
    healthMonitor,
    eventSystem,
  );

  const runtime = new VoiceRuntimeManager(
    logger,
    {
      audioManager,
      factory: new VoiceRuntimeFactory(),
      communicationBus,
      eventSystem,
      healthMonitor,
      wakeWordManager: overrides.wakeWordManager,
      speechManager: overrides.speechManager,
      voiceManager: overrides.voiceManager,
    },
    {
      defaultSessionTimeoutMs: overrides.sessionTimeoutMs ?? 30000,
      maxRetryAttempts: overrides.maxRetryAttempts ?? 3,
      retryBackoffBaseMs: 10,
    },
  );

  return { runtime, logger, eventSystem, healthMonitor, communicationBus, audioManager };
}
