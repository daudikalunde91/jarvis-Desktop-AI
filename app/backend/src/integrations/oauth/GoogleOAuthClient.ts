import { IntegrationError } from '@backend/integrations/errors';
import type { FetchLike } from '@backend/integrations/http/IntegrationHttpClient';
import type { TokenRefresher, TokenSet } from '@backend/integrations/oauth/TokenManager';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export interface GoogleOAuthConfig {
  readonly clientId: string;
  /** Desktop-app client secret. Backend/main process only; never sent to the renderer. */
  readonly clientSecret?: string;
}

/** Google OAuth 2.0 (installed-app / loopback + PKCE). Main process only. */
export class GoogleOAuthClient implements TokenRefresher {
  constructor(
    private readonly config: GoogleOAuthConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
    private readonly now: () => number = Date.now,
  ) {}

  buildAuthUrl(params: { redirectUri: string; scopes: readonly string[]; state: string; codeChallenge: string }): string {
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', params.scopes.join(' '));
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    return url.toString();
  }

  async exchangeCode(params: { code: string; redirectUri: string; codeVerifier: string; scopes: readonly string[] }): Promise<TokenSet> {
    const body = this.form({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    });
    const json = await this.postToken(body);
    if (!json.access_token) throw new IntegrationError('PROVIDER_ERROR');
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: this.now() + (json.expires_in ?? 3600) * 1000,
      scopes: json.scope ? json.scope.split(' ') : [...params.scopes],
    };
  }

  async refresh(refreshToken: string) {
    const json = await this.postToken(this.form({ grant_type: 'refresh_token', refresh_token: refreshToken }));
    if (!json.access_token) throw new IntegrationError('PROVIDER_ERROR');
    return { accessToken: json.access_token, expiresInSec: json.expires_in ?? 3600, refreshToken: json.refresh_token };
  }

  /** Best-effort revoke; failures are swallowed (credentials are deleted locally regardless). */
  async revoke(token: string): Promise<boolean> {
    try {
      const res = await this.fetchImpl(GOOGLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private form(extra: Record<string, string>): string {
    const p = new URLSearchParams({ client_id: this.config.clientId, ...extra });
    if (this.config.clientSecret) p.set('client_secret', this.config.clientSecret);
    return p.toString();
  }

  private async postToken(body: string): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }> {
    let res;
    try {
      res = await this.fetchImpl(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new IntegrationError('NETWORK_ERROR');
    }
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    // invalid_grant => refresh token / code is dead. Body is inspected, never surfaced.
    let errorCode = '';
    try {
      errorCode = (JSON.parse(text) as { error?: string }).error ?? '';
    } catch {
      /* ignore */
    }
    if (errorCode === 'invalid_grant') throw new IntegrationError('AUTH_EXPIRED');
    if (res.status === 429) throw new IntegrationError('RATE_LIMITED');
    if (res.status === 400 || res.status === 401) throw new IntegrationError('INVALID_CONFIGURATION');
    throw new IntegrationError('PROVIDER_ERROR');
  }
}
