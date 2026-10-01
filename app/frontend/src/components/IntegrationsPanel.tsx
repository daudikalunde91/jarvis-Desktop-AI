import { useCallback, useEffect, useState } from 'react';
import { ipcClient } from '@frontend/ipc/ipcClient';

interface IntegrationStatus {
  id: string;
  name: string;
  implementation: string;
  configuration: 'READY' | 'MISSING' | 'DISABLED';
  authorization: 'CONNECTED' | 'NOT_CONNECTED' | 'EXPIRED';
  health: string;
  grantedCapabilities: string[];
  availableCapabilities: string[];
}

/** Status-only view. Never receives or renders tokens, secrets or account data. */
export function IntegrationsPanel() {
  const [items, setItems] = useState<IntegrationStatus[]>([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems((await ipcClient.getIntegrationStatus()) as IntegrationStatus[]);
    } catch {
      setMessage('Integration status unavailable.');
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const label = (s: IntegrationStatus) =>
    s.configuration === 'DISABLED' ? 'Disabled' : s.configuration === 'MISSING' ? 'Not configured'
    : s.authorization === 'CONNECTED' ? 'Connected' : s.authorization === 'EXPIRED' ? 'Reconnect needed' : 'Not connected';

  async function connect(s: IntegrationStatus, includeWrite: boolean) {
    setBusyId(s.id); setMessage('');
    const capabilities = s.availableCapabilities.filter((c) => includeWrite || c.endsWith('.read'));
    const res = (await ipcClient.connectIntegration({ id: s.id, capabilities })) as { ok: boolean; code?: string };
    setMessage(res.ok ? `${s.name} connected.` : `${s.name}: ${res.code ?? 'failed'}`);
    setBusyId(null); await refresh();
  }
  async function disconnect(s: IntegrationStatus) {
    setBusyId(s.id);
    const res = (await ipcClient.disconnectIntegration({ id: s.id })) as { ok: boolean; code?: string };
    setMessage(res.ok ? `${s.name} disconnected.` : `${s.name}: ${res.code ?? 'failed'}`);
    setBusyId(null); await refresh();
  }

  return <section className="hud-panel">
    <span className="panel-kicker">INTEGRATIONS</span>
    {items.map((s) => <div key={s.id} className="agent-row">
      <span className={`agent-pulse ${s.authorization === 'CONNECTED' ? '' : 'muted'}`} />{s.name.toUpperCase()} <b>{label(s)}</b>
      {s.configuration === 'READY' && s.authorization !== 'CONNECTED' && <>
        <button type="button" disabled={busyId === s.id} onClick={() => void connect(s, false)}>READ ONLY</button>
        <button type="button" disabled={busyId === s.id} onClick={() => void connect(s, true)}>+ WRITE</button>
      </>}
      {s.authorization !== 'NOT_CONNECTED' && s.configuration === 'READY' && <button type="button" disabled={busyId === s.id} onClick={() => void disconnect(s)}>DISCONNECT</button>}
    </div>)}
    {message && <small className="privacy">{message}</small>}
  </section>;
}
