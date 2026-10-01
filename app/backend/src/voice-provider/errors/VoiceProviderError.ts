import { AppError } from '@backend/core/errors/AppError';

/** Base class for every error the Voice Provider Architecture throws. */
export class VoiceProviderBaseError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, true, context);
  }
}

export class VoiceProviderError extends VoiceProviderBaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VOICE_PROVIDER_ERROR', context);
  }
}

export class VoiceProviderRegistryError extends VoiceProviderBaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VOICE_PROVIDER_REGISTRY_ERROR', context);
  }
}

export class VoiceProfileError extends VoiceProviderBaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VOICE_PROFILE_ERROR', context);
  }
}
