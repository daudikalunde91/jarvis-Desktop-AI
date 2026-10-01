import { IntegrationError } from '@backend/integrations/errors';
import type { ICredentialStore } from '@backend/integrations/credentials/ICredentialStore';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt: number;
  scopes: string[];
}

export interface TokenRefresher {
  refresh(refreshToken: string): Promise<{ accessToken: string; expiresInSec: number; refreshToken?: string }>;
}

/**
 * Loads, validates, refreshes and persists tokens for ONE credential key.
 * Tokens live only in the encrypted credential store and in this main-process
 * object — they are never returned to IPC callers or logged.
 */
export class TokenManager {
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly key: string,
    private readonly store: ICredentialStore,
    private readonly refresher: TokenRefresher,
    private readonly now: () => number = Date.now,
    private readonly skewMs = 60_000,
  ) {}

  async save(tokens: TokenSet): Promise<void> {
    await this.store.set(this.key, JSON.stringify(tokens));
  }

  async clear(): Promise<void> {
    await this.store.delete(this.key);
  }

  async hasTokens(): Promise<boolean> {
    return this.store.has(this.key);
  }

  async load(): Promise<TokenSet | null> {
    const raw = await this.store.get(this.key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as TokenSet;
      return typeof parsed.accessToken === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  /** True when the access token is expired and cannot be refreshed. */
  async isExpiredBeyondRepair(): Promise<boolean> {
    const t = await this.load();
    return !!t && t.expiresAt - this.skewMs <= this.now() && !t.refreshToken;
  }

  /** Valid access token, refreshing if needed. Throws AUTH_REQUIRED / AUTH_EXPIRED. */
  async getAccessToken(): Promise<string> {
    const tokens = await this.load();
    if (!tokens) throw new IntegrationError('AUTH_REQUIRED');
    if (tokens.expiresAt - this.skewMs > this.now()) return tokens.accessToken;
    if (!tokens.refreshToken) {
      await this.clear();
      throw new IntegrationError('AUTH_EXPIRED');
    }
    this.inflight ??= this.doRefresh(tokens).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  /** Force a refresh (e.g. after an API 401). */
  async forceRefresh(): Promise<string> {
    const tokens = await this.load();
    if (!tokens) throw new IntegrationError('AUTH_REQUIRED');
    if (!tokens.refreshToken) throw new IntegrationError('AUTH_EXPIRED');
    this.inflight ??= this.doRefresh(tokens).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doRefresh(tokens: TokenSet): Promise<string> {
    try {
      const fresh = await this.refresher.refresh(tokens.refreshToken as string);
      const next: TokenSet = {
        accessToken: fresh.accessToken,
        refreshToken: fresh.refreshToken ?? tokens.refreshToken,
        expiresAt: this.now() + fresh.expiresInSec * 1000,
        scopes: tokens.scopes,
      };
      await this.save(next);
      return next.accessToken;
    } catch (error) {
      if (error instanceof IntegrationError && error.integrationCode === 'AUTH_EXPIRED') {
        // Refresh token revoked/expired: drop dead credentials so status reflects reality.
        await this.clear();
      }
      throw error instanceof IntegrationError ? error : new IntegrationError('PROVIDER_ERROR');
    }
  }
}
