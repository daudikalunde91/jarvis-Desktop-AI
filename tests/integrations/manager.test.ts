import { describe, expect, it } from 'vitest';
import { buildManager, fakeFetch } from '../support/integrationFakes';
import { IntegrationAgent } from '@backend/integrations/IntegrationAgent';
import { logger } from '../support/integrationFakes';

const never = fakeFetch(() => ({ status: 200, body: {} }));

describe('IntegrationManager', () => {
  it('reports MISSING / DISABLED configuration honestly', async () => {
    const missing = await buildManager({ fetchImpl: never.fetchImpl, configured: false });
    expect((await missing.manager.getStatus('gmail')).configuration).toBe('MISSING');
    const disabled = await buildManager({ fetchImpl: never.fetchImpl, enabled: false });
    expect((await disabled.manager.getStatus('gmail')).configuration).toBe('DISABLED');
  });

  it('not connected => AUTH_REQUIRED and no network call', async () => {
    const f = fakeFetch(() => ({ status: 200, body: {} }));
    const { manager } = await buildManager({ fetchImpl: f.fetchImpl });
    await expect(manager.execute('gmail.search', { query: 'x' })).rejects.toMatchObject({ integrationCode: 'AUTH_REQUIRED' });
    expect(f.calls.length).toBe(0);
  });

  it('not configured => INVALID_CONFIGURATION', async () => {
    const { manager } = await buildManager({ fetchImpl: never.fetchImpl, configured: false });
    await expect(manager.execute('gmail.search', { query: 'x' })).rejects.toMatchObject({ integrationCode: 'INVALID_CONFIGURATION' });
  });

  it('status exposes capabilities only — no tokens anywhere in the serialized status', async () => {
    const { manager } = await buildManager({ fetchImpl: never.fetchImpl, connected: { gmail: ['gmail.read'] } });
    const json = JSON.stringify(await manager.getAllStatuses());
    expect(json.includes('AT-secret')).toBe(false);
    expect(json.includes('RT-secret')).toBe(false);
    expect(json.toLowerCase().includes('token')).toBe(false);
    const gmail = (await manager.getStatus('gmail'));
    expect(gmail.authorization).toBe('CONNECTED');
    expect(gmail.grantedCapabilities).toEqual(['gmail.read']);
  });

  it('connect validates requested capabilities (least privilege, no unknown/foreign caps)', async () => {
    const { manager } = await buildManager({ fetchImpl: never.fetchImpl });
    await expect(manager.connect('gmail', [])).rejects.toMatchObject({ integrationCode: 'INVALID_REQUEST' });
    await expect(manager.connect('gmail', ['calendar.read'])).rejects.toMatchObject({ integrationCode: 'INVALID_REQUEST' });
  });

  it('disconnect deletes credentials and grants', async () => {
    const f = fakeFetch(() => ({ status: 200, body: {} }));
    const { manager, store } = await buildManager({ fetchImpl: f.fetchImpl, connected: { gmail: ['gmail.read'] } });
    const status = await manager.disconnect('gmail');
    expect(await store.has('google:gmail')).toBe(false);
    expect(status.authorization).toBe('NOT_CONNECTED');
    expect(status.grantedCapabilities).toEqual([]);
    expect(f.calls.some((c) => c.url.includes('/revoke'))).toBe(true);
    await expect(manager.execute('gmail.search', { query: 'x' })).rejects.toMatchObject({ integrationCode: 'AUTH_REQUIRED' });
  });

  it('healthCheck reports HEALTHY / ERROR from a real provider call', async () => {
    const ok = await buildManager({ fetchImpl: fakeFetch(() => ({ status: 200, body: {} })).fetchImpl, connected: { gmail: ['gmail.read'] } });
    expect(await ok.manager.checkHealth('gmail')).toBe('HEALTHY');
    const bad = await buildManager({ fetchImpl: fakeFetch(() => ({ status: 403 })).fetchImpl, connected: { gmail: ['gmail.read'] } });
    expect(await bad.manager.checkHealth('gmail')).toBe('ERROR');
  });

  it('provider failures surface as normalized codes with safe messages', async () => {
    const f = fakeFetch(() => ({ status: 403, body: { error: { message: 'ya29.LEAK' } } }));
    const { manager } = await buildManager({ fetchImpl: f.fetchImpl, connected: { gmail: ['gmail.read'] } });
    const err = await manager.execute('gmail.search', { query: 'x' }).catch((e) => e);
    expect(err.integrationCode).toBe('PERMISSION_DENIED');
    expect(String(err.message).includes('LEAK')).toBe(false);
  });
});

describe('IntegrationAgent', () => {
  it('returns a machine-readable code instead of inventing results when disconnected', async () => {
    const { manager } = await buildManager({ fetchImpl: never.fetchImpl });
    const agent = new IntegrationAgent(logger, manager);
    expect(agent.actions).toContain('gmail.search');
    expect(agent.actions).toContain('calendar.delete_event');
    const res = await agent.execute({ action: 'gmail.search', params: { query: 'x' } });
    expect(res.ok).toBe(false);
    expect((res.data as { code: string }).code).toBe('AUTH_REQUIRED');
    expect(res.message).toContain('not connected');
  });
});
