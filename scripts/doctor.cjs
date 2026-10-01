const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const electronPkg = path.join(ROOT, 'node_modules', 'electron', 'package.json');
const electronExe = process.platform === 'win32'
  ? path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron');
const sqliteBinary = path.join(ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');

// --- Minimal .env loader -------------------------------------------------
// doctor.cjs previously read process.env.* directly without ever loading
// the root .env file, so it always reported AI keys as MISSING even when
// a real .env with real keys existed (the actual backend, via
// app/backend/src/core/env.ts, already loaded .env correctly — only this
// diagnostic script was blind to it). This mirrors dotenv's behaviour
// (parses KEY=VALUE lines, ignores comments/blank lines, never overwrites
// a value already present in process.env) without adding a dependency.
function loadRootEnvFile() {
  const envPath = path.join(ROOT, '.env');
  const result = { found: fs.existsSync(envPath), path: envPath };
  if (!result.found) return result;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
  return result;
}

function boolFlag(name) {
  const v = process.env[name];
  if (v === undefined) return 'not set (defaults apply)';
  return v.toLowerCase() === 'true' || v === '1' ? 'true' : 'false';
}

function file(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, shell: false, ...options });
}
function runElectron(expression) {
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
  return run(electronExe, ['-e', expression], {
    env,
    shell: false,
  });
}

function sqliteCheck() {
  const expression = [
    "try {",
    "  const Database = require('better-sqlite3');",
    "  const db = new Database(':memory:');",
    "  const row = db.prepare('SELECT 1 AS ok').get();",
    "  db.close();",
    "  process.stdout.write('JARVIS_SQLITE_OK:' + String(row.ok));",
    "} catch (e) {",
    "  process.stderr.write((e && e.stack) ? e.stack : String(e));",
    "  process.exitCode = 2;",
    "}",
  ].join(' ');
  const r = runElectron(expression);
  return {
    ok: r.status === 0 && String(r.stdout || '').trim().includes('JARVIS_SQLITE_OK:1'),
    status: r.status,
    stdout: String(r.stdout || '').trim(),
    stderr: String(r.stderr || '').trim(),
  };
}

// --- Live AI provider check (FIX: startup-debug pass, Sept 2026) --------
// Root problem this addresses: when all 3 cloud providers fail at runtime,
// JARVIS correctly told the user WHICH providers failed and with which
// error CODE (AI_RATE_LIMIT_ERROR / AI_MODEL_UNAVAILABLE_ERROR /
// AI_INVALID_REQUEST_ERROR), but not WHY — the real HTTP status and the
// provider's own error message were only ever visible if you re-ran the
// whole Electron app and watched the console. That meant every failure
// needed a full `npm run dev` cycle just to see a body you can't act on
// until you know what it says.
//
// This makes `npm run doctor -- --check-ai` (or `npm run doctor:ai`) send
// one minimal real request to every provider that is enabled + has a key,
// and print the actual status + response snippet right here — before the
// Electron window ever opens. It is opt-in (not part of the default
// `npm run doctor`) because it spends real quota/tokens and because one of
// your providers is already rate-limited; don't run it in a tight loop.
async function checkAiProviderLive(name, fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const result = await fn(controller.signal);
    console.log(`  ${name}: OK (HTTP ${result.status})`);
  } catch (err) {
    if (err && err.name === 'AbortError') {
      console.log(`  ${name}: TIMEOUT after 15s (network issue, or provider is slow right now)`);
      return;
    }
    console.log(`  ${name}: FAILED${err.status ? ` (HTTP ${err.status})` : ''}`);
    if (err.detail) console.log(`    -> ${err.detail}`);
  } finally {
    clearTimeout(timer);
  }
}

async function pingHttp(url, init, signal) {
  const response = await fetch(url, { ...init, signal });
  const bodyText = await response.text();
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.status = response.status;
    err.detail = bodyText.length > 300 ? `${bodyText.slice(0, 300)}…` : bodyText;
    throw err;
  }
  return { status: response.status, body: bodyText };
}

