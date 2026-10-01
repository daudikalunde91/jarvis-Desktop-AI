import { AppError } from '@backend/core/errors/AppError';

/** Base class for every error the Wake Word Architecture throws. Extends the same `AppError` used everywhere else. */
export class WakeWordError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, true, context);
  }
}

export class WakeWordProviderError extends WakeWordError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'WAKE_WORD_PROVIDER_ERROR', context);
  }
}

export class WakeWordRegistryError extends WakeWordError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'WAKE_WORD_REGISTRY_ERROR', context);
  }
}

export class WakeWordProfileError extends WakeWordError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'WAKE_WORD_PROFILE_ERROR', context);
  }
}
