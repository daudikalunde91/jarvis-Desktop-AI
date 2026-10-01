import { AppError } from '@backend/core/errors/AppError';

/**
 * Base class for every error the Voice Runtime Framework throws.
 * Extends the same `AppError` used everywhere else — no new error
 * mechanism is introduced.
 */
export class VoiceRuntimeError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, true, context);
  }
}

export class VoiceRuntimeStateError extends VoiceRuntimeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VOICE_RUNTIME_STATE_ERROR', context);
  }
}

export class VoiceSessionError extends VoiceRuntimeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VOICE_SESSION_ERROR', context);
  }
}

export class VoiceSubsystemError extends VoiceRuntimeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VOICE_SUBSYSTEM_ERROR', context);
  }
}

export class VoiceRuntimeFactoryError extends VoiceRuntimeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VOICE_RUNTIME_FACTORY_ERROR', context);
  }
}
