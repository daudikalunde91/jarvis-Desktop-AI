import type { MessageKind } from '@backend/shared/types/MessageKind';
import type { Priority } from '@backend/shared/types/Priority';

/**
 * Metadata every message carries, regardless of kind. This is the only
 * place correlation IDs, timeouts, and retry bookkeeping live — payloads
 * never need to know about transport concerns.
 */
export interface IMessageMetadata {
  id: string;
  correlationId: string;
  timestamp: number;
  priority: Priority;
  source: string;
  timeoutMs?: number;
  retry?: {
    attempt: number;
    maxAttempts: number;
    backoffMs: number;
  };
}

/** Envelope shared by every message the Communication Bus routes. */
export interface IMessage<TPayload = unknown> {
  kind: MessageKind;
  channel: string;
  metadata: IMessageMetadata;
  payload: TPayload;
}

export interface ICommandMessage<TPayload = unknown> extends IMessage<TPayload> {
  kind: 'command';
}

export interface IEventMessage<TPayload = unknown> extends IMessage<TPayload> {
  kind: 'event';
}

export interface INotificationMessage<TPayload = unknown> extends IMessage<TPayload> {
  kind: 'notification';
}

export interface IResponseMessage<TPayload = unknown> extends IMessage<TPayload> {
  kind: 'response';
  inReplyTo: string;
  success: boolean;
}

export interface IErrorMessagePayload {
  code: string;
  message: string;
  stack?: string;
}

export interface IErrorMessage extends IMessage<IErrorMessagePayload> {
  kind: 'error';
  inReplyTo?: string;
}

export type AnyMessage =
  ICommandMessage | IEventMessage | INotificationMessage | IResponseMessage | IErrorMessage;

export type MessageHandler<TPayload = unknown> = (
  message: IMessage<TPayload>,
) => void | Promise<void>;
