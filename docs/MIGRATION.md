# Migrating from V7.1 to V7.2

V7.2 is additive — nothing from V7.1 was removed or renamed. If you
have an existing V7.1 checkout with its own `.env`, here's what
changes and what doesn't.

## Your existing `.env` still works as-is

Every V7.1 variable (`OPENAI_*`, `GEMINI_*`, `CLAUDE_*`, and everything
non-AI) keeps working unchanged. Nothing is required to upgrade — the
new providers simply stay unconfigured/disabled until you add their
keys.

## What's new to optionally add

Copy these blocks from the refreshed `.env.example` into your existing
`.env` if you want the new providers or fixes:

```dotenv
# Recommended: replace a deprecated Gemini model if you're still on 2.5.
GEMINI_MODEL=gemini-3.6-flash
GEMINI_MODEL_DISCOVERY_ENABLED=true

# Optional: only if you're on a workspace-scoped Claude gateway (see
# docs/AI_PROVIDERS.md) — most direct api.anthropic.com users don't need this.
# ANTHROPIC_WORKSPACE_ID=

# Optional new providers — add any subset you want.
GROQ_ENABLED=true
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

LOVABLE_ENABLED=true
LOVABLE_API_KEY=
LOVABLE_MODEL=

OPENROUTER_ENABLED=true
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

## If you were relying on `GEMINI_MODEL=gemini-2.5-flash`

You don't strictly need to change it — `GeminiProvider` will now
self-heal past a 404 automatically (see `docs/AI_PROVIDERS.md`,
"Gemini model self-healing"). But since `gemini-2.5-flash` is on
Google's deprecation path, updating the value directly avoids relying
on the fallback path at all. If you had `GEMINI_MODEL_DISCOVERY_ENABLED`
unset before, it now defaults to `true` — set it to `false` if you'd
rather see raw 404s immediately.

## If you customized `config/app.config.json`

The `ai.providers` and `ai.priorities` shapes gained new keys (`groq`,
`openrouter`, `lovable`) but every existing key keeps its old meaning.
An old `app.config.json` missing the new provider blocks is fine —
`ConfigManager` falls back to `DEFAULT_CONFIG` for anything you haven't
overridden, the same way it already did for V7.1 keys.

## If you have code that calls `ProviderRouter.candidatesFor()`

The signature grew a third, optional parameter:

```ts
// V7.1
candidatesFor(taskType: TaskType, requiresVision = false): string[]

// V7.2
candidatesFor(taskType: TaskType, requiresVision = false, requiresTools = false): string[]
```

Existing two-argument call sites are unaffected — `requiresTools`
defaults to `false`, which preserves the exact V7.1 behavior (every
configured/eligible provider stays a candidate regardless of tool
support). `FallbackManager` was updated to pass this automatically
based on whether the request carries `tools`; you only need to pass it
yourself if you call the router directly.

## Nothing else changed

Electron, IPC, SQLite/better-sqlite3, the tool registry, the agents
(`system`/`file`/`browser`/`coding`/`memory`/`office`/`vision`), the
voice/wake-word scaffolding, and the frontend were not touched by
V7.2 — see `docs/V7_2_RELEASE.md` for the exact file list.
