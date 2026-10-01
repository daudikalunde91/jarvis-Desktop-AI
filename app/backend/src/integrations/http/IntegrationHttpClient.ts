import { IntegrationError, type IntegrationErrorCode } from '@backend/integrations/errors';

export type FetchLike = (url: string, init?: Record<string, unknown>) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface HttpClientOptions {
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly backoffBaseMs?: number;
  readonly maxCooldownMs?: number;
  /** Injectable for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

export interface HttpRequest {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

/**
 * Shared HTTP client for integration providers.
 *  - timeout via AbortController
 *  - retries (exponential backoff) ONLY for idempotent GETs on 429/5xx/network,
 *    and for 429 on any method (the request was not processed)
 *  - cooldown: after a 429 the client fails fast with RATE_LIMITED until Retry-After passes
 *  - errors are normalized; response bodies are never put in error messages
 */
export class IntegrationHttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly maxCooldownMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private cooldownUntil = 0;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.backoffBaseMs = options.backoffBaseMs ?? 400;
    this.maxCooldownMs = options.maxCooldownMs ?? 60_000;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = options.now ?? Date.now;
  }

  isCoolingDown(): boolean {
    return this.now() < this.cooldownUntil;
  }

  /** Returns parsed JSON (or null for empty bodies). Throws IntegrationError. */
  async requestJson<T = unknown>(url: string, request: HttpRequest = {}): Promise<T | null> {
    const method = request.method ?? 'GET';
    if (this.isCoolingDown()) throw new IntegrationError('RATE_LIMITED');

    let attempt = 0;
    for (;;) {
      attempt += 1;
      let failure: IntegrationError;
      try {
        const response = await this.send(url, method, request);
        if (response.ok) {
          const text = await response.text();
          return text ? (JSON.parse(text) as T) : null;
        }
        failure = this.fromStatus(response.status, response.headers.get('retry-after'));
        if (failure.integrationCode === 'RATE_LIMITED') this.startCooldown(response.headers.get('retry-after'));
      } catch (error) {
        failure = error instanceof IntegrationError ? error : new IntegrationError('NETWORK_ERROR');
      }

      const retryable =
        failure.integrationCode === 'RATE_LIMITED' ||
        (method === 'GET' && (failure.integrationCode === 'PROVIDER_ERROR' || failure.integrationCode === 'NETWORK_ERROR'));
      if (!retryable || attempt > this.maxRetries || this.isCoolingDown()) throw failure;
      await this.sleep(this.backoffBaseMs * 2 ** (attempt - 1));
    }
  }

  private async send(url: string, method: string, request: HttpRequest) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private startCooldown(retryAfter: string | null): void {
    const seconds = Number(retryAfter);
    const ms = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
    this.cooldownUntil = this.now() + Math.min(ms, this.maxCooldownMs);
  }

  private fromStatus(status: number, _retryAfter: string | null): IntegrationError {
    let code: IntegrationErrorCode;
    if (status === 401) code = 'AUTH_EXPIRED';
    else if (status === 403) code = 'PERMISSION_DENIED';
    else if (status === 404) code = 'NOT_FOUND';
    else if (status === 429) code = 'RATE_LIMITED';
    else if (status === 400 || status === 422) code = 'INVALID_REQUEST';
    else code = 'PROVIDER_ERROR';
    return new IntegrationError(code, undefined, { status });
  }
}
