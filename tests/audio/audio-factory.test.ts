import { describe, expect, it } from 'vitest';

import { AudioFactory } from '@backend/audio/AudioFactory';
import { AudioSession } from '@backend/audio/models/AudioSession';
import { AudioDevice } from '@backend/audio/models/AudioDevice';

describe('AudioFactory', () => {
  it('createSession() returns a concrete AudioSession built from the input', () => {
    const factory = new AudioFactory();
    const session = factory.createSession({ language: 'de-DE', inputDeviceId: 'mic-1' });

    expect(session).toBeInstanceOf(AudioSession);
    expect(session.language).toBe('de-DE');
    expect(session.inputDeviceId).toBe('mic-1');
  });

  it('createDevice() returns a concrete AudioDevice built from the input', () => {
    const factory = new AudioFactory();
    const device = factory.createDevice({
      id: 'mic-1',
      name: 'Built-in Microphone',
      type: 'input',
      connection: 'builtin',
    });

    expect(device).toBeInstanceOf(AudioDevice);
    expect(device.name).toBe('Built-in Microphone');
    expect(device.isDefault).toBe(false);
    expect(device.supportedFormats.length).toBeGreaterThan(0);
  });

  it('createChunk() wraps a payload with the given metadata', () => {
    const factory = new AudioFactory();
    const payload = new Uint8Array([1, 2, 3]);
    const chunk = factory.createChunk(payload, {
      sessionId: 'session-1',
      sequence: 0,
      capturedAt: Date.now(),
      format: { sampleRateHz: 16000, channels: 1, bitDepth: 16 },
    });

    expect(chunk.payload).toBe(payload);
    expect(chunk.metadata.sessionId).toBe('session-1');
  });
});
