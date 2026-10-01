import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PermissionManager } from '@backend/security/PermissionManager';
import { AI_TOOL_MAPPINGS } from '@backend/ai/tools/ToolDefinitions';
import { ToolRegistry } from '@backend/ai/tools/ToolRegistry';
import { ActionAgentRegistry } from '@backend/agents/ActionAgentRegistry';
import { describeIntegrationAction } from '@backend/integrations/confirmationPreview';
import { INTEGRATION_ACTION_POLICIES } from '@backend/integrations/capabilities';
import { IntegrationAgent } from '@backend/integrations/IntegrationAgent';
import { buildManager, fakeFetch, logger } from '../support/integrationFakes';

const root = path.resolve(__dirname, '..', '..');

describe('Permission policy for integrations', () => {
  const pm = new PermissionManager(logger, 'user');

  it('read-only actions need no confirmation; external send / writes / deletes do', () => {
    expect(pm.evaluate('gmail.search').allowed).toBe(true);
    expect(pm.evaluate('calendar.list_events').allowed).toBe(true);
    expect(pm.evaluate('gmail.send').requiresConfirmation).toBe(true);
    expect(pm.evaluate('gmail.send').allowed).toBe(false);
    expect(pm.evaluate('gmail.send', { confirmed: true }).allowed).toBe(true);
    expect(pm.evaluate('calendar.create_event').allowed).toBe(false);
    expect(pm.evaluate('calendar.delete_event').allowed).toBe(false);
  });

  it('every integration tool has an explicit policy (nothing falls to the unknown default)', () => {
    const policyActions = new Set(INTEGRATION_ACTION_POLICIES.map((p) => p.action));
    for (const m of AI_TOOL_MAPPINGS.filter((t) => /^(gmail|calendar)\./.test(t.agentAction))) {
      expect(policyActions.has(m.agentAction)).toBe(true);
      const needsConfirm = pm.getPolicy(m.agentAction).risk !== 'low';
      expect(m.definition.requiresConfirmation).toBe(needsConfirm);
    }
  });
});

describe('ToolRegistry + integrations', () => {
  async function registry() {
    const f = fakeFetch(() => ({ status: 200, body: { id: 'sent' } }));
    const { manager } = await buildManager({ fetchImpl: f.fetchImpl, connected: { gmail: ['gmail.read', 'gmail.send'] } });
    const agents = new ActionAgentRegistry(logger);
    agents.register(new IntegrationAgent(logger, manager));
    return { reg: new ToolRegistry(logger, agents, new PermissionManager(logger, 'user')), f };
  }

  it('gmail.send is held for confirmation with an Action/Target/Content preview and does NOT call the API', async () => {
    const { reg, f } = await registry();
    const r = await reg.execute({ id: '1', name: 'gmail.send', arguments: { to: 'john@example.com', subject: 'Tomorrow', body: 'I will attend.' } }, { sessionId: 's' });
    expect(r.status).toBe('awaiting-confirmation');
    expect(r.content).toContain('Action: Send email');
    expect(r.content).toContain('Target: john@example.com');
    expect(f.calls.length).toBe(0);
  });

  it('runs only after explicit confirmation', async () => {
    const { reg, f } = await registry();
    const r = await reg.execute({ id: '1', name: 'gmail.send', arguments: { to: 'john@example.com', subject: 'Tomorrow', body: 'I will attend.' } }, { sessionId: 's', confirmed: true });
    expect(r.status).toBe('completed');
    expect(f.calls.length).toBe(1);
  });

  it('read tools run without confirmation', async () => {
    const { reg } = await registry();
    const r = await reg.execute({ id: '2', name: 'gmail.search', arguments: { query: 'x' } }, { sessionId: 's' });
    expect(r.status).toBe('completed');
  });

  it('previews exist for every confirmable integration action', () => {
    for (const a of ['gmail.send', 'calendar.create_event', 'calendar.update_event', 'calendar.delete_event']) {
      expect(describeIntegrationAction(a, { to: 'a@b.c', eventId: 'e1', summary: 's' })!.startsWith('Action:')).toBe(true);
    }
    expect(describeIntegrationAction('gmail.search')).toBeNull();
  });

  it('connect/disconnect are not AI tools', () => {
    const names = AI_TOOL_MAPPINGS.map((m) => m.definition.name);
    expect(names.some((n) => /connect|disconnect|oauth|token|credential/i.test(n))).toBe(false);
  });
});

describe('IPC / preload security', () => {
  const preload = fs.readFileSync(path.join(root, 'app/backend/src/preload.cjs'), 'utf8');
  const preloadTs = fs.readFileSync(path.join(root, 'app/backend/src/preload.ts'), 'utf8');

  it('preload exposes only fixed channels and no token/secret/credential accessors', () => {
    for (const src of [preload, preloadTs]) {
      expect(/getToken|accessToken|refreshToken|clientSecret|getCredential|readFile|require\(['"]fs/i.test(src)).toBe(false);
      expect(src.includes("'integrations:get-status'")).toBe(true);
    }
  });

  it('preload keeps the voice architecture: no microphone / click-to-speak bridge', () => {
    expect(/microphone|startListening|clickToSpeak|getUserMedia/i.test(preload)).toBe(false);
  });

  it('frontend has no microphone button', () => {
    const files = ['app/frontend/src/App.tsx', 'app/frontend/src/components/IntegrationsPanel.tsx'];
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      expect(/mic(rophone)?[-_ ]?(button|btn)|🎤|getUserMedia/i.test(src)).toBe(false);
    }
  });

  it('secrets never reach the renderer config: env secrets are not part of AppConfig', () => {
    const cfg = fs.readFileSync(path.join(root, 'app/backend/src/config/default.config.ts'), 'utf8');
    expect(/googleClient|GOOGLE_CLIENT/i.test(cfg)).toBe(false);
  });

  it('no secrets committed: .env.example has no values for secret names; .gitignore ignores .env', () => {
    const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
    for (const line of env.split(/\r?\n/)) {
      const m = /^(GOOGLE_CLIENT_SECRET|GOOGLE_CLIENT_ID|WHATSAPP_ACCESS_TOKEN|MICROSOFT_CLIENT_SECRET)=(.*)$/.exec(line);
      if (m) expect(m[2]).toBe('');
    }
    expect(/^\.env$/m.test(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'))).toBe(true);
  });
});