async function runAiLiveChecks() {
  console.log('');
  console.log('AI provider live check (real API calls, uses a small amount of quota):');

  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  if (openaiKey) {
    await checkAiProviderLive('OpenAI', (signal) =>
      pingHttp(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({ model: openaiModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
        },
        signal,
      ),
    );
  } else {
    console.log('  OpenAI: SKIPPED (no OPENAI_API_KEY)');
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  if (geminiKey) {
    await checkAiProviderLive('Gemini', (signal) =>
      pingHttp(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }),
        },
        signal,
      ),
    );
  } else {
    console.log('  Gemini: SKIPPED (no GEMINI_API_KEY)');
  }

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const claudeModel = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
  const claudeWorkspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  if (claudeKey) {
    await checkAiProviderLive('Claude', (signal) =>
      pingHttp(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
            ...(claudeWorkspaceId ? { 'anthropic-workspace-id': claudeWorkspaceId } : {}),
          },
          body: JSON.stringify({ model: claudeModel, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
        },
        signal,
      ),
    );
  } else {
    console.log('  Claude: SKIPPED (no ANTHROPIC_API_KEY)');
  }

  // --- Stage 6 / V7.2 additions -------------------------------------
  const groqKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  if (groqKey) {
    await checkAiProviderLive('Groq', (signal) =>
      pingHttp(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({ model: groqModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
        },
        signal,
      ),
    );
  } else {
    console.log('  Groq: SKIPPED (no GROQ_API_KEY)');
  }

  const lovableKey = process.env.LOVABLE_API_KEY;
  const lovableModel = process.env.LOVABLE_MODEL;
  if (lovableKey && lovableModel) {
    const lovableBaseUrl = (process.env.LOVABLE_BASE_URL || 'https://ai.gateway.lovable.dev/v1').replace(/\/$/, '');
    await checkAiProviderLive('Lovable', (signal) =>
      pingHttp(
        `${lovableBaseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lovableKey}`,
            'Lovable-API-Key': lovableKey,
          },
          body: JSON.stringify({ model: lovableModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
        },
        signal,
      ),
    );
  } else {
    console.log(`  Lovable: SKIPPED (${!lovableKey ? 'no LOVABLE_API_KEY' : 'no LOVABLE_MODEL set'})`);
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openrouterModel = process.env.OPENROUTER_MODEL;
  if (openrouterKey && openrouterModel) {
    const openrouterBaseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    await checkAiProviderLive('OpenRouter', (signal) =>
      pingHttp(
        `${openrouterBaseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openrouterKey}`,
            'X-Title': 'JARVIS Desktop AI',
          },
          body: JSON.stringify({ model: openrouterModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
        },
        signal,
      ),
    );
  } else {
    console.log(`  OpenRouter: SKIPPED (${!openrouterKey ? 'no OPENROUTER_API_KEY' : 'no OPENROUTER_MODEL set'})`);
  }

  console.log('');
  console.log('A FAILED line above shows the real HTTP status + the provider\'s own error');
  console.log('message (model not found, invalid model string, insufficient_quota, rate');
  console.log('limited, bad key, etc.) — that message is authoritative; fix what it says,');
  console.log('not what this script guesses. Model names in particular drift over time,');
  console.log('so double-check the *_MODEL variables in .env against each provider\'s');
  console.log('current docs if you see a "model not found"-style error. Note: Gemini');
  console.log('itself now self-heals a 404 at runtime by trying a documented fallback');
  console.log('model (see docs/AI_PROVIDERS.md) — this diagnostic still pings exactly');
  console.log('the model you configured, on purpose, so you can see the raw result.');
}

console.log('JARVIS Doctor');
console.log(`Node: ${process.version}`);
const npm = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], { shell: process.platform === 'win32' });
console.log(`npm: ${(npm.stdout || npm.stderr || '').trim()}`);
console.log(`Electron: ${file('node_modules/electron/package.json') ? JSON.parse(fs.readFileSync(electronPkg,'utf8')).version : 'NOT INSTALLED'}`);
console.log(`npm workspaces: ${Array.isArray(packageJson.workspaces) ? 'OK' : 'MISSING'}`);
console.log(`Preload: ${file('app/backend/src/preload.cjs') ? 'OK' : 'MISSING'}`);
console.log(`DatabaseManager: ${file('app/backend/src/database/DatabaseManager.ts') ? 'OK' : 'MISSING'}`);
console.log(`pnpm files: ${file('pnpm-lock.yaml') || file('pnpm-workspace.yaml') ? 'PRESENT (remove for npm-only)' : 'NONE'}`);

