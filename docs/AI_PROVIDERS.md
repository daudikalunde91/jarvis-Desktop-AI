# AI Providers (V7.2 / Stage 6)

JARVIS's AI layer lives entirely under `app/backend/src/ai/`. This
document covers what each provider is, how JARVIS picks between them,
and what to do when one fails. It does not change anything about how
`BrainManager`/tool execution work — this is purely the "which cloud
model answers this request" layer.

## The six providers

| id | Adapter | Wire format | Notes |
|---|---|---|---|
| `openai` | `OpenAIProvider` | OpenAI Chat Completions | unchanged from V7.1 |
| `gemini` | `GeminiProvider` | Google `generateContent` | V7.2: model self-healing, see below |
| `claude` | `ClaudeProvider` | Anthropic Messages | V7.2: optional workspace header, see below |
| `groq` | `GroqProvider` | OpenAI-compatible Chat Completions | new in V7.2 |
| `openrouter` | `OpenRouterProvider` | OpenAI-compatible Chat Completions | new in V7.2 |
| `lovable` | `LovableProvider` | OpenAI-compatible Chat Completions | new in V7.2 |

Groq/OpenRouter/Lovable all speak the same OpenAI-style
`/chat/completions` wire format, so they share one new base class,
`OpenAICompatibleProvider` (`app/backend/src/ai/providers/
OpenAICompatibleProvider.ts`), instead of each reimplementing request
building and response parsing. `OpenAIProvider` itself predates this
base class and was left as-is — it already works, and there was no
reason to touch it for this stage.

Every provider still implements the same `IAIProvider` contract as
before (`isConfigured()`, `capabilities`, `complete()`), so nothing
outside `app/backend/src/ai/` needed to change to support the new
providers — `ProviderRegistry`, `ProviderRouter`, `ProviderHealthManager`
and `FallbackManager` all treat all six identically.

## Where to get keys / current model catalogs

- **OpenAI**: https://platform.openai.com/api-keys · models: https://platform.openai.com/docs/models
- **Gemini**: https://aistudio.google.com/apikey · models: https://ai.google.dev/gemini-api/docs/models
- **Claude**: https://console.anthropic.com/ · models: https://docs.anthropic.com/en/docs/about-claude/models
- **Groq**: https://console.groq.com/keys · models: https://console.groq.com/docs/models
- **OpenRouter**: https://openrouter.ai/keys · models (400+, filterable by tool support): https://openrouter.ai/models
- **Lovable AI Gateway**: your Lovable project's AI settings · models are namespaced by upstream provider, e.g. `google/gemini-3.7-flash`, `openai/gpt-5-mini`

`OPENROUTER_MODEL` and `LOVABLE_MODEL` are deliberately left blank in
`.env.example` — both catalogs are too broad/volatile for one safe
default, and a blank model keeps `isConfigured()` false (the provider
stays out of the fallback chain) until you pick one. `GROQ_MODEL`
does ship a default (`llama-3.3-70b-versatile`) since Groq's free tier
has a small, relatively stable model set, but check the console link
above if you see a "model not found" error.

## Routing and fallback

`config/default.config.ts` → `ai.priorities` lists, per task type
(`general`/`coding`/`multimodal`/`planning`), the order candidates are
tried in. `ProviderRouter.candidatesFor()` filters that list down to
providers that are: registered, `isConfigured()`, not currently
unhealthy (see below), vision-capable if the request needs vision, and
— new in V7.2 — tool-calling-capable if the request actually carries
tool definitions. `FallbackManager` then tries each candidate in order
and returns the first success; every failure is logged with the real
HTTP status/body and recorded against that provider's health.

The starting `general` order is `gemini → groq → lovable → openrouter →
claude → openai → local`, following the example chain in the Stage 6
spec. `coding`/`multimodal`/`planning` keep their existing V7.1 leaders
(Claude for coding, Gemini for multimodal, OpenAI for planning) and
just gain the three new providers as extra fallback depth. Edit
`config/app.config.json` or `AI_PROVIDER_PRIMARY` to change this
without touching code.

## Provider health / quota vs. rate limit

