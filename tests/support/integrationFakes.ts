import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ICredentialStore, ISecretCipher } from '@backend/integrations/credentials/ICredentialStore';
import type { FetchLike } from '@backend/integrations/http/IntegrationHttpClient';
import { createIntegrations } from '@backend/integrations/createIntegrations';

export const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} };

export class MemoryCredentialStore implements ICredentialStore {
  readonly data = new Map<string, string>();
  async get(k: string) { return this.data.get(k) ?? null; }
  async set(k: string, v: string) { this.data.set(k, v); }
  async delete(k: string) { this.data.delete(k); }
  async has(k: string) { return this.data.has(k); }
}

/** Reversible fake cipher: proves ciphertext != plaintext without OS APIs. */
export class FakeCipher implements ISecretCipher {
  constructor(public available = true) {}
  isAvailable() { return this.available; }
  encrypt(p: string) { return Buffer.from(Buffer.from(p).reverse()); }
  decrypt(d: Buffer) { return Buffer.from(d).reverse().toString(); }
}

export interface RecordedCall { url: string; method: string; headers: Record<string, string>; body?: string }
type Responder = (call: RecordedCall) => { status: number; body?: unknown; headers?: Record<string, string> };

export function fakeFetch(responder: Responder): { fetchImpl: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init = {}) => {
    const call: RecordedCall = { url, method: String(init.method ?? 'GET'), headers: (init.headers as Record<string, string>) ?? {}, body: init.body as string | undefined };
    calls.push(call);
    const r = responder(call);
    const headers = r.headers ?? {};
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
      text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)),
    };
  };
  return { fetchImpl, calls };
}

export function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-int-'));
}

/** A manager with Gmail+Calendar configured, optionally pre-connected with the given capabilities. */
export async function buildManager(opts: {
  fetchImpl: FetchLike;
  connected?: { gmail?: string[]; calendar?: string[] };
  configured?: boolean;
  enabled?: boolean;
}) {
  const store = new MemoryCredentialStore();
  const dir = tmpDir();
  const manager = createIntegrations({
    logger,
    dataDir: dir,
    cipher: new FakeCipher(),
    credentialStore: store,
    fetchImpl: opts.fetchImpl,
    openExternal: async () => {},
    env: {
      gmailEnabled: opts.enabled ?? true,
      calendarEnabled: opts.enabled ?? true,
      googleClientId: opts.configured === false ? undefined : 'test-client-id',
    },
  });
  const seed = async (key: string) => store.set(key, JSON.stringify({ accessToken: 'AT-secret', refreshToken: 'RT-secret', expiresAt: Date.now() + 3_600_000, scopes: [] }));
  const { IntegrationGrantStore } = await import('@backend/integrations/credentials/IntegrationGrantStore');
  const grants = new IntegrationGrantStore(`${dir}/integration-grants.json`);
  if (opts.connected?.gmail) { await seed('google:gmail'); grants.set('gmail', opts.connected.gmail as never); }
  if (opts.connected?.calendar) { await seed('google:calendar'); grants.set('calendar', opts.connected.calendar as never); }
  return { manager, store, dir };
}
