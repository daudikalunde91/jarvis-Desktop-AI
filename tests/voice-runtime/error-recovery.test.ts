import { describe, expect, it, vi } from 'vitest';

import { VoiceSubsystemError } from '@backend/voice-runtime/errors/VoiceRuntimeError';
import { VOICE_RUNTIME_EVENTS } from '@backend/voice-runtime/events/voiceRuntimeEvents';
import { makeFakeWakeWordManager, makeRuntime } from './test-helpers';

describe('VoiceRuntimeManager — error recovery', () => {
  it('retries a failing subsystem operation up to maxRetryAttempts before giving up', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    let attempts = 0;
    wakeWordManager.startListening = vi.fn().mockImplementation(() => {
      attempts += 1;
      throw new Error('device busy');
    });

    const { runtime } = makeRuntime({ wakeWordManager, maxRetryAttempts: 3 });
    await runtime.initialize();

    await expect(runtime.start()).rejects.toBeInstanceOf(VoiceSubsystemError);
    expect(attempts).toBe(3);
  });

  it('succeeds if the subsystem recovers within maxRetryAttempts', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    let attempts = 0;
    wakeWordManager.startListening = vi.fn().mockImplementation(() => {
      attempts += 1;
      if (attempts < 2) throw new Error('transient failure');
    });

    const { runtime } = makeRuntime({ wakeWordManager, maxRetryAttempts: 3 });
    await runtime.initialize();
    await runtime.start();

    expect(runtime.getState()).toBe('running');
    expect(attempts).toBe(2);
  });

  it('emits an ERROR event for every failed attempt', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    wakeWordManager.startListening = vi.fn().mockImplementation(() => {
      throw new Error('always fails');
    });

    const { runtime, eventSystem } = makeRuntime({ wakeWordManager, maxRetryAttempts: 2 });
    const errorHandler = vi.fn();
    eventSystem.on(VOICE_RUNTIME_EVENTS.ERROR, errorHandler);

    await runtime.initialize();
    await expect(runtime.start()).rejects.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(errorHandler).toHaveBeenCalledTimes(2);
    expect(runtime.getStatistics().errors).toBe(2);
  });

  it('does not throw the whole runtime when there is no wake-word manager at all', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await expect(runtime.start()).resolves.toBeUndefined();
    expect(runtime.getState()).toBe('running');
  });
});
