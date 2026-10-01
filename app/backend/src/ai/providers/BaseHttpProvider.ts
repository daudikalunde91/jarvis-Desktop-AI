import type { ILogger } from '@backend/logging/ILogger';
import {
  AuthenticationError,
  InvalidRequestError,
  ModelUnavailableError,
  NetworkError,
  QuotaExceededError,
  RateLimitError,
  TimeoutError,
} from '@backend/ai/errors';

export interface HttpCallOptions {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly timeoutMs: number;
  readonly externalSignal?: AbortSignal;
}

/**
 * Shared "make one HTTP call and normalize the outcome" logic so every
 * cloud adapter (OpenAI/Gemini/Claude/...) handles timeouts and HTTP
 * status codes identically. Adapters still own request/response shaping.
 */
export abstract class BaseHttpProvider {
  protected constructor(
    protected readonly providerId: string,
    protected readonly logger: ILogger,
  ) {}

  protected async postJson(options: HttpCallOptions): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    options.externalSignal?.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      let response: Response;
      try {
        response = await fetch(options.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...options.headers },
          body: JSON.stringify(options.body),
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new TimeoutError(this.providerId, { url: this.redact(options.url) });
        }
        throw new NetworkError(this.providerId, {
          message: error instanceof Error ? error.message : String(error),
        });
      }

      if (!response.ok) {
        throw this.normalizeStatus(response.status, await this.safeText(response));
      }

      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizeStatus(status: number, bodyText: string) {
    const context = { status, body: this.truncate(bodyText) };
    if (status === 401 || status === 403) return new AuthenticationError(this.providerId, context);
    if (status === 429 || status === 400) {
      // FIX (V7.2 / Feature F): a 429 that means "out of purchased
      // credits" (OpenAI's `insufficient_quota`, Anthropic's
      // `credit_balance_exhausted`, etc.) is a fundamentally different
      // situation from a transient per-minute rate limit — retrying it
      // in 30s is pointless and just wastes a fallback-chain attempt
      // every request until the operator notices. classifyForHealth()
      // already gives QuotaExceededError a much longer cooldown; this is
      // what makes that distinction actually fire instead of every 429
      // being treated as a short-lived rate limit. A plain 400 is only
      // ever inspected for the same quota phrases (some providers report
      // an exhausted balance as 400, not 429) — anything else at 400
      // still falls through to InvalidRequestError below.
      if (this.looksLikeQuotaExhausted(bodyText)) {
        return new QuotaExceededError(this.providerId, context);
      }
      if (status === 429) {
        const retryAfterMs = this.parseRetryAfter(bodyText);
        return new RateLimitError(this.providerId, retryAfterMs, context);
      }
    }
    if (status === 404) return new ModelUnavailableError(this.providerId, context);
    if (status >= 500) return new ModelUnavailableError(this.providerId, context);
    return new InvalidRequestError(this.providerId, context);
  }

  /** Recognizes the handful of stable phrases providers use for "no credits left", across OpenAI/Anthropic/Gemini/Groq/OpenRouter response bodies. */
  private looksLikeQuotaExhausted(bodyText: string): boolean {
    const needle = bodyText.toLowerCase();
    return (
      needle.includes('insufficient_quota') ||
      needle.includes('credit_balance_exhausted') ||
      needle.includes('exceeded your current quota') ||
      needle.includes('insufficient credits') ||
      needle.includes('out of credits')
    );
  }

  private parseRetryAfter(bodyText: string): number | undefined {
    try {
      const parsed = JSON.parse(bodyText) as { retry_after?: number; retryAfter?: number };
      const seconds = parsed.retry_after ?? parsed.retryAfter;
      return typeof seconds === 'number' ? seconds * 1000 : undefined;
    } catch {
      return undefined;
    }
  }

  private async safeText(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }

  private truncate(text: string): string {
    return text.length > 500 ? `${text.slice(0, 500)}…` : text;
  }

  /** Never let an API key show up in a logged/thrown URL. */
  private redact(url: string): string {
    return url.replace(/([?&](key|api_key|apikey)=)[^&]+/gi, '$1***');
  }
}
