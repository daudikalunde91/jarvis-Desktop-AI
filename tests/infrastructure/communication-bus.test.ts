import { describe, expect, it, vi } from 'vitest';

import { CommunicationBus } from '@backend/infrastructure/communication-bus/CommunicationBus';
import {
  MessageValidationError,
  MessageTimeoutError,
} from '@backend/shared/errors/InfrastructureError';
import { createTestLogger } from '../support/testLogger';

function makeBus() {
  return new CommunicationBus(createTestLogger(), {
    commandTimeoutMs: 200,
    maxRetryAttempts: 2,
    retryBackoffBaseMs: 10,
  });
}

describe('CommunicationBus', () => {
  it('routes an event to subscribers of its channel, in priority order', async () => {
    const bus = makeBus();
    const received: string[] = [];

    bus.subscribe('test.channel', (message) => {
      received.push(String((message.payload as { tag: string }).tag));
    });

    bus.publishEvent('test.channel', { tag: 'low' }, { source: 'test', priority: 'low' });
    bus.publishEvent('test.channel', { tag: 'critical' }, { source: 'test', priority: 'critical' });
    bus.publishEvent('test.channel', { tag: 'normal' }, { source: 'test', priority: 'normal' });

    // Let the microtask-scheduled drain run.
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toEqual(['critical', 'normal', 'low']);
  });

  it('unsubscribe() stops further delivery', async () => {
    const bus = makeBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('test.channel', handler);

    unsubscribe();
    bus.publishEvent('test.channel', {}, { source: 'test' });
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).not.toHaveBeenCalled();
  });

  it('sendCommand resolves with the payload the handler responds with', async () => {
    const bus = makeBus();

    bus.subscribe('math.add', (message) => {
      const { a, b } = message.payload as { a: number; b: number };
      bus.respond(message, { sum: a + b });
    });

    const result = await bus.sendCommand<{ a: number; b: number }, { sum: number }>(
      'math.add',
      { a: 2, b: 3 },
      { source: 'test' },
    );

    expect(result.sum).toBe(5);
  });

  it('sendCommand rejects with MessageTimeoutError when nothing responds', async () => {
    const bus = makeBus();

    await expect(
      bus.sendCommand('nobody.listens', {}, { source: 'test', maxAttempts: 1, timeoutMs: 30 }),
    ).rejects.toBeInstanceOf(MessageTimeoutError);
  });

  it('sendCommand retries up to maxAttempts before giving up', async () => {
    const bus = makeBus();
    let attempts = 0;

    bus.subscribe('flaky', (message) => {
      attempts += 1;
      if (attempts < 2) return; // swallow the first attempt — simulates a dropped response
      bus.respond(message, { ok: true });
    });

    const result = await bus.sendCommand(
      'flaky',
      {},
      { source: 'test', timeoutMs: 30, maxAttempts: 3 },
    );
    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it('rejects malformed messages via MessageValidator', () => {
    const bus = makeBus();
    expect(() => bus.publishEvent('', {}, { source: 'test' })).toThrow(MessageValidationError);
  });
});
