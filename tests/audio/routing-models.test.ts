import { describe, expect, it } from 'vitest';

import { AudioDevice } from '@backend/audio/models/AudioDevice';
import { AUDIO_CHANNELS } from '@backend/audio/channels/audioChannels';
import { AUDIO_EVENTS } from '@backend/audio/events/audioEvents';

describe('AudioDevice model', () => {
  it('applies a sensible default supported format when none is given', () => {
    const device = new AudioDevice({
      id: 'mic-1',
      name: 'Built-in Mic',
      type: 'input',
      connection: 'builtin',
    });

    expect(device.supportedFormats).toEqual([{ sampleRateHz: 16000, channels: 1, bitDepth: 16 }]);
    expect(device.isDefault).toBe(false);
  });

  it('preserves explicit supportedFormats and isDefault', () => {
    const device = new AudioDevice({
      id: 'speaker-1',
      name: 'USB Speaker',
      type: 'output',
      connection: 'usb',
      isDefault: true,
      supportedFormats: [{ sampleRateHz: 48000, channels: 2, bitDepth: 24 }],
    });

    expect(device.isDefault).toBe(true);
    expect(device.supportedFormats[0].sampleRateHz).toBe(48000);
  });
});

describe('Audio routing/event catalogs', () => {
  it('defines exactly the five required routing channels', () => {
    expect(Object.values(AUDIO_CHANNELS)).toEqual([
      'audio.route.microphone',
      'audio.route.wake-word',
      'audio.route.speech-to-text',
      'audio.route.tts-output',
      'audio.route.monitoring',
    ]);
  });

  it('every channel name is unique', () => {
    const values = Object.values(AUDIO_CHANNELS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('defines session, device, and pipeline-stage lifecycle events', () => {
    expect(AUDIO_EVENTS.SESSION_STARTED).toBe('audio.session.started');
    expect(AUDIO_EVENTS.SESSION_ENDED).toBe('audio.session.ended');
    expect(AUDIO_EVENTS.STAGE_HEALTH_FAILED).toBe('audio.pipeline.stage-health-failed');

    const values = Object.values(AUDIO_EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });
});
