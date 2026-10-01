import { describe, expect, it } from 'vitest';

import { VoiceRuntimeFactory } from '@backend/voice-runtime/VoiceRuntimeFactory';
import { VoiceSession } from '@backend/voice-runtime/models/VoiceSession';

describe('VoiceRuntimeFactory', () => {
  it('createSession() returns a concrete VoiceSession built from the input', () => {
    const factory = new VoiceRuntimeFactory();
    const session = factory.createSession({ language: 'ja-JP', audioSessionId: 'audio-1' });

    expect(session).toBeInstanceOf(VoiceSession);
    expect(session.language).toBe('ja-JP');
    expect(session.audioSessionId).toBe('audio-1');
  });

  it('applies the given timeoutMs', () => {
    const factory = new VoiceRuntimeFactory();
    const session = factory.createSession({ timeoutMs: 5000 });
    expect(session.timeoutMs).toBe(5000);
  });
});
