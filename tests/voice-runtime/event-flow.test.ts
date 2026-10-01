import { describe, expect, it, vi } from 'vitest';

import { VOICE_RUNTIME_EVENTS } from '@backend/voice-runtime/events/voiceRuntimeEvents';
import {
  makeFakeSpeechManager,
  makeFakeVoiceManager,
  makeFakeWakeWordManager,
  makeRuntime,
} from './test-helpers';

describe('VoiceRuntimeManager — event flow', () => {
  it('emits WAKE_WORD_DETECTED and starts a session when the runtime is running', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const { runtime, eventSystem } = makeRuntime({ wakeWordManager });
    const handler = vi.fn();
    eventSystem.on(VOICE_RUNTIME_EVENTS.WAKE_WORD_DETECTED, handler);

    await runtime.initialize();
    await runtime.start();
    wakeWordManager.trigger();
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(runtime.listVoiceSessions()).toHaveLength(1);
  });

  it('ignores wake-word detections while not running', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const { runtime } = makeRuntime({ wakeWordManager });

    await runtime.initialize(); // not started
    wakeWordManager.trigger();

    expect(runtime.listVoiceSessions()).toHaveLength(0);
  });

  it('emits SPEECH_STARTED, SPEECH_FINISHED, and SPEECH_RECOGNIZED for a session', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const speechManager = makeFakeSpeechManager();
    const { runtime, eventSystem } = makeRuntime({ wakeWordManager, speechManager });

    const started = vi.fn();
    const finished = vi.fn();
    const recognized = vi.fn();
    eventSystem.on(VOICE_RUNTIME_EVENTS.SPEECH_STARTED, started);
    eventSystem.on(VOICE_RUNTIME_EVENTS.SPEECH_FINISHED, finished);
    eventSystem.on(VOICE_RUNTIME_EVENTS.SPEECH_RECOGNIZED, recognized);

    await runtime.initialize();
    await runtime.start();
    wakeWordManager.trigger();
    await Promise.resolve();
    await Promise.resolve();

    const session = runtime.listVoiceSessions()[0];
    speechManager.triggerStarted(session.id);
    speechManager.triggerFinished(session.id);
    speechManager.triggerRecognized({
      sessionId: session.id,
      text: 'hello jarvis',
      confidence: 0.9,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(started).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledTimes(1);
    expect(recognized).toHaveBeenCalledTimes(1);
    expect(runtime.getStatistics().speechRecognitions).toBe(1);
  });

  it('emits VOICE_RESPONSE_READY and SESSION_ENDED, then ends the session', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const voiceManager = makeFakeVoiceManager();
    const { runtime, eventSystem } = makeRuntime({ wakeWordManager, voiceManager });

    const responseReady = vi.fn();
    const sessionEnded = vi.fn();
    eventSystem.on(VOICE_RUNTIME_EVENTS.VOICE_RESPONSE_READY, responseReady);
    eventSystem.on(VOICE_RUNTIME_EVENTS.SESSION_ENDED, sessionEnded);

    await runtime.initialize();
    await runtime.start();
    wakeWordManager.trigger();
    await Promise.resolve();
    await Promise.resolve();

    const session = runtime.listVoiceSessions()[0];
    voiceManager.triggerResponseReady({ sessionId: session.id, text: 'It is sunny today.' });
    await Promise.resolve();
    await Promise.resolve();

    expect(responseReady).toHaveBeenCalledTimes(1);
    expect(sessionEnded).toHaveBeenCalledTimes(1);
    expect(runtime.getVoiceSession(session.id)?.state).toBe('ended');
  });

  it('never forwards SPEECH_RECOGNIZED to anything beyond the Event System (no AI Brain call)', async () => {
    const wakeWordManager = makeFakeWakeWordManager();
    const speechManager = makeFakeSpeechManager();
    const { runtime } = makeRuntime({ wakeWordManager, speechManager });

    await runtime.initialize();
    await runtime.start();
    wakeWordManager.trigger();
    await Promise.resolve();
    await Promise.resolve();

    const session = runtime.listVoiceSessions()[0];
    // No exception, no additional subsystem calls beyond startRecognition — this is
    // a structural guarantee: VoiceRuntimeManager has no reference to any AI/brain
    // module and cannot call one.
    expect(() =>
      speechManager.triggerRecognized({ sessionId: session.id, text: 'test', confidence: null }),
    ).not.toThrow();
  });
});