const envFile = loadRootEnvFile();
console.log(`Environment file (.env): ${envFile.found ? 'FOUND' : 'NOT FOUND'} (${envFile.path})`);
if (!envFile.found) {
  console.log('  -> Run `npm run bootstrap` to create .env from .env.example, then add your API key(s).');
}
console.log(`OpenAI enabled: ${boolFlag('OPENAI_ENABLED')}`);
console.log(`OpenAI API key: ${process.env.OPENAI_API_KEY ? 'PRESENT' : 'MISSING'}`);
console.log(`OpenAI model: ${process.env.OPENAI_MODEL || 'not set'}`);
console.log(`Gemini enabled: ${boolFlag('GEMINI_ENABLED')}`);
console.log(`Gemini API key: ${process.env.GEMINI_API_KEY ? 'PRESENT' : 'MISSING'}`);
console.log(`Gemini model: ${process.env.GEMINI_MODEL || 'not set'}`);
console.log(`Gemini model discovery: ${boolFlag('GEMINI_MODEL_DISCOVERY_ENABLED')}`);
console.log(`Claude enabled: ${boolFlag('CLAUDE_ENABLED')}`);
console.log(`Claude API key: ${process.env.ANTHROPIC_API_KEY ? 'PRESENT' : 'MISSING'}`);
console.log(`Claude model: ${process.env.CLAUDE_MODEL || 'not set'}`);
console.log(`Claude workspace ID: ${process.env.ANTHROPIC_WORKSPACE_ID ? 'PRESENT' : 'NOT SET'}`);
console.log(`Groq enabled: ${boolFlag('GROQ_ENABLED')}`);
console.log(`Groq API key: ${process.env.GROQ_API_KEY ? 'PRESENT' : 'MISSING'}`);
console.log(`Groq model: ${process.env.GROQ_MODEL || 'not set'}`);
console.log(`Lovable enabled: ${boolFlag('LOVABLE_ENABLED')}`);
console.log(`Lovable API key: ${process.env.LOVABLE_API_KEY ? 'PRESENT' : 'MISSING'}`);
console.log(`Lovable model: ${process.env.LOVABLE_MODEL || 'not set (provider stays unconfigured until set)'}`);
console.log(`OpenRouter enabled: ${boolFlag('OPENROUTER_ENABLED')}`);
console.log(`OpenRouter API key: ${process.env.OPENROUTER_API_KEY ? 'PRESENT' : 'MISSING'}`);
console.log(`OpenRouter model: ${process.env.OPENROUTER_MODEL || 'not set (provider stays unconfigured until set)'}`);
console.log(
  `AI keys: OpenAI=${process.env.OPENAI_API_KEY ? 'SET' : 'MISSING'}, Gemini=${process.env.GEMINI_API_KEY ? 'SET' : 'MISSING'}, Claude=${process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING'}, Groq=${process.env.GROQ_API_KEY ? 'SET' : 'MISSING'}, Lovable=${process.env.LOVABLE_API_KEY ? 'SET' : 'MISSING'}, OpenRouter=${process.env.OPENROUTER_API_KEY ? 'SET' : 'MISSING'}`,
);
console.log('AI mode: local rules for deterministic commands + cloud AI (6 providers, automatic failover) for open-ended questions');

if (fs.existsSync(electronExe)) {
  const abi = runElectron('process.stdout.write(process.versions.modules)');
  const abiText = String(abi.stdout || '').trim();
  console.log(`Electron ABI: ${abi.status === 0 && abiText ? abiText : 'UNKNOWN'}`);
  if (fs.existsSync(sqliteBinary)) {
    const db = sqliteCheck();
    console.log(`better-sqlite3 in Electron: ${db.ok ? 'OK' : 'INCOMPATIBLE'}`);
    if (!db.ok) {
      const detail = db.stderr || db.stdout || `exit code ${db.status ?? 'unknown'}`;
      console.log(`Native diagnostic: ${detail}`);
      console.log('Run `npm run dev` to rebuild the native module automatically when needed.');
    }
  } else {
    console.log('better-sqlite3 native binary: MISSING (npm run dev will rebuild it automatically)');
  }
} else {
  console.log('Electron diagnostic: SKIPPED — run npm install first.');
}

require('./doctor-integrations.cjs').runIntegrationDoctor();

const shouldCheckAi = process.argv.includes('--check-ai');
if (shouldCheckAi) {
  runAiLiveChecks().catch((err) => {
    console.error('AI live check crashed unexpectedly:', err);
    process.exitCode = 1;
  });
} else {
  console.log('');
  console.log('AI provider live check: SKIPPED (run `npm run doctor:ai` to test your API keys');
  console.log('and model names against the real OpenAI/Gemini/Claude APIs — uses a little quota).');
}
