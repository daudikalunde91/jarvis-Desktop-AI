import { AppError } from '@backend/core/errors/AppError';

/**
 * Normalized provider errors (M5.1).
 *
 * Every adapter (OpenAI/Gemini/Claude/Local) MUST catch its own
 * SDK/HTTP-specific error and re-throw one of these. Nothing above the
 * adapter layer (router, fallback manager, orchestrator) should ever see
 * a raw provider error shape.
 */
export class ProviderError extends AppError {
  constructor(
    message: string,
    code: string,
    public readonly providerId: string,
    context?: Record<string, unknown>,
  ) {
    super(message, code, true, context);
  }
}

export class AuthenticationError extends ProviderError {
  constructor(providerId: string, context?: Record<string, unknown>) {
    super(`${providerId}: authentication failed`, 'AI_AUTHENTICATION_ERROR', providerId, context);
  }
}

export class RateLimitError extends ProviderError {
  constructor(providerId: string, public readonly retryAfterMs?: number, context?: Record<string, unknown>) {
    super(`${providerId}: rate limited`, 'AI_RATE_LIMIT_ERROR', providerId, context);
  }
}

export class QuotaExceededError extends ProviderError {
  constructor(providerId: string, context?: Record<string, unknown>) {
    super(`${providerId}: quota exceeded`, 'AI_QUOTA_EXCEEDED_ERROR', providerId, context);
  }
}

export class TimeoutError extends ProviderError {
  constructor(providerId: string, context?: Record<string, unknown>) {
    super(`${providerId}: request timed out`, 'AI_TIMEOUT_ERROR', providerId, context);
  }
}

export class NetworkError extends ProviderError {
  constructor(providerId: string, context?: Record<string, unknown>) {
    super(`${providerId}: network error`, 'AI_NETWORK_ERROR', providerId, context);
  }
}

export class ModelUnavailableError extends ProviderError {
  constructor(providerId: string, context?: Record<string, unknown>) {
    super(`${providerId}: model unavailable`, 'AI_MODEL_UNAVAILABLE_ERROR', providerId, context);
  }
}

export class InvalidRequestError extends ProviderError {
  constructor(providerId: string, context?: Record<string, unknown>) {
    super(`${providerId}: invalid request`, 'AI_INVALID_REQUEST_ERROR', providerId, context);
  }
}

/** All cloud providers were unavailable/exhausted for this request. */
export class AllProvidersFailedError extends AppError {
  constructor(public readonly attempts: readonly ProviderError[]) {
    // FIX (startup-debug pass): this used to keep only { providerId, code }
    // per attempt, throwing away each ProviderError's `context` (HTTP
    // status + truncated response body). `attempts` itself still exposes
    // the full ProviderError objects for callers that want them, but
    // anything that only reads this error's `.context` (log sinks, crash
    // reporters, a future health/debug panel) now gets the real reason
    // too, not just an opaque error code.
    super('All configured AI providers failed for this request', 'AI_ALL_PROVIDERS_FAILED', true, {
      attempts: attempts.map((a) => ({ providerId: a.providerId, code: a.code, ...a.context })),
    });
  }
}

/**
 * Maps a normalized ProviderError to the health state the
 * ProviderHealthManager should transition the provider into, plus a
 * cooldown duration in ms (0 = no cooldown / not applicable).
 */
export function classifyForHealth(error: ProviderError): { state: 'RATE_LIMITED' | 'UNAVAILABLE'; cooldownMs: number } {
  if (error instanceof RateLimitError) {
    return { state: 'RATE_LIMITED', cooldownMs: error.retryAfterMs ?? 30_000 };
  }
  if (error instanceof QuotaExceededError) {
    return { state: 'RATE_LIMITED', cooldownMs: 5 * 60_000 };
  }
  if (error instanceof TimeoutError || error instanceof NetworkError || error instanceof ModelUnavailableError) {
    return { state: 'UNAVAILABLE', cooldownMs: 15_000 };
  }
  if (error instanceof AuthenticationError) {
    return { state: 'UNAVAILABLE', cooldownMs: 10 * 60_000 };
  }
  // InvalidRequestError is a caller-side bug, not a provider health signal —
  // still cool down briefly so a broken request can't hot-loop the fallback chain.
  return { state: 'UNAVAILABLE', cooldownMs: 5_000 };
}
