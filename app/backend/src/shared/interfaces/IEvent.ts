import type { EventCategory } from '@backend/shared/types/EventCategory';
import type { Priority } from '@backend/shared/types/Priority';

/** Shape emitted through the Event System (distinct from IMessage, which is bus transport). */
export interface IEvent<TPayload = unknown> {
  name: string;
  category: EventCategory;
  priority: Priority;
  timestamp: number;
  payload: TPayload;
}

export type EventHandler<TPayload = unknown> = (event: IEvent<TPayload>) => void | Promise<void>;
