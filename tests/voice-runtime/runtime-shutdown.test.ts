import { describe, expect, it } from 'vitest';

import { makeFakeWakeWordManager, makeRuntime } from './test-helpers';

describe('VoiceRuntimeManager — runtime shutdown', () => {
  it('stop() from "running" transitions cleanly to "stopped"', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await runtime.start();
    await runtime.stop();
    expect(runtime.getState()).toBe('stopped');
  });

  it('stop() is a safe no-op when already stopped or never started', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await expect(runtime.stop()).resolves.toBeUndefined();
    expect(runtime.getState()).toBe('idle');
  });

  it('stop() tolerates a wake-word manager whose stopListening() throws', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    wakeWordManager.stopListening = async () => {
      throw new Error('hardware already released');
    };
    const { runtime } = makeRuntime({ wakeWordManager });

    await runtime.initialize();
    await runtime.start();
    await expect(runtime.stop()).resolves.toBeUndefined();
    expect(runtime.getState()).toBe('stopped');
  });

  it('can be started again after being stopped', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await runtime.start();
    await runtime.stop();
    await runtime.start();
    expect(runtime.getState()).toBe('running');
  });

  it('dispose() clears all session timers and subscriptions without throwing', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const { runtime } = makeRuntime({ wakeWordManager });
    await runtime.initialize();
    await runtime.start();
    runtime.startVoiceSession({});

    await expect(runtime.dispose()).resolves.toBeUndefined();
  });

  it('resets uptime tracking after stop()', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    await runtime.start();
    expect(runtime.getStatistics().uptimeMs).not.toBeNull();

    await runtime.stop();
    expect(runtime.getStatistics().uptimeMs).toBeNull();
  });
});
