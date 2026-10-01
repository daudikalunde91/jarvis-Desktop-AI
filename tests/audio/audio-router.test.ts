import { describe, expect, it, vi } from 'vitest';

import { AudioRouter } from '@backend/audio/AudioRouter';
import { EventSystem } from '@backend/infrastructure/event-system';
import { AUDIO_CHANNELS } from '@backend/audio/channels/audioChannels';
import { AudioRoutingError } from '@backend/audio/errors/AudioError';
import type { IAudioChunk } from '@backend/audio/interfaces/IAudioChunk';
import { createTestLogger } from '../support/testLogger';

function makeChunk(overrides: Partial<IAudioChunk['metadata']> = {}): IAudioChunk {
  return {
    payload: new Uint8Array([9, 9, 9]),
    metadata: {
      sessionId: 'session-1',
      sequence: 0,
      capturedAt: Date.now(),
      format: { sampleRateHz: 16000, channels: 1, bitDepth: 16 },
      ...overrides,
    },
  };
}

describe('AudioRouter', () => {
  it('routes microphone data to onMicrophoneData subscribers', async () => {
    const events = new EventSystem(createTestLogger());
    const router = new AudioRouter(createTestLogger(), events);
    const handler = vi.fn();

    router.onMicrophoneData(handler);
    router.routeMicrophoneData(makeChunk());

    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('keeps the five required routes independent of each other', async () => {
    const events = new EventSystem(createTestLogger());
    const router = new AudioRouter(createTestLogger(), events);

    const mic = vi.fn();
    const wakeWord = vi.fn();
    const stt = vi.fn();
    const tts = vi.fn();
    const monitoring = vi.fn();

    router.onMicrophoneData(mic);
    router.onWakeWordData(wakeWord);
    router.onSpeechData(stt);
    router.onTTSOutput(tts);
    router.onMonitoringData(monitoring);

    router.routeWakeWordData(makeChunk());
    await Promise.resolve();
    await Promise.resolve();

    expect(wakeWord).toHaveBeenCalledTimes(1);
    expect(mic).not.toHaveBeenCalled();
    expect(stt).not.toHaveBeenCalled();
    expect(tts).not.toHaveBeenCalled();
    expect(monitoring).not.toHaveBeenCalled();
  });

  it('addRoute() supports a future custom routing rule', async () => {
    const events = new EventSystem(createTestLogger());
    const router = new AudioRouter(createTestLogger(), events);
    const handler = vi.fn();

    const unsubscribe = router.addRoute('audio.route.custom-rule', handler);
    router.route('audio.route.custom-rule', makeChunk());
    await Promise.resolve();
    await Promise.resolve();
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    router.route('audio.route.custom-rule', makeChunk());
    await Promise.resolve();
    await Promise.resolve();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects routing a chunk with no metadata', () => {
    const events = new EventSystem(createTestLogger());
    const router = new AudioRouter(createTestLogger(), events);

    expect(() =>
      router.route(AUDIO_CHANNELS.MICROPHONE, {
        payload: new Uint8Array(),
        metadata: undefined as never,
      }),
    ).toThrow(AudioRoutingError);
  });

  it('listChannels() reports every channel that has been used', () => {
    const events = new EventSystem(createTestLogger());
    const router = new AudioRouter(createTestLogger(), events);

    router.routeMicrophoneData(makeChunk());
    router.routeTTSOutput(makeChunk());

    expect(router.listChannels()).toEqual(
      expect.arrayContaining([AUDIO_CHANNELS.MICROPHONE, AUDIO_CHANNELS.TTS_OUTPUT]),
    );
  });
});
