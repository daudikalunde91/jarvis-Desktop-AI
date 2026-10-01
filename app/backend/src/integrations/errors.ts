import { AppError } from '@backend/core/errors/AppError';

/** Normalized integration error codes. Raw provider responses are NEVER surfaced. */
export const INTEGRATION_ERROR_CODES = [
  'AUTH_REQUIRED',
  'AUTH_EXPIRED',
  'PERMISSION_DENIED',
  'RATE_LIMITED',
  'NOT_FOUND',
  'NETWORK_ERROR',
  'PROVIDER_ERROR',
  'INVALID_CONFIGURATION',
  'INVALID_REQUEST',
  'NOT_IMPLEMENTED',
] as const;
export type IntegrationErrorCode = (typeof INTEGRATION_ERROR_CODES)[number];

/** Safe, user-presentable messages. Never include tokens, headers or response bodies. */
const SAFE_MESSAGES: Record<IntegrationErrorCode, string> = {
  AUTH_REQUIRED: 'This integration is not connected. Authorization is required.',
  AUTH_EXPIRED: 'The authorization for this integration expired. Please reconnect it.',
  PERMISSION_DENIED: 'JARVIS does not have permission for that action on this integration.',
  RATE_LIMITED: 'The service is rate limiting requests. Please try again shortly.',
  NOT_FOUND: 'The requested item was not found.',
  NETWORK_ERROR: 'The service could not be reached. Check your connection and try again.',
  PROVIDER_ERROR: 'The service returned an error. Please try again later.',
  INVALID_CONFIGURATION: 'This integration is not configured. See docs/INTEGRATIONS.md.',
  INVALID_REQUEST: 'The request was not valid.',
  NOT_IMPLEMENTED: 'This integration capability is not implemented yet.',
};

export class IntegrationError extends AppError {
  public readonly integrationCode: IntegrationErrorCode;

  constructor(
    integrationCode: IntegrationErrorCode,
    message?: string,
    context?: Record<string, unknown>,
  ) {
    super(message ?? SAFE_MESSAGES[integrationCode], integrationCode, true, context);
    this.integrationCode = integrationCode;
  }

  get userMessage(): string {
    return this.message;
  }
}

/** Convert anything thrown into an IntegrationError that is safe to show. */
export function toIntegrationError(error: unknown): IntegrationError {
  if (error instanceof IntegrationError) return error;
  return new IntegrationError('PROVIDER_ERROR');
}
