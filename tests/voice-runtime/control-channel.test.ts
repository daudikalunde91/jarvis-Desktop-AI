import { describe, expect, it } from 'vitest';

import { makeRuntime } from './test-helpers';

describe('VoiceRuntimeManager — Communication Bus control channel', () => {
  it('responds to a "start" command sent over the Communication Bus', async () => {
    const { runtime, communicationBus } = makeRuntime();
    await runtime.initialize();

    const result = await communicationBus.sendCommand<{ action: string }, { state: string }>(
      'voice-runtime.control',
      { action: 'start' },
      { source: 'test' },
    );

    expect(result.state).toBe('running');
    expect(runtime.getState()).toBe('running');
  });

  it('responds with success: false for an unknown action', async () => {
    const { runtime, communicationBus } = makeRuntime();
    await runtime.initialize();

    await expect(
      communicationBus.sendCommand(
        'voice-runtime.control',
        { action: 'not-a-real-action' },
        { source: 'test', maxAttempts: 1, timeoutMs: 200 },
      ),
    ).rejects.toThrow();
  });

  it('drives the full start -> pause -> resume -> stop cycle via the bus', async () => {
    const { runtime, communicationBus } = makeRuntime();
    await runtime.initialize();

    await communicationBus.sendCommand(
      'voice-runtime.control',
      { action: 'start' },
      { source: 'test' },
    );
    expect(runtime.getState()).toBe('running');

    await communicationBus.sendCommand(
      'voice-runtime.control',
      { action: 'pause' },
      { source: 'test' },
    );
    expect(runtime.getState()).toBe('paused');

    await communicationBus.sendCommand(
      'voice-runtime.control',
      { action: 'resume' },
      { source: 'test' },
    );
    expect(runtime.getState()).toBe('running');

    await communicationBus.sendCommand(
      'voice-runtime.control',
      { action: 'stop' },
      { source: 'test' },
    );
    expect(runtime.getState()).toBe('stopped');
  });
});
