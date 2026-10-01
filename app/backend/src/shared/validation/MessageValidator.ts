import type { IMessage } from '@backend/shared/interfaces/IMessage';
import { MESSAGE_KINDS } from '@backend/shared/types/MessageKind';
import { PRIORITY_LEVELS } from '@backend/shared/types/Priority';
import { MessageValidationError } from '@backend/shared/errors/InfrastructureError';

/**
 * Structural validation for message envelopes. Deliberately shallow —
 * it checks the transport envelope is well-formed, never the business
 * meaning of `payload`.
 */
export class MessageValidator {
  static validate(message: IMessage): void {
    if (!message.channel || typeof message.channel !== 'string') {
      throw new MessageValidationError('Message is missing a valid "channel"', { message });
    }

    if (!MESSAGE_KINDS.includes(message.kind)) {
      throw new MessageValidationError(`Unknown message kind "${message.kind}"`, { message });
    }

    const { metadata } = message;
    if (!metadata) {
      throw new MessageValidationError('Message is missing "metadata"', { message });
    }
    if (!metadata.id || typeof metadata.id !== 'string') {
      throw new MessageValidationError('Message metadata is missing a valid "id"', { message });
    }
    if (!metadata.correlationId || typeof metadata.correlationId !== 'string') {
      throw new MessageValidationError('Message metadata is missing a valid "correlationId"', {
        message,
      });
    }
    if (typeof metadata.timestamp !== 'number') {
      throw new MessageValidationError('Message metadata is missing a valid "timestamp"', {
        message,
      });
    }
    if (!PRIORITY_LEVELS.includes(metadata.priority)) {
      throw new MessageValidationError(`Unknown message priority "${metadata.priority}"`, {
        message,
      });
    }
    if (!metadata.source || typeof metadata.source !== 'string') {
      throw new MessageValidationError('Message metadata is missing a valid "source"', {
        message,
      });
    }
  }
}
