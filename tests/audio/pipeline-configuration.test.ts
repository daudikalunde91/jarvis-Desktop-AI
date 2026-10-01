import { describe, expect, it } from 'vitest';

import { AUDIO_PIPELINE_STAGE_NAMES } from '@backend/audio/types/AudioPipelineStageName';
import { AudioPipelineStageBase } from '@backend/audio/pipeline/AudioPipelineStageBase';
import { AudioBufferQueue } from '@backend/audio/buffer/AudioBufferQueue';
import { AudioBufferError } from '@backend/audio/errors/AudioError';
import { LatencyTracker } from '@backend/audio/metrics/LatencyTracker';
import type { IAudioChunk } from '@backend/audio/interfaces/IAudioChunk';
import { createTestLogger } from '../support/testLogger';

class MinimalStage extends AudioPipelineStageBase {
  constructor() {
    super(createTestLogger(), 'audio-buffer');
  }
}

function makeChunk(sequence: number): IAudioChunk {
  return {
    payload: new Uint8Array([sequence]),
    metadata: {
      sessionId: 'session-1',
      sequence,
      capturedAt: Date.now(),
      format: { sampleRateHz: 16000, channels: 1, bitDepth: 16 },
    },
  };
}

describe('Pipeline configuration — stage ordering', () => {
  it('defines exactly the eight required pipeline stages, in processing order', () => {
    expect(AUDIO_PIPELINE_STAGE_NAMES).toEqual([
      'microphone-input',
      'audio-buffer',
      'noise-reduction',
      'echo-cancellation',
      'wake-word-routing',
      'speech-to-text-routing',
      'voice-output-routing',
      'speaker-output',
    ]);
  });
});

describe('AudioPipelineStageBase', () => {
  it('defaults to a pass-through process(), "running" health, and no-op lifecycle hooks', async () => {
    const stage = new MinimalStage();
    const chunk = makeChunk(1);

    await stage.initialize();
    const result = await stage.process(chunk);
    expect(result).toBe(chunk);
    expect(await stage.healthCheck()).toBe('running');
    await stage.dispose();
  });
});

describe('AudioBufferQueue', () => {
  it('evicts the oldest item once capacity is exceeded', () => {
    const queue = new AudioBufferQueue<number>(2);
    queue.push(1);
    queue.push(2);
    queue.push(3);

    expect(queue.peekAll()).toEqual([2, 3]);
    expect(queue.size).toBe(2);
    expect(queue.isFull).toBe(true);
  });

  it('drain() empties the queue and returns everything buffered', () => {
    const queue = new AudioBufferQueue<number>(5);
    queue.push(1);
    queue.push(2);

    expect(queue.drain()).toEqual([1, 2]);
    expect(queue.size).toBe(0);
  });

  it('clear() discards buffered data (privacy guarantee)', () => {
    const queue = new AudioBufferQueue<number>(5);
    queue.push(1);
    queue.clear();
    expect(queue.size).toBe(0);
  });

  it('rejects a non-positive capacity', () => {
    expect(() => new AudioBufferQueue<number>(0)).toThrow(AudioBufferError);
  });
});

describe('LatencyTracker', () => {
  it('computes average/min/max over recorded samples', () => {
    const tracker = new LatencyTracker();
    tracker.record(10);
    tracker.record(20);
    tracker.record(30);

    expect(tracker.average).toBe(20);
    expect(tracker.min).toBe(10);
    expect(tracker.max).toBe(30);
    expect(tracker.count).toBe(3);
  });

  it('returns null stats when no samples exist', () => {
    const tracker = new LatencyTracker();
    expect(tracker.average).toBeNull();
    expect(tracker.min).toBeNull();
    expect(tracker.max).toBeNull();
  });

  it('caps its rolling window at maxSamples', () => {
    const tracker = new LatencyTracker(3);
    tracker.record(1);
    tracker.record(2);
    tracker.record(3);
    tracker.record(4);

    expect(tracker.count).toBe(3);
    expect(tracker.average).toBe(3); // (2+3+4)/3
  });

  it('reset() clears all samples', () => {
    const tracker = new LatencyTracker();
    tracker.record(5);
    tracker.reset();
    expect(tracker.count).toBe(0);
  });
});
