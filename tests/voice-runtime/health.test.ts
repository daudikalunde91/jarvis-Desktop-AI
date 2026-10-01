import { describe, expect, it } from 'vitest';

import {
  makeFakeSpeechManager,
  makeFakeVoiceManager,
  makeFakeWakeWordManager,
  makeRuntime,
} from './test-helpers';

describe('VoiceRuntimeManager — health', () => {
  it('reports "stopped" for every subsystem before any health poll has run', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();

    const health = runtime.getRuntimeHealth();
    expect(health.audio).toBe('stopped');
    expect(health['wake-word']).toBe('stopped');
    expect(health.speech).toBe('stopped');
    expect(health.voice).toBe('stopped');
  });

  it('reports "running" for the audio subsystem once polled', async () => {
    const { runtime, healthMonitor } = makeRuntime();
    await runtime.initialize();

    await healthMonitor.checkNow('voice-runtime:audio');

    expect(runtime.getRuntimeHealth().audio).toBe('running');
  });

  it('reflects a connected subsystem once its health check has been polled', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const { runtime, healthMonitor } = makeRuntime({ wakeWordManager });
    await runtime.initialize();

    await healthMonitor.checkNow('voice-runtime:wake-word');

    expect(runtime.getRuntimeHealth()['wake-word']).toBe('running');
  });

  it('registers a health check for every connected subsystem and none for absent ones', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const speechManager = makeFakeSpeechManager();
    const voiceManager = makeFakeVoiceManager();
    const { runtime, healthMonitor } = makeRuntime({
      wakeWordManager,
      speechManager,
      voiceManager,
    });

    await runtime.initialize();

    expect(healthMonitor.getRecord('voice-runtime:audio')).toBeDefined();
    expect(healthMonitor.getRecord('voice-runtime:wake-word')).toBeDefined();
    expect(healthMonitor.getRecord('voice-runtime:speech')).toBeDefined();
    expect(healthMonitor.getRecord('voice-runtime:voice')).toBeDefined();
  });

  it('dispose() unregisters every health check it registered', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const { runtime, healthMonitor } = makeRuntime({ wakeWordManager });
    await runtime.initialize();

    await runtime.dispose();

    expect(healthMonitor.getRecord('voice-runtime:audio')).toBeUndefined();
    expect(healthMonitor.getRecord('voice-runtime:wake-word')).toBeUndefined();
  });
});
