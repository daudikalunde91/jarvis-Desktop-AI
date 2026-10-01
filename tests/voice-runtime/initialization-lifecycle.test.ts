import { describe, expect, it } from 'vitest';

import { VoiceRuntimeStateError } from '@backend/voice-runtime/errors/VoiceRuntimeError';
import { makeFakeWakeWordManager, makeRuntime } from './test-helpers';

describe('VoiceRuntimeManager — initialization', () => {
  it('initializes successfully with only AudioManager connected (no providers)', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();

    expect(runtime.getState()).toBe('idle');
  });

  it('initialize() is idempotent', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await expect(runtime.initialize()).resolves.toBeUndefined();
    expect(runtime.getState()).toBe('idle');
  });

  it('cannot start before initialize() has completed', async () => {
    const { runtime } = makeRuntime();
    await expect(runtime.start()).rejects.toBeInstanceOf(VoiceRuntimeStateError);
  });
});

describe('VoiceRuntimeManager — lifecycle', () => {
  it('start() transitions to "running" and calls wakeWordManager.startListening() when connected', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const { runtime } = makeRuntime({ wakeWordManager });

    await runtime.initialize();
    await runtime.start();

    expect(runtime.getState()).toBe('running');
    expect(wakeWordManager.startListening).toHaveBeenCalledTimes(1);
  });

  it('start() is idempotent when already running', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await runtime.start();
    await expect(runtime.start()).resolves.toBeUndefined();
    expect(runtime.getState()).toBe('running');
  });

  it('stop() transitions to "stopped" and calls wakeWordManager.stopListening()', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const { runtime } = makeRuntime({ wakeWordManager });

    await runtime.initialize();
    await runtime.start();
    await runtime.stop();

    expect(runtime.getState()).toBe('stopped');
    expect(wakeWordManager.stopListening).toHaveBeenCalledTimes(1);
  });

  it('pause() then resume() returns to "running"', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const { runtime } = makeRuntime({ wakeWordManager });

    await runtime.initialize();
    await runtime.start();
    await runtime.pause();
    expect(runtime.getState()).toBe('paused');

    await runtime.resume();
    expect(runtime.getState()).toBe('running');
    expect(wakeWordManager.startListening).toHaveBeenCalledTimes(2); // once on start(), once on resume()
  });

  it('cannot pause unless running', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await expect(runtime.pause()).rejects.toBeInstanceOf(VoiceRuntimeStateError);
  });

  it('cannot resume unless paused', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await runtime.start();
    await expect(runtime.resume()).rejects.toBeInstanceOf(VoiceRuntimeStateError);
  });

  it('stop() gracefully ends every active voice session', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await runtime.start();

    const session = runtime.startVoiceSession({});
    await runtime.stop();

    expect(runtime.getVoiceSession(session.id)?.state).toBe('ended');
  });
});
