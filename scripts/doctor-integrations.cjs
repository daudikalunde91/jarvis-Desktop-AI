'use strict';
// Stage 7 — integration diagnostics. Prints configuration + authorization state only.
// NEVER prints credential values. Credentials are DPAPI-encrypted and readable only
// inside the running Electron app, so live health is reported honestly as NOT RUN here.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const flag = (name) => {
  const v = process.env[name];
  if (v === undefined || v === '') return null;
  return v.toLowerCase() === 'true' || v === '1';
};

function candidateDataDirs() {
  const base = process.env.APPDATA || path.join(os.homedir(), '.config');
  return ['jarvis', 'JARVIS', 'jarvis-backend', 'Electron'].map((n) => path.join(base, n, 'integrations'));
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function configState(enabledVar, needs) {
  const enabled = flag(enabledVar);
  if (!enabled) return enabled === null ? 'DISABLED (variable not set)' : 'DISABLED';
  const missing = needs.filter((n) => !process.env[n]);
  return missing.length ? `MISSING (${missing.join(', ')})` : 'READY';
}

function runIntegrationDoctor() {
  console.log('');
  console.log('=== Integrations (Stage 7) ===');
  const dir = candidateDataDirs().find((d) => fs.existsSync(d));
  const grants = dir ? readJson(path.join(dir, 'integration-grants.json')) || {} : {};
  const creds = dir ? readJson(path.join(dir, 'credentials.enc.json')) || {} : {};
  console.log(`App data folder: ${dir ? dir : 'not found (the app has not been run/connected yet, or uses a different userData path — see the "Integration data directory" line in the app log)'}`);

  const rows = [
    ['Gmail', 'GMAIL_ENABLED', ['GOOGLE_CLIENT_ID'], 'gmail', 'google:gmail'],
    ['Calendar', 'CALENDAR_ENABLED', ['GOOGLE_CLIENT_ID'], 'calendar', 'google:calendar'],
  ];
  for (const [name, enabledVar, needs, grantKey, credKey] of rows) {
    const connected = Boolean(creds[credKey]);
    console.log(`${name}:`);
    console.log(`  configuration = ${configState(enabledVar, needs)}`);
    console.log(`  authorization = ${connected ? 'CONNECTED (credentials present)' : 'NOT CONNECTED'}${connected && Array.isArray(grants[grantKey]) ? `, permissions: ${grants[grantKey].join(', ')}` : ''}`);
    console.log('  health        = NOT RUN — live health needs the running app (credentials are only decryptable inside Electron)');
  }
  for (const n of ['Drive', 'WhatsApp', 'Outlook', 'OneDrive', 'Telegram', 'Discord']) {
    console.log(`${n}: NOT IMPLEMENTED in this release (see docs/INTEGRATIONS.md)`);
  }
  console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING'}   GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'not set (optional for Desktop clients using PKCE)'}`);
}

module.exports = { runIntegrationDoctor };
