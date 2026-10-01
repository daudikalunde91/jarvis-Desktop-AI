import type { IEvent, EventHandler } from '@backend/shared/interfaces/IEvent';

/**
 * Centralized event engine. Distinct from the Communication Bus: events
 * here are fire-and-forget, categorized (system/application/plugin/
 * agent/user/internal), support priority ordering and delayed delivery,
 * but never expect a response.
 */
export interface IEventSystem {
  on<TPayload = unknown>(name: string, handler: EventHandler<TPayload>): () => void;
  off(name: string, handler: EventHandler): void;
  emit<TPayload>(event: IEvent<TPayload>): void;
  emitDelayed<TPayload>(event: IEvent<TPayload>, delayMs: number): () => void;
}
