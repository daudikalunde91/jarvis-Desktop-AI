import { describe, expect, it } from 'vitest';
import { IntegrationHttpClient } from '@backend/integrations/http/IntegrationHttpClient';
import { fakeFetch } from '../support/integrationFakes';

const noSleep = async () => {};

describe('IntegrationHttpClient', () => {
  it('retries GET on 503 with backoff then succeeds', async () => {
    let n = 0;
    const { fetchImpl, calls } = fakeFetch(() => (++n < 3 ? { status: 503 } : { status: 200, body: { ok: 1 } }));
    const delays: number[] = [];
    const c = new IntegrationHttpClient({ fetchImpl, sleep: async (ms) => { delays.push(ms); }, backoffBaseMs: 100 });
    expect(await c.requestJson('https://x/y')).toEqual({ ok: 1 });
    expect(calls.length).toBe(3);
    expect(delays).toEqual([100, 200]);
  });

  it('never retries POST on 5xx (could duplicate a send)', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 500 }));
    const c = new IntegrationHttpClient({ fetchImpl, sleep: noSleep });
    await expect(c.requestJson('https://x', { method: 'POST', body: '{}' })).rejects.toMatchObject({ integrationCode: 'PROVIDER_ERROR' });
    expect(calls.length).toBe(1);
  });

  it('enters cooldown after 429 and fails fast without calling the API', async () => {
    let t = 1000;
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 429, headers: { 'retry-after': '30' } }));
    const c = new IntegrationHttpClient({ fetchImpl, sleep: noSleep, now: () => t });
    await expect(c.requestJson('https://x')).rejects.toMatchObject({ integrationCode: 'RATE_LIMITED' });
    const before = calls.length;
    await expect(c.requestJson('https://x')).rejects.toMatchObject({ integrationCode: 'RATE_LIMITED' });
    expect(calls.length).toBe(before);
    t += 31_000;
    expect(c.isCoolingDown()).toBe(false);
  });

  it('normalizes statuses and never leaks response bodies', async () => {
    const cases: Array<[number, string]> = [[401, 'AUTH_EXPIRED'], [403, 'PERMISSION_DENIED'], [404, 'NOT_FOUND'], [400, 'INVALID_REQUEST']];
    for (const [status, code] of cases) {
      const { fetchImpl } = fakeFetch(() => ({ status, body: { error: 'Bearer ya29.SECRET-TOKEN-LEAK' } }));
      const c = new IntegrationHttpClient({ fetchImpl, sleep: noSleep });
      const err = await c.requestJson('https://x').catch((e) => e);
      expect(err.integrationCode).toBe(code);
      expect(String(err.message).includes('SECRET')).toBe(false);
    }
  });

  it('maps thrown network errors to NETWORK_ERROR', async () => {
    const c = new IntegrationHttpClient({ fetchImpl: async () => { throw new Error('ECONNRESET token=abc'); }, sleep: noSleep, maxRetries: 0 });
    const err = await c.requestJson('https://x').catch((e) => e);
    expect(err.integrationCode).toBe('NETWORK_ERROR');
    expect(String(err.message).includes('abc')).toBe(false);
  });
});
