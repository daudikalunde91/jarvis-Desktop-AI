# Personal Integrations — Stage 7 (delivery 1 of 2)

> Honest status labels used throughout: **IMPLEMENTED** (code + mocked-API tests), **PARTIAL**,
> **SCAFFOLDING**, **NOT IMPLEMENTED**. "Implemented" never means "verified against a live account"
> unless stated — see `INTEGRATION_TEST_PLAN.md`.

## Audit result (what the uploaded ZIP actually contained)

The Stage 7 brief assumed `IntegrationAgent`, `IntegrationManager`, `gmail_search/read/send`, WhatsApp and
OAuth code already existed. **They did not** (the previous version of this file already said so). The only
related code was two `browser.open` shortcuts (Gmail / WhatsApp Web). Stage 7 is therefore a new build on the
existing foundation, reusing: `PermissionManager`/`ActionPolicy`, `ActionAgentRegistry`, `ToolRegistry`,
the sandboxed preload + fixed IPC channels, `ILogger`, `AppError`.
There was no pre-existing credential store, so none was duplicated.

## Architecture

```
AI / Brain ──► ToolRegistry ──► PermissionManager (risk + confirmation)
                                      │
                                      ▼
                              IntegrationAgent  (IActionAgent)
                                      │
                                      ▼
                              IntegrationManager ── capability grants (IntegrationGrantStore, non-secret)
                                      │
                    ┌─────────────────┴──────────────────┐
              GmailProvider                     GoogleCalendarProvider
                    └──────── GoogleProviderBase ────────┘
                               │            │
                       TokenManager   IntegrationHttpClient (timeout, retry, cooldown, error normalization)
                               │
                  EncryptedFileCredentialStore ── ElectronSafeStorageCipher (Windows DPAPI)
```

Renderer ⇄ main: only `integrations:get-status`, `integrations:connect`, `integrations:disconnect`
(validated, status-only responses). Connect/disconnect are **user actions**, not AI tools.

## Status matrix

| Integration | Config | Status | Notes |
|---|---|---|---|
| Gmail (search/read/send/connect/disconnect) | `GMAIL_ENABLED`, `GOOGLE_CLIENT_ID` | **IMPLEMENTED (mocked tests)** — not yet run against a live account | `docs/GMAIL.md` |
| Google Calendar (list/search/create/update/delete) | `CALENDAR_ENABLED`, `GOOGLE_CLIENT_ID` | **IMPLEMENTED (mocked tests)** — not yet run live | `docs/GOOGLE_CALENDAR.md` |
| Google Drive | — | **NOT IMPLEMENTED** (delivery 2) | `docs/GOOGLE_DRIVE.md` |
| WhatsApp Cloud API | — | **NOT IMPLEMENTED** (delivery 2) | `docs/WHATSAPP.md` |
| Outlook / OneDrive (Microsoft Graph) | — | **NOT IMPLEMENTED** (delivery 2) | `docs/MICROSOFT_GRAPH.md` |
| Telegram, Discord | — | **NOT IMPLEMENTED** (documented limits only) | below |
| Integration status UI panel | — | **IMPLEMENTED** (not visually verified here) | no tokens ever rendered |
| `doctor` / `doctor:integrations` | — | **IMPLEMENTED** | config + authorization only; live health = NOT RUN |
| Normalized errors, rate limiting, backoff | — | **IMPLEMENTED** | `AUTH_REQUIRED … INVALID_CONFIGURATION` |

Interface note: the brief suggested `connect()/disconnect()/getStatus()/requiredScopes()/capabilities()/healthCheck()`;
`IIntegrationProvider` (`integrations/types.ts`) provides exactly these plus an `operations` list.
Tool names follow the repo's dotted convention (`gmail.search`, `calendar.list_events`, …); provider adapters
already translate dots for APIs that forbid them.

## Telegram / Discord — real limits (for delivery 2)

* **Telegram**: the Bot API only controls a *bot*; it cannot read or send as your personal account. A user-account
  client (MTProto/TDLib) is a different, much riskier integration and is **not** planned in this stage.
* **Discord**: OAuth2 identifies the user and grants limited scopes; bots act as bots. Reading/sending as a personal
  account is against Discord's terms. Only bot/webhook-style features are realistic.

## Where data lives

See `OAUTH_SECURITY.md`. Short version: OAuth tokens → DPAPI-encrypted file in Electron `userData/integrations`;
granted capability names → plain JSON next to it; **nothing** in SQLite, `.env`, logs, the renderer, or any AI prompt.
JARVIS does **not** write email bodies or calendar contents into `MemoryManager`.
