import type { ILogger } from '@backend/logging/ILogger';
import type {
  IMessage,
  ICommandMessage,
  IResponseMessage,
  MessageHandler,
} from '@backend/shared/interfaces/IMessage';
import {
  createCommandMessage,
  createEventMessage,
  createNotificationMessage,
  createResponseMessage,
  createErrorMessage,
} from '@backend/shared/contracts/MessageEnvelope';
import { MessageValidator } from '@backend/shared/validation/MessageValidator';
import {
  CommunicationBusError,
  MessageTimeoutError,
} from '@backend/shared/errors/InfrastructureError';
import { INFRASTRUCTURE_DEFAULTS } from '@backend/shared/constants/infrastructure.constants';
import { exponentialBackoff } from '@backend/shared/utilities/backoff';
import { delay } from '@backend/shared/utilities/delay';

import type {
  ICommunicationBus,
  PublishOptions,
  SendCommandOptions,
} from '@backend/infrastructure/communication-bus/ICommunicationBus';
import { PriorityMessageQueue } from '@backend/infrastructure/communication-bus/PriorityMessageQueue';

interface PendingResponse {
  resolve: (message: IResponseMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Concrete Communication Bus.
 *
 * All message kinds flow through one internal priority queue, drained on
 * a microtask so publish() never blocks the caller. Responses are routed
 * back to the pending `sendCommand` promise by correlation ID instead of
 * being delivered to channel subscribers, keeping request/response
 * semantics distinct from plain pub/sub.
 */
export interface CommunicationBusDefaults {
  commandTimeoutMs?: number;
  maxRetryAttempts?: number;
  retryBackoffBaseMs?: number;
}

export class CommunicationBus implements ICommunicationBus {
  private readonly subscribers = new Map<string, Set<MessageHandler>>();
  private readonly queue = new PriorityMessageQueue();
  private readonly pending = new Map<string, PendingResponse>();
  private draining = false;
  private readonly defaults: Required<CommunicationBusDefaults>;

  constructor(
    private readonly logger: ILogger,
    defaults: CommunicationBusDefaults = {},
  ) {
    this.defaults = {
      commandTimeoutMs:
        defaults.commandTimeoutMs ?? INFRASTRUCTURE_DEFAULTS.communicationBus.commandTimeoutMs,
      maxRetryAttempts:
        defaults.maxRetryAttempts ?? INFRASTRUCTURE_DEFAULTS.communicationBus.maxRetryAttempts,
      retryBackoffBaseMs:
        defaults.retryBackoffBaseMs ?? INFRASTRUCTURE_DEFAULTS.communicationBus.retryBackoffBaseMs,
    };
  }

  subscribe<TPayload = unknown>(channel: string, handler: MessageHandler<TPayload>): () => void {
    const handlers = this.subscribers.get(channel) ?? new Set<MessageHandler>();
    handlers.add(handler as MessageHandler);
    this.subscribers.set(channel, handlers);

    this.logger.debug(`Subscribed to channel "${channel}"`);

    return () => {
      handlers.delete(handler as MessageHandler);
      if (handlers.size === 0) {
        this.subscribers.delete(channel);
      }
    };
  }

  publishEvent<TPayload>(channel: string, payload: TPayload, options: PublishOptions): void {
    this.enqueue(createEventMessage(channel, payload, options));
  }

  publishNotification<TPayload>(channel: string, payload: TPayload, options: PublishOptions): void {
    this.enqueue(createNotificationMessage(channel, payload, options));
  }

  publishError(
    channel: string,
    error: { code: string; message: string; stack?: string },
    options: PublishOptions,
    inReplyTo?: string,
  ): void {
    this.enqueue(createErrorMessage(channel, error, options, inReplyTo));
  }

  respond<TPayload>(request: ICommandMessage | IMessage, payload: TPayload, success = true): void {
    const response = createResponseMessage(request, payload, success, 'communication-bus');
    this.enqueue(response);
  }

  async sendCommand<TPayload, TResult = unknown>(
    channel: string,
    payload: TPayload,
    options: SendCommandOptions,
  ): Promise<TResult> {
    const maxAttempts = options.maxAttempts ?? this.defaults.maxRetryAttempts;
    const backoffBase = options.retryBackoffMs ?? this.defaults.retryBackoffBaseMs;
    const timeoutMs = options.timeoutMs ?? this.defaults.commandTimeoutMs;

    let lastError: Error = new CommunicationBusError('sendCommand failed with no attempts made');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.sendOnce<TPayload>(channel, payload, {
          ...options,
          timeoutMs,
          attempt,
          maxAttempts,
        });
        if (!response.success) {
          throw new CommunicationBusError(`Command on channel "${channel}" was rejected`, {
            payload: response.payload,
          });
        }
        return response.payload as TResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isTimeout = error instanceof MessageTimeoutError;
        if (isTimeout && attempt < maxAttempts) {
          const backoff = exponentialBackoff(attempt, backoffBase);
          this.logger.warn(
            `Command on channel "${channel}" timed out (attempt ${attempt}/${maxAttempts}); retrying in ${backoff}ms`,
          );
          await delay(backoff);
          continue;
        }
        throw lastError;
      }
    }

    throw lastError;
  }

