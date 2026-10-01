# V7.1.3 — AI Provider Failure Diagnostics Fix (Sept 2026)

## The problem you reported

On `npm run dev`, all three cloud providers failed on the first real request:

```
openai: AI_RATE_LIMIT_ERROR
gemini: AI_MODEL_UNAVAILABLE_ERROR
claude: AI_INVALID_REQUEST_ERROR
```

JARVIS's own message was accurate but generic:

> Cloud AI providers were unavailable... Check the affected provider's
> quota/API key or configure another provider so failover can continue.

## Root cause: two different problems, not one

**1. These are real, external failures — not bugs in the adapters.**
`OpenAIProvider.ts`, `GeminiProvider.ts`, and `ClaudeProvider.ts` build valid
requests. A 429 from OpenAI, a 404-class "unavailable" from Gemini, and a
400 "invalid request" from Claude are the actual providers rejecting the
actual request — most likely one of:
- **OpenAI (429):** account/key has hit its rate limit or quota (billing,
  free-tier cap, or too many concurrent requests).
- **Gemini (unavailable):** `GEMINI_MODEL=gemini-2.5-flash` in your `.env`
  may no longer match a model Google's API currently serves at that name —
  provider model IDs get renamed/retired over time.
- **Claude (invalid request):** `CLAUDE_MODEL=claude-sonnet-4-6` in your
  `.env`/`config/app.config.json` is very likely the culprit — the request
  shape from `ClaudeProvider.ts` is valid, so a 400 here almost always
  means the model string itself isn't one your key can use.

**We can't fix these for you by guessing a "correct" model string** — the
authoritative source is each provider's own dashboard/docs at the moment
you read this, since these names change. What we *can* fix is #2:

**2. JARVIS was throwing away the one piece of information that tells you
which of the above it actually is.**

- `BaseHttpProvider.ts` already captured the real HTTP status and a
  truncated response body into each error's `.context` (this part was
  fine).
- But `FallbackManager.ts` logged only `{ code: providerError.code }` —
  the context was read and discarded.
- `AllProvidersFailedError` (in `errors.ts`) then rebuilt its own summary
  from only `{ providerId, code }`, so even a downstream consumer that
  wanted the detail couldn't get it from that error's `.context`.
- `AIOrchestrator.ts`'s catch block logged `attempts: error.attempts.length`
  — literally just a count (e.g. `3`), which is not diagnostic information
  at all.

So the actual provider response — the sentence that would have told you
"model: claude-sonnet-4-6 is not a valid model ID" or "You exceeded your
current quota" — was sitting in memory the whole time and never printed
anywhere.

## What was fixed

1. **`app/backend/src/ai/FallbackManager.ts`** — the per-attempt warning
   log now spreads `providerError.context` alongside the code, so
   `npm run dev`'s console shows the real status + body snippet at the
   moment each provider fails.
2. **`app/backend/src/ai/errors.ts`** — `AllProvidersFailedError` now
   keeps each attempt's `context` in its own `.context`, not just
   `providerId`/`code`.
3. **`app/backend/src/ai/AIOrchestrator.ts`** — the top-level catch now
   logs the full per-provider detail instead of a bare attempt count.
4. **`scripts/doctor.cjs`** — new opt-in live check: `npm run doctor:ai`
   (or `node scripts/doctor.cjs --check-ai`) sends one minimal real request
   to every configured provider *before you ever open the Electron window*
   and prints the exact HTTP status + provider error message for each.
   This is the fastest way to answer "which key/model is actually broken"
   — it's opt-in and separate from plain `npm run doctor` because it
   spends a small amount of real quota, and you don't want to burn more of
   it on a provider that's already rate-limited.

None of this changes request/response shapes, retry/cooldown behavior, or
the user-facing Swahili/English apology text in `BrainManager.ts` — it
only stops discarding diagnostic detail that already existed.

## How to actually resolve your three failures

```powershell
npm run doctor:ai
```

Read each `FAILED (HTTP ...)` line's `->` detail — that's the provider's
own words, not a guess. Typical next steps per provider:

- **OpenAI 429:** check usage/billing at platform.openai.com; wait out the
  cooldown or upgrade the tier; confirm you're not running two JARVIS
  instances hammering the same key.
- **Gemini 404 / unavailable:** open Google AI Studio / the Generative
  Language API model list for your key and copy the exact current model ID
  into `GEMINI_MODEL` in `.env`.
- **Claude 400 invalid request:** open the Anthropic Console's model list
  for your key and copy the exact current model ID into `CLAUDE_MODEL` in
  `.env` (and `config/app.config.json` if you want the same value baked
  into the shipped default). Also double check `ANTHROPIC_API_KEY` has no
  stray whitespace/quotes from copy-paste.

Since only one provider needs to work for JARVIS to answer open-ended
questions (failover tries them in `general`/`coding`/etc. priority order
from `config/app.config.json`), fixing just one of the three unblocks you
immediately.
