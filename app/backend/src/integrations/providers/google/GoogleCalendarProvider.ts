import { IntegrationError } from '@backend/integrations/errors';
import { GoogleProviderBase } from '@backend/integrations/providers/google/GoogleProviderBase';
import type { IntegrationOperation, IntegrationOperationResult } from '@backend/integrations/types';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary';
const MAX_RESULTS = 25;

interface CalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

const brief = (e: CalEvent) => ({
  id: e.id,
  summary: e.summary ?? '(no title)',
  start: e.start?.dateTime ?? e.start?.date ?? '',
  end: e.end?.dateTime ?? e.end?.date ?? '',
  location: e.location ?? '',
});

function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new IntegrationError('INVALID_REQUEST', `"${field}" must be an ISO 8601 date-time.`);
  }
  return value;
}
function eventId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new IntegrationError('INVALID_REQUEST', 'A valid eventId is required.');
  return value;
}

export class GoogleCalendarProvider extends GoogleProviderBase {
  readonly id = 'calendar' as const;
  readonly name = 'Google Calendar';
  readonly implementation = 'PARTIAL' as const;
  /**
   * Google only offers read-only vs read/write event scopes, so create/update/delete
   * share one scope. JARVIS enforces the finer capability split locally.
   */
  protected readonly scopeMap = {
    'calendar.read': 'https://www.googleapis.com/auth/calendar.events.readonly',
    'calendar.create': 'https://www.googleapis.com/auth/calendar.events',
    'calendar.update': 'https://www.googleapis.com/auth/calendar.events',
    'calendar.delete': 'https://www.googleapis.com/auth/calendar.events',
  } as const;

  protected healthUrl(): string {
    return `${BASE}/events?maxResults=1`;
  }

  readonly operations: readonly IntegrationOperation[] = [
    { name: 'list_events', capability: 'calendar.read', run: (p) => this.list(p, false) },
    { name: 'search_events', capability: 'calendar.read', run: (p) => this.list(p, true) },
    { name: 'create_event', capability: 'calendar.create', run: (p) => this.create(p) },
    { name: 'update_event', capability: 'calendar.update', run: (p) => this.update(p) },
    { name: 'delete_event', capability: 'calendar.delete', run: (p) => this.remove(p) },
  ];

  private async list(params: Record<string, unknown>, search: boolean): Promise<IntegrationOperationResult> {
    const timeMin = params.timeMin ? isoDate(params.timeMin, 'timeMin') : new Date().toISOString();
    const timeMax = params.timeMax ? isoDate(params.timeMax, 'timeMax') : new Date(Date.now() + 7 * 86_400_000).toISOString();
    const requested = Number(params.maxResults ?? 10);
    const max = Math.min(Math.max(Number.isFinite(requested) ? Math.floor(requested) : 10, 1), MAX_RESULTS);
    const q = search ? (typeof params.query === 'string' ? params.query.trim() : '') : '';
    if (search && !q) throw new IntegrationError('INVALID_REQUEST', 'A search query is required.');

    const url =
      `${BASE}/events?singleEvents=true&orderBy=startTime&maxResults=${max}` +
      `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
      (q ? `&q=${encodeURIComponent(q)}` : '');
    const res = await this.api<{ items?: CalEvent[] }>(url);
    const events = (res?.items ?? []).map(brief);
    return {
      summary: events.length ? `Found ${events.length} event(s).` : 'No events found in that time range.',
      data: { events },
    };
  }

  private async create(params: Record<string, unknown>): Promise<IntegrationOperationResult> {
    const summary = typeof params.summary === 'string' ? params.summary.trim() : '';
    if (!summary) throw new IntegrationError('INVALID_REQUEST', 'An event title (summary) is required.');
    const start = isoDate(params.start, 'start');
    const end = isoDate(params.end, 'end');
    if (Date.parse(end) <= Date.parse(start)) throw new IntegrationError('INVALID_REQUEST', 'The event must end after it starts.');
    const timeZone = typeof params.timeZone === 'string' ? params.timeZone : undefined;
    const created = await this.api<CalEvent>(`${BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        description: typeof params.description === 'string' ? params.description : undefined,
        location: typeof params.location === 'string' ? params.location : undefined,
        start: { dateTime: start, timeZone },
        end: { dateTime: end, timeZone },
      }),
    });
    return { summary: `Created the event "${summary}".`, data: { event: created ? brief(created) : null } };
  }

  private async update(params: Record<string, unknown>): Promise<IntegrationOperationResult> {
    const id = eventId(params.eventId);
    const patch: Record<string, unknown> = {};
    if (typeof params.summary === 'string') patch.summary = params.summary;
    if (typeof params.description === 'string') patch.description = params.description;
    if (typeof params.location === 'string') patch.location = params.location;
    const timeZone = typeof params.timeZone === 'string' ? params.timeZone : undefined;
    if (params.start) patch.start = { dateTime: isoDate(params.start, 'start'), timeZone };
    if (params.end) patch.end = { dateTime: isoDate(params.end, 'end'), timeZone };
    if (Object.keys(patch).length === 0) throw new IntegrationError('INVALID_REQUEST', 'Nothing to update.');
    const updated = await this.api<CalEvent>(`${BASE}/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return { summary: 'Updated the event.', data: { event: updated ? brief(updated) : null } };
  }

  private async remove(params: Record<string, unknown>): Promise<IntegrationOperationResult> {
    const id = eventId(params.eventId);
    await this.api(`${BASE}/events/${id}`, { method: 'DELETE' });
    return { summary: 'Deleted the event.' };
  }
}
