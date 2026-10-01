import { describe, expect, it } from 'vitest';
import { buildRawEmail } from '@backend/integrations/providers/google/GmailProvider';
import { buildManager, fakeFetch } from '../support/integrationFakes';

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const decodeRaw = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8');

describe('Gmail provider (mocked API)', () => {
  it('search lists then fetches metadata and returns summaries', async () => {
    const { fetchImpl, calls } = fakeFetch((c) =>
      c.url.includes('/messages?q=')
        ? { status: 200, body: { messages: [{ id: 'm1' }] } }
        : { status: 200, body: { id: 'm1', snippet: 'hello', payload: { headers: [{ name: 'From', value: 'John <j@x.com>' }, { name: 'Subject', value: 'Internship' }, { name: 'Date', value: 'Mon' }] } } });
    const { manager } = await buildManager({ fetchImpl, connected: { gmail: ['gmail.read'] } });
    const r = await manager.execute('gmail.search', { query: 'from:john internship' });
    expect(r.summary).toContain('Found 1');
    expect((r.data as { results: Array<{ subject: string }> }).results[0]!.subject).toBe('Internship');
    expect(calls[0]!.url).toContain('q=from%3Ajohn%20internship');
    expect(calls[0]!.headers.Authorization).toBe('Bearer AT-secret');
  });

  it('read extracts the text/plain body and truncates long bodies', async () => {
    const long = 'x'.repeat(9000);
    const { fetchImpl } = fakeFetch(() => ({ status: 200, body: { id: 'm1', payload: { headers: [{ name: 'Subject', value: 'S' }], mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/html', body: { data: b64('<b>no</b>') } }, { mimeType: 'text/plain', body: { data: b64(long) } }] } } }));
    const { manager } = await buildManager({ fetchImpl, connected: { gmail: ['gmail.read'] } });
    const r = await manager.execute('gmail.read', { messageId: 'm1' });
    const body = (r.data as { body: string }).body;
    expect(body.endsWith('[truncated]')).toBe(true);
    expect(body.includes('<b>')).toBe(false);
  });

  it('rejects malformed message ids before any network call', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const { manager } = await buildManager({ fetchImpl, connected: { gmail: ['gmail.read'] } });
    await expect(manager.execute('gmail.read', { messageId: '../../etc' })).rejects.toMatchObject({ integrationCode: 'INVALID_REQUEST' });
    expect(calls.length).toBe(0);
  });

  it('send: builds a valid RFC822 message and POSTs it once', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: { id: 'sent' } }));
    const { manager } = await buildManager({ fetchImpl, connected: { gmail: ['gmail.read', 'gmail.send'] } });
    const r = await manager.execute('gmail.send', { to: 'john@example.com', subject: 'Tomorrow', body: 'I will attend tomorrow.' });
    expect(r.summary).toContain('john@example.com');
    expect(calls.length).toBe(1);
    expect(calls[0]!.method).toBe('POST');
    const mime = decodeRaw(JSON.parse(calls[0]!.body!).raw);
    expect(mime).toContain('To: john@example.com');
    expect(mime).toContain('Subject: Tomorrow');
  });

  it('send safety: rejects header injection, bad recipients, multiple recipients, empty content', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const { manager } = await buildManager({ fetchImpl, connected: { gmail: ['gmail.send'] } });
    const bad = [
      { to: 'a@b.com', subject: 'Hi\r\nBcc: evil@x.com', body: 'x' },
      { to: 'a@b.com\r\nBcc: evil@x.com', subject: 'Hi', body: 'x' },
      { to: 'a@b.com, c@d.com', subject: 'Hi', body: 'x' },
      { to: 'not-an-email', subject: 'Hi', body: 'x' },
      { to: 'a@b.com', subject: '', body: 'x' },
    ];
    for (const params of bad) {
      await expect(manager.execute('gmail.send', params)).rejects.toMatchObject({ integrationCode: 'INVALID_REQUEST' });
    }
    expect(calls.length).toBe(0);
  });

  it('encodes non-ASCII subjects', () => {
    const mime = decodeRaw(buildRawEmail('a@b.com', 'Habari ya asubuhi — ✓', 'x'));
    expect(mime).toContain('=?UTF-8?B?');
  });

  it('read-only grant cannot send (capability enforcement)', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const { manager } = await buildManager({ fetchImpl, connected: { gmail: ['gmail.read'] } });
    await expect(manager.execute('gmail.send', { to: 'a@b.com', subject: 's', body: 'b' })).rejects.toMatchObject({ integrationCode: 'PERMISSION_DENIED' });
    expect(calls.length).toBe(0);
  });

  it('refreshes once on API 401 then succeeds', async () => {
    let api = 0;
    const { fetchImpl, calls } = fakeFetch((c) => {
      if (c.url.includes('oauth2.googleapis.com/token')) return { status: 200, body: { access_token: 'AT2', expires_in: 3600 } };
      return ++api === 1 ? { status: 401 } : { status: 200, body: { messages: [] } };
    });
    const { manager } = await buildManager({ fetchImpl, connected: { gmail: ['gmail.read'] } });
    const r = await manager.execute('gmail.search', { query: 'x' });
    expect(r.summary).toContain('No emails');
    expect(calls.some((c) => c.headers.Authorization === 'Bearer AT2')).toBe(true);
  });
});
