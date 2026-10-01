import { IntegrationError } from '@backend/integrations/errors';
import { GoogleProviderBase } from '@backend/integrations/providers/google/GoogleProviderBase';
import type { IntegrationOperation, IntegrationOperationResult } from '@backend/integrations/types';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_RESULTS = 15;
const MAX_BODY_CHARS = 8000;
/** RFC 5322-ish, deliberately strict. Rejects CR/LF (header injection). */
const EMAIL_RE = /^[^\s<>@,;"'\\]+@[^\s<>@,;"'\\]+\.[^\s<>@,;"'\\]+$/;

interface GmailHeader { name: string; value: string }
interface GmailPart { mimeType?: string; body?: { data?: string }; parts?: GmailPart[]; headers?: GmailHeader[] }
interface GmailMessage { id: string; threadId?: string; snippet?: string; payload?: GmailPart }

const header = (m: GmailMessage, name: string): string =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

function extractText(part: GmailPart | undefined): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf8');
  }
  for (const child of part.parts ?? []) {
    const text = extractText(child);
    if (text) return text;
  }
  return '';
}

/** Encode a header value that may contain non-ASCII characters. */
const encodeHeader = (v: string): string =>
  /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;

export function buildRawEmail(to: string, subject: string, body: string): string {
  const mime = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64url');
}

export class GmailProvider extends GoogleProviderBase {
  readonly id = 'gmail' as const;
  readonly name = 'Gmail';
  readonly implementation = 'PARTIAL' as const; // real API client; not yet exercised against live API
  protected readonly scopeMap = {
    'gmail.read': 'https://www.googleapis.com/auth/gmail.readonly',
    'gmail.send': 'https://www.googleapis.com/auth/gmail.send',
  } as const;

  protected healthUrl(): string {
    return `${BASE}/profile`;
  }

  readonly operations: readonly IntegrationOperation[] = [
    { name: 'search', capability: 'gmail.read', run: (p) => this.search(p) },
    { name: 'read', capability: 'gmail.read', run: (p) => this.read(p) },
    { name: 'send', capability: 'gmail.send', run: (p) => this.send(p) },
  ];

  private async search(params: Record<string, unknown>): Promise<IntegrationOperationResult> {
    const query = typeof params.query === 'string' ? params.query.trim() : '';
    if (!query) throw new IntegrationError('INVALID_REQUEST', 'A search query is required.');
    const requested = Number(params.maxResults ?? 5);
    const max = Math.min(Math.max(Number.isFinite(requested) ? Math.floor(requested) : 5, 1), MAX_RESULTS);

    const list = await this.api<{ messages?: { id: string }[] }>(
      `${BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
    );
    const ids = (list?.messages ?? []).map((m) => m.id);
    const messages = await Promise.all(
      ids.map((id) =>
        this.api<GmailMessage>(
          `${BASE}/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        ),
      ),
    );
    const results = messages
      .filter((m): m is GmailMessage => !!m)
      .map((m) => ({ id: m.id, from: header(m, 'From'), subject: header(m, 'Subject'), date: header(m, 'Date'), snippet: m.snippet ?? '' }));
    return {
      summary: results.length ? `Found ${results.length} email(s) matching "${query}".` : `No emails matched "${query}".`,
      data: { results },
    };
  }

  private async read(params: Record<string, unknown>): Promise<IntegrationOperationResult> {
    const id = typeof params.messageId === 'string' ? params.messageId.trim() : '';
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new IntegrationError('INVALID_REQUEST', 'A valid messageId is required.');
    const m = await this.api<GmailMessage>(`${BASE}/messages/${id}?format=full`);
    if (!m) throw new IntegrationError('NOT_FOUND');
    const text = extractText(m.payload);
    const body = text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}\n[truncated]` : text;
    return {
      summary: `Read the email "${header(m, 'Subject') || '(no subject)'}" from ${header(m, 'From') || 'unknown sender'}.`,
      data: { id: m.id, from: header(m, 'From'), to: header(m, 'To'), subject: header(m, 'Subject'), date: header(m, 'Date'), body },
    };
  }

  private async send(params: Record<string, unknown>): Promise<IntegrationOperationResult> {
    const to = typeof params.to === 'string' ? params.to.trim() : '';
    const subject = typeof params.subject === 'string' ? params.subject : '';
    const body = typeof params.body === 'string' ? params.body : '';
    if (!EMAIL_RE.test(to)) throw new IntegrationError('INVALID_REQUEST', 'A single valid recipient email address is required.');
    if (/[\r\n]/.test(subject)) throw new IntegrationError('INVALID_REQUEST', 'The subject must be a single line.');
    if (!subject.trim() || !body.trim()) throw new IntegrationError('INVALID_REQUEST', 'Both a subject and a body are required.');

    // POST is never auto-retried on 5xx by the HTTP client (could duplicate a send).
    await this.api(`${BASE}/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: buildRawEmail(to, subject, body) }),
    });
    return { summary: `Email sent to ${to}.` };
  }
}
