import { describe, expect, it } from 'vitest';
import { buildManager, fakeFetch } from '../support/integrationFakes';

describe('Google Calendar provider (mocked API)', () => {
  it('lists upcoming events with a bounded query', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: { items: [{ id: 'e1', summary: 'Standup', start: { dateTime: '2026-10-02T10:00:00+03:00' }, end: { dateTime: '2026-10-02T10:30:00+03:00' } }] } }));
    const { manager } = await buildManager({ fetchImpl, connected: { calendar: ['calendar.read'] } });
    const r = await manager.execute('calendar.list_events', { maxResults: 999 });
    expect((r.data as { events: Array<{ summary: string }> }).events[0]!.summary).toBe('Standup');
    expect(calls[0]!.url).toContain('maxResults=25');
    expect(calls[0]!.url).toContain('singleEvents=true');
  });

  it('search requires a query and passes q', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: { items: [] } }));
    const { manager } = await buildManager({ fetchImpl, connected: { calendar: ['calendar.read'] } });
    await expect(manager.execute('calendar.search_events', {})).rejects.toMatchObject({ integrationCode: 'INVALID_REQUEST' });
    await manager.execute('calendar.search_events', { query: 'dentist' });
    expect(calls[0]!.url).toContain('q=dentist');
  });

  it('create validates times and posts the event', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: { id: 'e9', summary: 'Meeting' } }));
    const { manager } = await buildManager({ fetchImpl, connected: { calendar: ['calendar.read', 'calendar.create'] } });
    await expect(manager.execute('calendar.create_event', { summary: 'M', start: 'garbage', end: 'x' })).rejects.toMatchObject({ integrationCode: 'INVALID_REQUEST' });
    await expect(manager.execute('calendar.create_event', { summary: 'M', start: '2026-10-02T11:00:00Z', end: '2026-10-02T10:00:00Z' })).rejects.toMatchObject({ integrationCode: 'INVALID_REQUEST' });
    expect(calls.length).toBe(0);
    await manager.execute('calendar.create_event', { summary: 'Meeting', start: '2026-10-02T10:00:00+03:00', end: '2026-10-02T11:00:00+03:00', timeZone: 'Africa/Dar_es_Salaam' });
    expect(calls[0]!.method).toBe('POST');
    expect(JSON.parse(calls[0]!.body!).start.timeZone).toBe('Africa/Dar_es_Salaam');
  });

  it('delete is blocked without the calendar.delete grant, and handles empty 204 bodies when granted', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 204 }));
    const a = await buildManager({ fetchImpl, connected: { calendar: ['calendar.read', 'calendar.create'] } });
    await expect(a.manager.execute('calendar.delete_event', { eventId: 'e1' })).rejects.toMatchObject({ integrationCode: 'PERMISSION_DENIED' });
    expect(calls.length).toBe(0);
    const b = await buildManager({ fetchImpl, connected: { calendar: ['calendar.delete'] } });
    const r = await b.manager.execute('calendar.delete_event', { eventId: 'e1' });
    expect(r.summary).toContain('Deleted');
    expect(calls[0]!.method).toBe('DELETE');
  });

  it('rejects event ids that could alter the request path', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const { manager } = await buildManager({ fetchImpl, connected: { calendar: ['calendar.update'] } });
    await expect(manager.execute('calendar.update_event', { eventId: '../calendarList', summary: 'x' })).rejects.toMatchObject({ integrationCode: 'INVALID_REQUEST' });
    expect(calls.length).toBe(0);
  });
});
