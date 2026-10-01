import { AppError } from '@backend/core/errors/AppError';

export class SecurityError extends AppError {
  constructor(message: string, code = 'SECURITY_ERROR', context?: Record<string, unknown>) {
    super(message, code, true, context);
  }
}

/** The caller's role is not high enough for the requested action. */
export class PermissionDeniedError extends SecurityError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PERMISSION_DENIED', context);
  }
}

/** The action is allowed but the user has not confirmed it yet. */
export class ConfirmationRequiredError extends SecurityError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIRMATION_REQUIRED', context);
  }
}

/** The speaker could not be verified as an authorized user. */
export class SpeakerNotAuthorizedError extends SecurityError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SPEAKER_NOT_AUTHORIZED', context);
  }
}
