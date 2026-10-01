import type {
  IMessage,
  ICommandMessage,
  MessageHandler,
} from '@backend/shared/interfaces/IMessage';
import type { Priority } from '@backend/shared/types/Priority';

export interface PublishOptions {
  priority?: Priority;
  source: string;
  correlationId?: string;
}

export interface SendCommandOptions extends PublishOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryBackoffMs?: number;
}

/**
 * Centralized asynchronous Communication Bus.
 *
 * Transport only: routes commands, events, responses, notifications, and
 * error messages between subscribers. Never contains business logic —
 * callers decide what a message means, the bus only decides who receives
 * it and in what order.
 */
export interface ICommunicationBus {
  subscribe<TPayload = unknown>(channel: string, handler: MessageHandler<TPayload>): () => void;

  publishEvent<TPayload>(channel: string, payload: TPayload, options: PublishOptions): void;
  publishNotification<TPayload>(channel: string, payload: TPayload, options: PublishOptions): void;
  publishError(
    channel: string,
    error: { code: string; message: string; stack?: string },
    options: PublishOptions,
    inReplyTo?: string,
  ): void;

  /** Fire a command and await exactly one response, with timeout + retry. */
  sendCommand<TPayload, TResult = unknown>(
    channel: string,
    payload: TPayload,
    options: SendCommandOptions,
  ): Promise<TResult>;

  /** Called by a command handler to reply to a specific command message. */
  respond<TPayload>(
    request: ICommandMessage | IMessage,
    payload: TPayload,
    success?: boolean,
  ): void;
}
