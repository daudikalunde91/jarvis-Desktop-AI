import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ipcClient } from '@frontend/ipc/ipcClient';
import { useAppStore } from '@frontend/store/appStore';
import { IntegrationsPanel } from '@frontend/components/IntegrationsPanel';

interface BrainResult {
  reply?: string;
  source?: string;
  intent?: { name?: string; language?: string; confidence?: number };
  execution?: { outcomes?: Array<{ status?: string; message?: string }> } | null;
}

type OrbState = 'standby' | 'processing' | 'error';
const quickCommands = ['Habari JARVIS', 'Saa ngapi?', 'System info', 'Fungua VS Code'];

function Orb({ state }: { state: OrbState }) {
  const status = state === 'processing' ? 'PROCESSING' : state === 'error' ? 'ATTENTION' : 'STANDING BY';
  return <div className={`orb-wrap orb-wrap--${state}`} aria-label={`JARVIS ${status.toLowerCase()}`}>
    <span className="orb-orbit orb-orbit--outer" /><span className="orb-orbit orb-orbit--inner" />
    <span className="orb-signal orb-signal--one" /><span className="orb-signal orb-signal--two" />
    <div className="orb-core"><div className="orb-grid" /><div className="orb-pupil"><span /></div><div className="orb-equator" /></div>
    <div className="orb-wave" aria-hidden="true">{Array.from({ length: 19 }, (_, index) => <i key={index} />)}</div>
    <p className="orb-status"><span className="status-dot" /> {status}</p>
  </div>;
}

export function App() {
  const { status, appInfo, error, setStatus, setAppInfo, setError } = useAppStore();
  const [command, setCommand] = useState('');
  const [result, setResult] = useState<BrainResult | null>(null);
  const [health, setHealth] = useState('unknown');
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    async function connect() {
      setStatus('connecting');
      try {
        const [, info, moduleHealth] = await Promise.all([ipcClient.ping(), ipcClient.getAppInfo(), ipcClient.getHealth()]);
        if (!cancelled) { setAppInfo(info); setHealth(String(moduleHealth)); setStatus('connected'); }
      } catch (err) { if (!cancelled) { setError(err instanceof Error ? err.message : 'Backend is still starting'); setStatus('error'); retryTimer = window.setTimeout(() => void connect(), 1500); } }
    }
    void connect(); return () => { cancelled = true; if (retryTimer !== undefined) window.clearTimeout(retryTimer); };
  }, [setStatus, setAppInfo, setError]);

  async function sendCommand(utterance: string) {
    if (!utterance || busy) return;
    setBusy(true); setError(null);
    try { const response = (await ipcClient.handleBrain(utterance)) as BrainResult; setResult(response); setCommand(''); setHealth(String(await ipcClient.getHealth())); }
    catch (err) { setError(err instanceof Error ? err.message : 'Brain request failed'); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void sendCommand(command.trim()); }

  const orbState: OrbState = error ? 'error' : busy ? 'processing' : 'standby';
  const systemState = status === 'connected' ? 'ONLINE' : status === 'error' ? 'OFFLINE' : 'LINKING';
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(clock);

  return <main className="jarvis-shell">
    <div className="scanlines" aria-hidden="true" />
    <header className="hud-header">
      <div className="brand"><span className="brand-mark">J</span><div><strong>{appInfo?.name ?? 'JARVIS'}</strong><small>PERSONAL INTELLIGENCE SYSTEM</small></div></div>
      <div className="header-center"><span>CORE // {systemState}</span><b>{time}</b></div>
      <div className="header-date"><b>{clock.toLocaleDateString('en-GB', { day: '2-digit' })}</b><span>{clock.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()}</span></div>
    </header>
    <section className="hud-layout">
      <aside className="hud-column hud-column--left">
        <section className="hud-panel identity-panel"><span className="panel-kicker">OPERATOR PROFILE</span><div className="avatar-ring">JD</div><b>DAUDI</b><small>AUTHORISED OPERATOR</small><div className="panel-rule" /><div className="metric-line"><span>SESSION</span><b>DESKTOP</b></div><div className="metric-line"><span>SECURITY</span><b className="cyan">READY</b></div></section>
        <section className="hud-panel"><span className="panel-kicker">SYSTEM TELEMETRY</span><div className="telemetry"><span>IPC LINK</span><b className={status === 'connected' ? 'cyan' : ''}>{systemState}</b></div><div className="meter"><i style={{ width: status === 'connected' ? '92%' : '22%' }} /></div><div className="telemetry"><span>BRAIN</span><b>{health.toUpperCase()}</b></div><div className="meter"><i style={{ width: health === 'healthy' ? '86%' : '54%' }} /></div><div className="telemetry"><span>MEMORY</span><b>STANDBY</b></div><div className="meter"><i style={{ width: '40%' }} /></div></section>
        <section className="hud-panel command-log"><span className="panel-kicker">LAST RESPONSE</span><p>{result?.reply ?? 'Awaiting your command.'}</p></section>
      </aside>
      <section className="command-deck">
        <p className="deck-caption">NEURAL COMMAND INTERFACE</p><Orb state={orbState} />
        <div className="response-card" aria-live="polite"><span>{busy ? 'JARVIS IS ANALYSING' : result ? 'COMMAND RESULT' : 'READY FOR INPUT'}</span><p>{busy ? 'Processing through the Brain → Planner → Permission → Agent pipeline…' : result?.reply ?? 'Type or select a command to begin.'}</p>{result?.intent?.name && <small>INTENT: {result.intent.name} · {result.intent.language ?? 'unknown'}</small>}</div>
        <form onSubmit={submit} className="command-form"><label htmlFor="jarvis-command">COMMAND</label><div><span className="prompt">›</span><input id="jarvis-command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Andika amri yako kwa Kiswahili au English…" disabled={busy} autoFocus /><button type="submit" disabled={busy || !command.trim()}>SEND</button></div></form>
        <div className="quick-commands">{quickCommands.map((item) => <button key={item} type="button" onClick={() => void sendCommand(item)} disabled={busy}>{item}</button>)}</div>
      </section>
      <aside className="hud-column hud-column--right">
        <section className="hud-panel"><span className="panel-kicker">AGENT MATRIX</span><div className="agent-row"><span className="agent-pulse" />BRAIN <b>{health.toUpperCase()}</b></div><div className="agent-row"><span className="agent-pulse" />SYSTEM <b>READY</b></div><div className="agent-row"><span className="agent-pulse muted" />VISION <b>PLANNED</b></div><div className="agent-row"><span className="agent-pulse muted" />VOICE <b>STANDBY</b></div></section>
        <IntegrationsPanel />
        <section className="hud-panel radar-panel"><span className="panel-kicker">ACTIVITY RADAR</span><div className="radar"><i /><i /><i /><b /></div><p>Secure local command routing enabled.</p></section>
        <section className="hud-panel"><span className="panel-kicker">VISION PIPELINE</span><ol className="pipeline"><li>Screen capture</li><li>OCR & UI detection</li><li>Context analysis</li><li>Approved action</li></ol><small className="privacy">◉ USER-CONTROLLED · OFF</small></section>
      </aside>
    </section>
    {error && <div className="error-banner" role="alert">CONNECTION ERROR · {error}</div>}
    <footer><span>JARVIS OS // SECURE LOCAL SESSION</span><span>VOICE + VISION READY ARCHITECTURE</span></footer>
  </main>;
}
