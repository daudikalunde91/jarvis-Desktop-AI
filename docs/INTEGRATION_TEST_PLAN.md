# Integration Test Plan

## A. Automated (no credentials needed) — `tests/integrations/*.test.ts` (52 tests)
HTTP client (retry/backoff/cooldown/normalization), encrypted store + grants, OAuth URL/PKCE/loopback state/timeouts/allow-list,
TokenManager (expiry, dedup refresh, dead-token cleanup), Gmail (search/read/send safety/401 refresh), Calendar
(list/search/create/update/delete + grant enforcement), IntegrationManager/Agent (MISSING/DISABLED, AUTH_REQUIRED, disconnect, health,
safe errors), permission policy + confirmation preview, preload/IPC security, no mic button, no committed secrets.
Run: `npx vitest run tests/integrations`. All external APIs are mocked.

## B. Live checks — NOT RUN — CREDENTIALS NOT CONFIGURED (run by you; read-only first)
Use a **test Google account**. Never test sending/deleting against real contacts or real events.
1. `npm run doctor:integrations` → Gmail/Calendar `configuration = READY`.
2. `npm run dev` → INTEGRATIONS panel → Gmail **READ ONLY** → approve in browser → status "Connected".
3. Ask: "Find emails from <your own test address>" → should list real messages (read-only).
4. Calendar **READ ONLY** → "What meetings do I have tomorrow?" → matches your calendar.
5. Disconnected behaviour: click DISCONNECT → repeat step 3 → JARVIS must say it needs authorization (no invented emails).
6. Confirmation: connect Gmail **+ WRITE** → "Send an email to <your own other address> saying test" → JARVIS must show
   Action/Target/Content and wait; answer "no" → nothing sent; repeat and answer "yes" → one email arrives.
7. Calendar write (test calendar only): create → confirm → appears; delete that event → confirm → gone.
8. Expiry: revoke at myaccount.google.com/permissions → next request → "Reconnect needed".
9. Confirm no token text appears in `logs/` (`Select-String -Path logs\* -Pattern "ya29|1//"` returns nothing).

## C. Regression (manual, in the running app)
"Open VS Code", "Show my system information", "List files in my Desktop", "Search for my project", "Explain machine learning",
"Create a Word document"; verify the window opens, IPC ping works, no microphone button exists, standby/voice indicators unchanged.
