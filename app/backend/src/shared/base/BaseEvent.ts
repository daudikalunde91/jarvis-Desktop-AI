import type { IEvent } from '@backend/shared/interfaces/IEvent';
import type { EventCategory } from '@backend/shared/types/EventCategory';
import type { Priority } from '@backend/shared/types/Priority';

/** Convenience base for typed events published through the Event System. */
export abstract class BaseEvent<TPayload = unknown> implements IEvent<TPayload> {
  public readonly timestamp: number;

  protected constructor(
    public readonly name: string,
    public readonly category: EventCategory,
    public readonly payload: TPayload,
    public readonly priority: Priority = 'normal',
  ) {
    this.timestamp = Date.now();
  }
}