`ProviderHealthManager` tracks each provider's state (`HEALTHY`,
`RATE_LIMITED`, `QUOTA_EXHAUSTED`/etc. via error `code`, with a
cooldown before the provider is eligible again) — this was already
built pre-V7.2. What V7.2 changes is `BaseHttpProvider.normalizeStatus`:
previously *every* HTTP 429 became a short-cooldown `RateLimitError`.
Now, a 429 (or 400) whose body contains a recognizable "no credits
left" phrase — OpenAI's `insufficient_quota`, Anthropic's
`credit_balance_exhausted`, or a few other common ones — becomes a
`QuotaExceededError` instead, which the health manager already gives a
much longer cooldown. Practically: an out-of-credits provider stops
being retried every ~30 seconds and just sits out of the fallback chain
until its cooldown expires or you fix the account.

Nothing here stores or logs API keys — only HTTP status + a truncated
response body ever land in a `ProviderError`'s `context`.

## Gemini model self-healing (Feature A / G)

Gemini's model names drift — `gemini-2.5-flash` (V7.1's default) is on
Google's deprecation path as of this build. Rather than hardcode one
name and silently break in a few months, `GeminiProvider` treats
`GEMINI_MODEL` as a *preference*:

1. It always tries the configured model first — zero extra requests,
   zero added startup latency, in the common/healthy case.
2. Only on an actual 404 from that model does it call Gemini's
   `models.list` once (8s timeout, best-effort) to find a currently
   `generateContent`-capable flash/pro model, retry the original
   request once with that model, and — if that works — remember it for
   the rest of the process.
3. If live discovery itself fails (network error, 5xx, etc.), it falls
   back to a small hand-maintained static list
   (`gemini-flash-latest`, `gemini-3.6-flash`, `gemini-3.5-flash`,
   `gemini-2.5-flash`) instead of just giving up.
4. If the fallback model *also* fails, the error you see still
   includes the **original** model's failure detail — Feature A is
   explicit that a fallback attempt must never hide the real root
   cause.

Set `GEMINI_MODEL_DISCOVERY_ENABLED=false` to disable all of this and
get the raw 404 back immediately (useful if you want doctor.cjs-style
"tell me exactly what's wrong" output without any retry layer in the
way).

Also note: the API key now travels as the `x-goog-api-key` header
(Google's current guidance) instead of a `?key=` query parameter, so it
no longer needs URL redaction for logging on this path.

## Claude workspace header

`ANTHROPIC_WORKSPACE_ID`, when set, is sent as `anthropic-workspace-id`
on every Claude request. This is **not** needed for a normal
`api.anthropic.com` + `sk-ant-...` key — that key is already scoped to
a workspace server-side. It exists specifically for workspace-scoped
gateways such as Claude Platform on AWS, where the M5 debug pass found
a deployment that needed it. Leave it unset unless you know you're on
such a gateway.

## Tool-calling capability filtering

Every current real provider defaults `capabilities.toolCalling = true`.
The one place this actually matters today is OpenRouter/Lovable, where
the *specific model you configure* might not support function calling
even though the provider adapter does. Two ways to handle that:

- Pick a tool-capable model (check https://openrouter.ai/models,
  filterable by "supports tools").
- Or construct the provider with `supportsTools: false` (not currently
  wired to an env var, since it's per-model, not per-provider — set it
  directly if you fork `AppBootstrapper.buildAIOrchestrator`, or ask
  for an `OPENROUTER_SUPPORTS_TOOLS` env toggle if you need this
  without a code change). With `supportsTools: false`, the adapter
  silently drops `tools` from the outgoing request instead of letting
  the upstream API reject the whole call with a 400, and
  `ProviderRouter` also stops offering that provider for any request
  that actually needs tools.


## Tool names on the wire (V7.2.1)

Internal tool names are dotted (`files.create_folder`). Claude, OpenAI and
OpenAI-compatible providers (Groq, OpenRouter, Lovable) require
`[a-zA-Z0-9_-]{1,64}`, so adapters encode names on the way out
(`files_create_folder`) and decode them on the way back using the tools
sent with that request (`ai/tools/ProviderToolNames.ts`). Gemini accepts
dots and is sent internal names unchanged. New providers that send tools
MUST use `ProviderToolNameCodec`.