  private sendOnce<TPayload>(
    channel: string,
    payload: TPayload,
    options: SendCommandOptions & { attempt: number; maxAttempts: number },
  ): Promise<IResponseMessage> {
    const command = createCommandMessage(channel, payload, options);
    command.metadata.timeoutMs = options.timeoutMs;
    command.metadata.retry = {
      attempt: options.attempt,
      maxAttempts: options.maxAttempts,
      backoffMs: options.retryBackoffMs ?? this.defaults.retryBackoffBaseMs,
    };

    return new Promise<IResponseMessage>((resolve, reject) => {
      const timeoutMs = options.timeoutMs ?? this.defaults.commandTimeoutMs;
      const timer = setTimeout(() => {
        this.pending.delete(command.metadata.correlationId);
        reject(
          new MessageTimeoutError(
            `Command on channel "${channel}" timed out after ${timeoutMs}ms`,
            {
              correlationId: command.metadata.correlationId,
            },
          ),
        );
      }, timeoutMs);

      this.pending.set(command.metadata.correlationId, { resolve, reject, timer });
      this.enqueue(command);
    });
  }

  private enqueue(message: IMessage): void {
    MessageValidator.validate(message);
    this.queue.enqueue(message);
    this.scheduleDrain();
  }

  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;
    queueMicrotask(() => this.drain());
  }

  private drain(): void {
    let message: IMessage | undefined;
    // eslint-disable-next-line no-cond-assign
    while ((message = this.queue.dequeue())) {
      this.dispatch(message);
    }
    this.draining = false;
  }

  private dispatch(message: IMessage): void {
    if (message.kind === 'response') {
      this.resolvePending(message as IResponseMessage);
      return;
    }

    const handlers = this.subscribers.get(message.channel);
    if (!handlers || handlers.size === 0) {
      this.logger.warn(`No subscribers for channel "${message.channel}"`, {
        kind: message.kind,
        correlationId: message.metadata.correlationId,
      });
      return;
    }

    for (const handler of handlers) {
      try {
        const result = handler(message);
        if (result instanceof Promise) {
          result.catch((error) => this.logHandlerError(message, error));
        }
      } catch (error) {
        this.logHandlerError(message, error);
      }
    }
  }

  private resolvePending(response: IResponseMessage): void {
    const pending = this.pending.get(response.inReplyTo);
    if (!pending) {
      this.logger.debug(`Received response with no pending caller`, {
        correlationId: response.inReplyTo,
      });
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(response.inReplyTo);
    pending.resolve(response);
  }

  private logHandlerError(message: IMessage, error: unknown): void {
    this.logger.error(`Handler for channel "${message.channel}" threw`, {
      kind: message.kind,
      correlationId: message.metadata.correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
