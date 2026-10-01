import { AppError } from '@backend/core/errors/AppError';

/** Base class for every error the Speech-to-Text Architecture throws. */
export class SpeechError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, true, context);
  }
}

export class SpeechProviderError extends SpeechError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SPEECH_PROVIDER_ERROR', context);
  }
}

export class SpeechRegistryError extends SpeechError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SPEECH_REGISTRY_ERROR', context);
  }
}

export class SpeechSessionError extends SpeechError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SPEECH_SESSION_ERROR', context);
  }
}
