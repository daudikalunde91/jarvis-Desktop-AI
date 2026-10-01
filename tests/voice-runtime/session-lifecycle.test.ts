import { describe, expect, it, vi } from 'vitest';

import { VoiceSession } from '@backend/voice-runtime/models/VoiceSession';
import { VoiceSessionError } from '@backend/voice-runtime/errors/VoiceRuntimeError';
import { makeRuntime } from './test-helpers';

describe('VoiceSession model', () => {
  it('starts in "listening-for-wake-word" state with no end time', () => {
    const session = new VoiceSession();
    expect(session.state).toBe('listening-for-wake-word');
    expect(session.endedAt).toBeNull();
  });

  it('defaults language to en-US and timeoutMs to 30s', () => {
    const session = new VoiceSession();
    expect(session.language).toBe('en-US');
    expect(session.timeoutMs).toBe(30_000);
  });

  it('touch() updates lastActivityAt', () => {
    const session = new VoiceSession();
    const original = session.lastActivityAt;
    vi.useFakeTimers();
    vi.advanceTimersByTime(50);
    session.touch();
    expect(session.lastActivityAt).toBeGreaterThanOrEqual(original);
    vi.useRealTimers();
  });

  it('isExpired() reflects timeoutMs relative to lastActivityAt', () => {
    const session = new VoiceSession({ timeoutMs: 100 });
    expect(session.isExpired(session.lastActivityAt + 50)).toBe(false);
    expect(session.isExpired(session.lastActivityAt + 150)).toBe(true);
  });

  it('end() sets state and endedAt', () => {
    const session = new VoiceSession();
    session.end('timed-out');
    expect(session.state).toBe('timed-out');
    expect(session.endedAt).not.toBeNull();
  });
});

describe('VoiceRuntimeManager — session lifecycle', () => {
  it('startVoiceSession() creates and tracks a session', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();

    const session = runtime.startVoiceSession({ language: 'fr-FR' });

    expect(runtime.getVoiceSession(session.id)).toBe(session);
    expect(session.language).toBe('fr-FR');
    expect(runtime.getStatistics().sessionsStarted).toBe(1);
  });

  it('endVoiceSession() is idempotent and updates statistics once', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    const session = runtime.startVoiceSession({});

    runtime.endVoiceSession(session.id);
    runtime.endVoiceSession(session.id);

    expect(runtime.getStatistics().sessionsEnded).toBe(1);
  });

  it('throws when ending an unknown session', async () => {
    const { runtime } = makeRuntime();
    await runtime.initialize();
    expect(() => runtime.endVoiceSession('missing')).toThrow(VoiceSessionError);
  });

  it('a session times out automatically after its inactivity window', async () => {
    vi.useFakeTimers();
    const { runtime } = makeRuntime({ sessionTimeoutMs: 1000 });
    await runtime.initialize();
    const session = runtime.startVoiceSession({});

    await vi.advanceTimersByTimeAsync(1500);

    expect(runtime.getVoiceSession(session.id)?.state).toBe('timed-out');
    expect(runtime.getStatistics().sessionsTimedOut).toBe(1);
    vi.useRealTimers();
  });

  it('ending a session also ends its correlated audio session when one exists', async () => {
    const { runtime, audioManager } = makeRuntime();
    await runtime.initialize();
    const audioSession = audioManager.startSession();

    const voiceSession = runtime.startVoiceSession({ audioSessionId: audioSession.id });
    runtime.endVoiceSession(voiceSession.id);

    expect(audioManager.getSession(audioSession.id)?.status).toBe('ended');
  });
});
