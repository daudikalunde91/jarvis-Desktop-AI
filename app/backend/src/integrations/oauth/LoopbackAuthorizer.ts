import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { IntegrationError } from '@backend/integrations/errors';
import { codeChallengeS256, randomToken, safeEqual } from '@backend/integrations/oauth/pkce';

export interface LoopbackResult {
  readonly code: string;
  readonly redirectUri: string;
  readonly codeVerifier: string;
}

export interface LoopbackOptions {
  /** Builds the provider consent URL from our redirect/state/challenge. */
  readonly buildAuthUrl: (p: { redirectUri: string; state: string; codeChallenge: string }) => string;
  /** Opens the system browser (Electron `shell.openExternal`). */
  readonly openExternal: (url: string) => Promise<void>;
  /** Only these https origins may be opened. */
  readonly allowedOrigins: readonly string[];
  readonly timeoutMs?: number;
}

const PAGE = (msg: string) =>
  `<!doctype html><meta charset="utf-8"><title>JARVIS</title><body style="font-family:sans-serif;background:#0b1420;color:#cfe;text-align:center;padding:4em"><h2>${msg}</h2><p>You can close this tab and return to JARVIS.</p></body>`;

/**
 * OAuth installed-app flow: random-port loopback listener bound to 127.0.0.1,
 * PKCE (S256), constant-time `state` validation, single use, hard timeout.
 */
export async function authorizeViaLoopback(options: LoopbackOptions): Promise<LoopbackResult> {
  const state = randomToken(24);
  const codeVerifier = randomToken(48);
  const timeoutMs = options.timeoutMs ?? 180_000;

  return new Promise<LoopbackResult>((resolve, reject) => {
    let settled = false;
    const server = http.createServer();
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new IntegrationError('AUTH_REQUIRED', 'Authorization timed out.'))),
      timeoutMs,
    );

    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404).end();
        return;
      }
      const returnedState = url.searchParams.get('state') ?? '';
      const code = url.searchParams.get('code');
      const denied = url.searchParams.get('error');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (!safeEqual(returnedState, state)) {
        res.writeHead(400).end(PAGE('Authorization failed'));
        return; // keep listening: a forged request must not abort the real flow
      }
      if (denied || !code) {
        res.writeHead(200).end(PAGE('Authorization was not granted'));
        finish(() => reject(new IntegrationError('PERMISSION_DENIED', 'Authorization was not granted.')));
        return;
      }
      res.writeHead(200).end(PAGE('JARVIS is connected'));
      const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}/oauth/callback`;
      finish(() => resolve({ code, redirectUri, codeVerifier }));
    });

    server.on('error', () => finish(() => reject(new IntegrationError('PROVIDER_ERROR'))));
    server.listen(0, '127.0.0.1', () => {
      const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}/oauth/callback`;
      const authUrl = options.buildAuthUrl({ redirectUri, state, codeChallenge: codeChallengeS256(codeVerifier) });
      if (!options.allowedOrigins.some((o) => authUrl.startsWith(`${o}/`))) {
        finish(() => reject(new IntegrationError('INVALID_CONFIGURATION')));
        return;
      }
      options.openExternal(authUrl).catch(() => finish(() => reject(new IntegrationError('PROVIDER_ERROR'))));
    });
  });
}
