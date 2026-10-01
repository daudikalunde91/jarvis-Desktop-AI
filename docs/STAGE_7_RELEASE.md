# Stage 7 — Release notes (delivery 1: foundation + Gmail + Calendar)

Base: `JARVIS-M5_2-NODE22-V7_2-RC2-PRODUCTION-GOLD.zip`. GitHub repo was **not reachable** from the build sandbox, so it was not compared.

## IMPLEMENTED (mocked-API tests pass; not yet live-verified)
IntegrationManager · IIntegrationProvider · capability grants · PermissionManager policies for 8 actions · IntegrationAgent ·
encrypted credential store (Electron safeStorage/DPAPI) · Google OAuth (loopback + PKCE + state + refresh + revoke) ·
Gmail search/read/send · Calendar list/search/create/update/delete · normalized errors · HTTP timeout/retry/backoff/cooldown ·
confirmation previews · 8 AI tools · 3 IPC channels + preload bridge · INTEGRATIONS status/connect/disconnect UI panel ·
`doctor` section + `npm run doctor:integrations` · `.env.example` · docs · tests.

## NOT IMPLEMENTED (delivery 2)
Drive, WhatsApp, Outlook, OneDrive, Telegram, Discord (docs state requirements/limits). Attachments/CC/BCC/drafts in Gmail.
Recurring events/attendees in Calendar.

## Known limitations
* Not run in this sandbox (no network/npm): `npm install`, `npm run build`, `npm run dev`, Electron startup, vitest itself,
  and any live Google call. Marked NOT RUN. Type-checking was done with TypeScript against stubs for `electron`/`dotenv` for the
  changed backend modules; **bootstrap/WindowManager and the frontend were not compiled here**.
* Tests were executed with a minimal local vitest stand-in, not real vitest (see report).
* Google Testing-mode refresh tokens expire after ~7 days.
* `sandbox: false` in `WindowManager` is pre-existing (documented in `OAUTH_SECURITY.md`).
* Credential file path depends on Electron `userData`; the app logs it at startup.
