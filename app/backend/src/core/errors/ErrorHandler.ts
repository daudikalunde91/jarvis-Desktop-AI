import type { ILogger } from '@backend/logging/ILogger';
import { AppError } from '@backend/core/errors/AppError';

/**
 * Centralized error handling foundation.
 * Distinguishes between operational errors (expected, recoverable) and
 * programmer errors (unexpected, should surface loudly), and funnels
 * everything through a single logging path.
 */
export class ErrorHandler {
  constructor(private readonly logger: ILogger) {}

  public handle(error: unknown): void {
    if (error instanceof AppError) {
      this.logger.error(`[${error.code}] ${error.message}`, {
        isOperational: error.isOperational,
        context: error.context,
        stack: error.stack,
      });
      return;
    }

    if (error instanceof Error) {
      this.logger.error(`[UNEXPECTED_ERROR] ${error.message}`, { stack: error.stack });
      return;
    }

    this.logger.error('[UNKNOWN_ERROR] A non-Error value was thrown', { error });
  }

  public registerGlobalHandlers(): void {
    process.on('uncaughtException', (error) => {
      this.handle(error);
    });

    process.on('unhandledRejection', (reason) => {
      this.handle(reason);
    });
  }
}
