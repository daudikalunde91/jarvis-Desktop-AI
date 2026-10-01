import { AppError } from '@backend/core/errors/AppError';

/**
 * Base class for every error thrown by the Audio Pipeline Architecture.
 * Extends the same `AppError` used everywhere else so `ErrorHandler`
 * continues to work unchanged — no new error-handling mechanism is
 * introduced by this milestone.
 */
export class AudioError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, true, context);
  }
}

export class AudioSessionError extends AudioError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUDIO_SESSION_ERROR', context);
  }
}

export class AudioDeviceError extends AudioError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUDIO_DEVICE_ERROR', context);
  }
}

export class AudioRoutingError extends AudioError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUDIO_ROUTING_ERROR', context);
  }
}

export class AudioPipelineError extends AudioError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUDIO_PIPELINE_ERROR', context);
  }
}

export class AudioBufferError extends AudioError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUDIO_BUFFER_ERROR', context);
  }
}

export class AudioFactoryError extends AudioError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUDIO_FACTORY_ERROR', context);
  }
}

export class AudioConfigurationError extends AudioError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUDIO_CONFIGURATION_ERROR', context);
  }
}

export class AudioPrivacyViolationError extends AudioError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUDIO_PRIVACY_VIOLATION_ERROR', context);
  }
}
