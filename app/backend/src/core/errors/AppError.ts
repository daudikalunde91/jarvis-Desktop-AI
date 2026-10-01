/**
 * Base application error. All domain-specific errors in the codebase
 * should extend this class so the ErrorHandler can treat them uniformly.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code = 'APP_ERROR',
    isOperational = true,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ConfigError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', true, context);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', true, context);
  }
}

export class IpcError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'IPC_ERROR', true, context);
  }
}
