import type { ILogger } from '@backend/logging/ILogger';
import type { IEvent, EventHandler } from '@backend/shared/interfaces/IEvent';
import { priorityWeight } from '@backend/shared/types/Priority';
import { INFRASTRUCTURE_DEFAULTS } from '@backend/shared/constants/infrastructure.constants';
import { EventSystemError } from '@backend/shared/errors/InfrastructureError';

import type { IEventSystem } from '@backend/infrastructure/event-system/IEventSystem';

/**
 * Concrete Event System.
 *
 * Same-tick events of different priority are ordered (critical first);
 * delayed events are scheduled via `setTimeout` and simply call `emit`
 * once the delay elapses. This is intentionally simpler than the
 * Communication Bus — no responses, no retries, no timeouts on delivery.
 */
export class EventSystem implements IEventSystem {
  private readonly listeners = new Map<string, Set<EventHandler>>();
  private pendingEmits: IEvent[] = [];
  private flushing = false;
  private readonly scheduledTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly logger: ILogger) {}

  on<TPayload = unknown>(name: string, handler: EventHandler<TPayload>): () => void {
    const handlers = this.listeners.get(name) ?? new Set<EventHandler>();
    handlers.add(handler as EventHandler);
    this.listeners.set(name, handlers);

    return () => this.off(name, handler as EventHandler);
  }

  off(name: string, handler: EventHandler): void {
    const handlers = this.listeners.get(name);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(name);
    }
  }

  emit<TPayload>(event: IEvent<TPayload>): void {
    this.pendingEmits.push(event as IEvent);
    this.scheduleFlush();
  }

  emitDelayed<TPayload>(event: IEvent<TPayload>, delayMs: number): () => void {
    if (delayMs < 0 || delayMs > INFRASTRUCTURE_DEFAULTS.eventSystem.maxDelayMs) {
      throw new EventSystemError(`Invalid delay ${delayMs}ms for delayed event "${event.name}"`, {
        delayMs,
      });
    }

    const timer = setTimeout(() => {
      this.scheduledTimers.delete(timer);
      this.emit(event);
    }, delayMs);

    this.scheduledTimers.add(timer);
    return () => {
      clearTimeout(timer);
      this.scheduledTimers.delete(timer);
    };
  }

  /** Cancels all pending delayed events. Primarily useful for clean test teardown. */
  clearScheduled(): void {
    for (const timer of this.scheduledTimers) {
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();
  }

  private scheduleFlush(): void {
    if (this.flushing) return;
    this.flushing = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    const batch = this.pendingEmits.sort(
      (a, b) => priorityWeight(b.priority) - priorityWeight(a.priority),
    );
    this.pendingEmits = [];
    this.flushing = false;

    for (const event of batch) {
      this.dispatch(event);
    }
  }

  private dispatch(event: IEvent): void {
    const handlers = this.listeners.get(event.name);
    if (!handlers || handlers.size === 0) {
      this.logger.debug(`No listeners for event "${event.name}"`, { category: event.category });
      return;
    }

    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error) => this.logHandlerError(event, error));
        }
      } catch (error) {
        this.logHandlerError(event, error);
      }
    }
  }

  private logHandlerError(event: IEvent, error: unknown): void {
    this.logger.error(`Listener for event "${event.name}" threw`, {
      category: event.category,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
