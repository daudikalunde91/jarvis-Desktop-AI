# Gmail — IMPLEMENTED (mocked-API tested; not yet verified against a live account)

## Capabilities / permissions
| Permission | Google scope requested | Operations |
|---|---|---|
| `gmail.read` | `gmail.readonly` | `gmail.search`, `gmail.read` |
| `gmail.send` | `gmail.send` | `gmail.send` |

"READ ONLY" in the UI requests **only** `gmail.readonly`. Sending requires a separate grant and a per-message confirmation.

## Behaviour
* **search**: Gmail query syntax, max 15 results; returns sender/subject/date/snippet.
* **read**: by `messageId`; plain-text body only, truncated at 8,000 characters. Not stored anywhere by JARVIS.
* **send**: single, strictly validated recipient; subject must be one line (header-injection rejected); UTF-8 subjects encoded.
  Held at `awaiting-confirmation` with an `Action / Target / Content` preview until the user confirms. Never auto-retried on 5xx.
* **Disconnected**: returns "not connected / authorization required" — the AI is instructed (tool result code `AUTH_REQUIRED`) not to invent results.

## Not implemented
Attachments, CC/BCC, reply-in-thread, labels/drafts, HTML bodies.

## Setup (Google Cloud)
1. console.cloud.google.com → create/select a project → **APIs & Services → Library** → enable **Gmail API** (and Calendar API).
2. **OAuth consent screen** → External → add yourself under **Test users**.
3. **Credentials → Create credentials → OAuth client ID → Application type: Desktop app**.
4. Put the values in `.env` (never commit): `GMAIL_ENABLED=true`, `GOOGLE_CLIENT_ID=…`, optionally `GOOGLE_CLIENT_SECRET=…`.
5. `npm run dev` → INTEGRATIONS panel → **READ ONLY** (or **+ WRITE**) next to Gmail → approve in the browser.

**Known Google limitation:** while the consent screen is in *Testing* mode, Google expires refresh tokens after ~7 days;
JARVIS then shows "Reconnect needed". Publishing the app (or Google verification for restricted Gmail scopes) removes that.
