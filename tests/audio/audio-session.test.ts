import { describe, expect, it } from 'vitest';

import { AudioSession } from '@backend/audio/models/AudioSession';

describe('AudioSession', () => {
  it('initializes with a generated id, "starting" status, and no end time', () => {
    const session = new AudioSession({ language: 'fr-FR' });

    expect(session.id).toBeTruthy();
    expect(session.language).toBe('fr-FR');
    expect(session.status).toBe('starting');
    expect(session.endTime).toBeNull();
    expect(session.latencyMs).toBeNull();
  });

  it('defaults language to en-US and devices to null when not provided', () => {
    const session = new AudioSession();

    expect(session.language).toBe('en-US');
    expect(session.inputDeviceId).toBeNull();
    expect(session.outputDeviceId).toBeNull();
  });

  it('activate() transitions status to "active"', () => {
    const session = new AudioSession();
    session.activate();
    expect(session.status).toBe('active');
  });

  it('end() sets status, endTime, and computes latency', () => {
    const session = new AudioSession();
    session.activate();
    session.end();

    expect(session.status).toBe('ended');
    expect(session.endTime).not.toBeNull();
    expect(session.latencyMs).not.toBeNull();
    expect(session.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('fail() records the failure reason in metadata', () => {
    const session = new AudioSession();
    session.fail('device disconnected');

    expect(session.status).toBe('failed');
    expect(session.metadata.failureReason).toBe('device disconnected');
  });

  it('every session receives a unique id', () => {
    const a = new AudioSession();
    const b = new AudioSession();
    expect(a.id).not.toBe(b.id);
  });
});
