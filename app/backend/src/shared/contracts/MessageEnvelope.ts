import type {
  IMessage,
  IMessageMetadata,
  ICommandMessage,
  IEventMessage,
  INotificationMessage,
  IResponseMessage,
  IErrorMessage,
  IErrorMessagePayload,
} from '@backend/shared/interfaces/IMessage';
import type { Priority } from '@backend/shared/types/Priority';
import { generateId } from '@backend/shared/utilities/generateId';

export interface CreateMetadataOptions {
  priority?: Priority;
  source: string;
  timeoutMs?: number;
  correlationId?: string;
}

/**
 * Factory functions for building message envelopes with correct,
 * consistent metadata (id, correlationId, timestamp). Nothing here
 * routes or dispatches messages — that's CommunicationBus's job.
 */
export function createMetadata(options: CreateMetadataOptions): IMessageMetadata {
  return {
    id: generateId(),
    correlationId: options.correlationId ?? generateId(),
    timestamp: Date.now(),
    priority: options.priority ?? 'normal',
    source: options.source,
    timeoutMs: options.timeoutMs,
  };
}

export function createCommandMessage<TPayload>(
  channel: string,
  payload: TPayload,
  options: CreateMetadataOptions,
): ICommandMessage<TPayload> {
  return { kind: 'command', channel, payload, metadata: createMetadata(options) };
}

export function createEventMessage<TPayload>(
  channel: string,
  payload: TPayload,
  options: CreateMetadataOptions,
): IEventMessage<TPayload> {
  return { kind: 'event', channel, payload, metadata: createMetadata(options) };
}

export function createNotificationMessage<TPayload>(
  channel: string,
  payload: TPayload,
  options: CreateMetadataOptions,
): INotificationMessage<TPayload> {
  return { kind: 'notification', channel, payload, metadata: createMetadata(options) };
}

export function createResponseMessage<TPayload>(
  request: IMessage,
  payload: TPayload,
  success: boolean,
  source: string,
): IResponseMessage<TPayload> {
  return {
    kind: 'response',
    channel: request.channel,
    payload,
    inReplyTo: request.metadata.correlationId,
    success,
    metadata: createMetadata({ source, correlationId: request.metadata.correlationId }),
  };
}

export function createErrorMessage(
  channel: string,
  errorPayload: IErrorMessagePayload,
  options: CreateMetadataOptions,
  inReplyTo?: string,
): IErrorMessage {
  return {
    kind: 'error',
    channel,
    payload: errorPayload,
    inReplyTo,
    metadata: createMetadata(options),
  };
}
