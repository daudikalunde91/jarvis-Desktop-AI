import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { GoogleOAuthClient } from '@backend/integrations/oauth/GoogleOAuthClient';
import { authorizeViaLoopback } from '@backend/integrations/oauth/LoopbackAuthorizer';
import { codeChallengeS256 } from '@backend/integrations/oauth/pkce';
import { TokenManager } from '@backend/integrations/oauth/TokenManager';
import { fakeFetch, MemoryCredentialStore } from '../support/integrationFakes';

const get = (url: string) => new Promise<number>((resolve) => http.get(url, (r) => { r.resume(); resolve(r.statusCode ?? 0); }));

describe('Google OAuth', () => {
  it('builds a PKCE S256 URL with offline access and no client secret', () => {
    const c = new GoogleOAuthClient({ clientId: 'cid', clientSecret: 'TOP-SECRET' });
    const url = new URL(c.buildAuthUrl({ redirectUri: 'http://127.0.0.1:1/oauth/callback', scopes: ['a', 'b'], state: 'st', codeChallenge: 'ch' }));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('a b');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.toString().includes('TOP-SECRET')).toBe(false);
  });

  it('PKCE challenge matches RFC 7636 test vector', () => {
    expect(codeChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('exchanges a code and maps invalid_grant on refresh to AUTH_EXPIRED', async () => {
    const ok = fakeFetch(() => ({ status: 200, body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 's1 s2' } }));
    const c = new GoogleOAuthClient({ clientId: 'cid' }, ok.fetchImpl, () => 1000);
    const t = await c.exchangeCode({ code: 'c', redirectUri: 'r', codeVerifier: 'v', scopes: ['s1'] });
    expect(t).toEqual({ accessToken: 'AT', refreshToken: 'RT', expiresAt: 1000 + 3_600_000, scopes: ['s1', 's2'] });
    expect(ok.calls[0]!.body!.includes('code_verifier=v')).toBe(true);

    const bad = fakeFetch(() => ({ status: 400, body: { error: 'invalid_grant' } }));
    const c2 = new GoogleOAuthClient({ clientId: 'cid' }, bad.fetchImpl);
    await expect(c2.refresh('RT')).rejects.toMatchObject({ integrationCode: 'AUTH_EXPIRED' });
  });
});

describe('Loopback authorizer', () => {
  it('ignores a forged callback (wrong state) and accepts the real one', async () => {
    let authUrl = '';
    const p = authorizeViaLoopback({
      allowedOrigins: ['https://accounts.google.com'],
      openExternal: async (u) => { authUrl = u; },
      buildAuthUrl: ({ redirectUri, state, codeChallenge }) => `https://accounts.google.com/auth?redirect=${encodeURIComponent(redirectUri)}&state=${state}&c=${codeChallenge}`,
      timeoutMs: 5000,
    });
    await new Promise((r) => setTimeout(r, 50));
    const u = new URL(authUrl);
    const redirect = u.searchParams.get('redirect')!;
    const state = u.searchParams.get('state')!;
    expect(await get(`${redirect}?code=EVIL&state=wrong`)).toBe(400);
    expect(await get(`${redirect}?code=GOOD&state=${state}`)).toBe(200);
    const result = await p;
    expect(result.code).toBe('GOOD');
    expect(result.redirectUri.startsWith('http://127.0.0.1:')).toBe(true);
  });

  it('refuses to open a non-allowlisted URL', async () => {
    await expect(authorizeViaLoopback({
      allowedOrigins: ['https://accounts.google.com'],
      openExternal: async () => {},
      buildAuthUrl: () => 'https://evil.example.com/phish',
      timeoutMs: 1000,
    })).rejects.toMatchObject({ integrationCode: 'INVALID_CONFIGURATION' });
  });

  it('times out when the user never authorizes', async () => {
    await expect(authorizeViaLoopback({
      allowedOrigins: ['https://accounts.google.com'], openExternal: async () => {},
      buildAuthUrl: () => 'https://accounts.google.com/x', timeoutMs: 100,
    })).rejects.toMatchObject({ integrationCode: 'AUTH_REQUIRED' });
  });
});

describe('TokenManager', () => {
  const seed = (store: MemoryCredentialStore, expiresAt: number, refresh = 'RT') =>
    store.set('k', JSON.stringify({ accessToken: 'OLD', refreshToken: refresh || undefined, expiresAt, scopes: [] }));

  it('AUTH_REQUIRED when no tokens', async () => {
    const tm = new TokenManager('k', new MemoryCredentialStore(), { refresh: async () => ({ accessToken: 'x', expiresInSec: 1 }) });
    await expect(tm.getAccessToken()).rejects.toMatchObject({ integrationCode: 'AUTH_REQUIRED' });
  });

  it('returns the cached token while valid, refreshes once (deduped) when expired', async () => {
    const store = new MemoryCredentialStore();
    let refreshes = 0;
    const now = () => 10_000;
    const tm = new TokenManager('k', store, { refresh: async () => { refreshes++; return { accessToken: 'NEW', expiresInSec: 3600 }; } }, now);
    await seed(store, 10_000 + 600_000);
    expect(await tm.getAccessToken()).toBe('OLD');
    await seed(store, 10_000 + 1000); // inside the 60s skew window? no: 1s < 60s -> expired
    const [a, b] = await Promise.all([tm.getAccessToken(), tm.getAccessToken()]);
    expect([a, b]).toEqual(['NEW', 'NEW']);
    expect(refreshes).toBe(1);
    expect(JSON.parse((await store.get('k'))!).refreshToken).toBe('RT');
  });

  it('clears dead credentials when the refresh token is rejected', async () => {
    const store = new MemoryCredentialStore();
    const { IntegrationError } = await import('@backend/integrations/errors');
    const tm = new TokenManager('k', store, { refresh: async () => { throw new IntegrationError('AUTH_EXPIRED'); } }, () => 10_000);
    await seed(store, 1);
    await expect(tm.getAccessToken()).rejects.toMatchObject({ integrationCode: 'AUTH_EXPIRED' });
    expect(await store.has('k')).toBe(false);
  });

  it('expired with no refresh token => AUTH_EXPIRED and reported as unrepairable', async () => {
    const store = new MemoryCredentialStore();
    const tm = new TokenManager('k', store, { refresh: async () => ({ accessToken: 'x', expiresInSec: 1 }) }, () => 10_000);
    await seed(store, 1, '');
    expect(await tm.isExpiredBeyondRepair()).toBe(true);
    await expect(tm.getAccessToken()).rejects.toMatchObject({ integrationCode: 'AUTH_EXPIRED' });
  });
});
