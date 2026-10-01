import { describe, expect, it, vi } from 'vitest';

import { EventSystem } from '@backend/infrastructure/event-system/EventSystem';
import { createTestLogger } from '../support/testLogger';

describe('EventSystem', () => {
  it('dispatches an emitted event to its listeners', async () => {
    const events = new EventSystem(createTestLogger());
    const handler = vi.fn();
    events.on('agent.started', handler);

    events.emit({
      name: 'agent.started',
      category: 'agent',
      priority: 'normal',
      timestamp: Date.now(),
      payload: { id: 'abc' },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('delivers same-tick events in priority order', async () => {
    const events = new EventSystem(createTestLogger());
    const received: string[] = [];
    events.on('multi', (event) => received.push(String((event.payload as { tag: string }).tag)));

    events.emit({
      name: 'multi',
      category: 'system',
      priority: 'low',
      timestamp: Date.now(),
      payload: { tag: 'low' },
    });
    events.emit({
      name: 'multi',
      category: 'system',
      priority: 'critical',
      timestamp: Date.now(),
      payload: { tag: 'critical' },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(received).toEqual(['critical', 'low']);
  });

  it('off() stops delivery to a specific handler', async () => {
    const events = new EventSystem(createTestLogger());
    const handler = vi.fn();
    events.on('agent.started', handler);
    events.off('agent.started', handler);

    events.emit({
      name: 'agent.started',
      category: 'agent',
      priority: 'normal',
      timestamp: Date.now(),
      payload: {},
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).not.toHaveBeenCalled();
  });

  it('emitDelayed() fires after the delay elapses, not before', async () => {
    vi.useFakeTimers();
    const events = new EventSystem(createTestLogger());
    const handler = vi.fn();
    events.on('delayed.event', handler);

    events.emitDelayed(
      {
        name: 'delayed.event',
        category: 'internal',
        priority: 'normal',
        timestamp: Date.now(),
        payload: {},
      },
      1000,
    );

    await vi.advanceTimersByTimeAsync(500);
    expect(handler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);
    expect(handler).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
