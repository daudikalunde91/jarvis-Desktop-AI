# OAuth & Credential Security

## Where credentials are stored
* OAuth access/refresh tokens: `<Electron userData>/integrations/credentials.enc.json`, each value encrypted with Electron
  `safeStorage` (Windows **DPAPI**, bound to your Windows user). The path is logged at startup ("Integration data directory").
* If OS encryption is unavailable the store **refuses to write** — there is no plaintext fallback.
* Granted capability names (no secrets): `integration-grants.json` next to it.
* `GOOGLE_CLIENT_ID/SECRET` live in `.env` (git-ignored) and are read only in the main process (`core/env.ts`); they are not part of `AppConfig`.
* Not stored: email bodies, calendar contents, passwords. Nothing goes into SQLite or `MemoryManager`.

## How OAuth works
Installed-app flow, main process only: random-port loopback listener on `127.0.0.1` → system browser → Google consent →
callback validated with a constant-time `state` check (forged callbacks are ignored) → PKCE (S256) code exchange → tokens encrypted and stored.
Only `https://accounts.google.com` may be opened. 3-minute timeout, single use. Refresh is automatic (60 s skew, de-duplicated);
a rejected refresh token (`invalid_grant`) deletes the dead credentials and the status becomes "Reconnect needed".

## Permissions
See `PERMISSIONS.md`. Least privilege: "READ ONLY" requests only read scopes; capabilities are checked on every call.

## Disconnect / revoke
Disconnect → best-effort token revocation at Google → local credentials deleted → grants cleared. You can also revoke at
https://myaccount.google.com/permissions . To wipe everything locally, delete the `integrations` folder in userData.

## What the renderer/AI can and cannot do
* Renderer: read status; request connect/disconnect (user-initiated; consent still happens in your browser). It never receives tokens.
* AI: can call only the registered `gmail.*` / `calendar.*` tools; cannot connect, disconnect, read credentials, or confirm its own actions.
* Logs: only normalized error codes are logged; raw API responses are never logged or shown.

## Known gaps
* `WindowManager` creates the window with `sandbox: false` (pre-existing). The preload only exposes a fixed bridge, but enabling
  `sandbox: true` is recommended hardening — not changed here to avoid risking the verified Electron startup.
* Client secret for a Desktop OAuth client is not truly secret (Google documents this); PKCE is the real protection.
