# MILESTONE_5_1_CHANGELOG.md — File-by-File Change Summary

Scope: implement M5.1 (Real AI Brain / multi-provider orchestration)
on top of the M1–M4 baseline, per `docs/MILESTONE_5_1_AI_BRAIN_ARCHITECTURE.md`.
Every M1–M4 file not listed below is untouched.

## Added — `app/backend/src/ai/` (new module, 20 files)

| File | Reason |
|---|---|
| `types.ts` | Provider-agnostic message/tool/health/usage type contracts |
| `errors.ts` | Normalized `ProviderError` hierarchy (Auth/RateLimit/Quota/Timeout/Network/ModelUnavailable/InvalidRequest) + health classification |
| `interfaces/IAIProvider.ts` | The single contract every provider adapter must satisfy |
| `providers/BaseHttpProvider.ts` | Shared fetch/timeout/HTTP-status-to-ProviderError normalization, with key redaction |
| `providers/OpenAIProvider.ts` | OpenAI Chat Completions adapter |
| `providers/GeminiProvider.ts` | Google Gemini `generateContent` adapter |
| `providers/ClaudeProvider.ts` | Anthropic Messages API adapter |
| `providers/LocalProvider.ts` | Future on-device model placeholder (`isConfigured()` always false today) |
| `ProviderRegistry.ts` | In-memory provider catalog (mirrors `voice-provider/VoiceProviderRegistry.ts`'s shape) |
| `ProviderHealthManager.ts` | Cooldown-based health tracking; implements automatic failover recovery |
| `ProviderRouter.ts` | Configurable, task-type-based provider priority resolution |
| `ContextManager.ts` | Per-request history trimming (turn count + character budget) |
| `UsageTracker.ts` | In-memory provider/model/latency/token/outcome telemetry, secret-free |
| `FallbackManager.ts` | Sequential candidate-provider trial with health/usage recording |
| `tools/ToolDefinitions.ts` | Declarative AI-visible tool list, mapped to existing M4 agent action ids |
| `tools/ToolRegistry.ts` | AI tool-call → `PermissionManager` → `ActionAgentRegistry` bridge |
| `AIOrchestrator.ts` | Composes the whole module; **implements `ICloudReasoner`** — the sole integration point into `BrainManager` |
| `tokens.ts` | DI tokens for the module |
| `index.ts` | Barrel export |

**Risk level:** None to M1–M4 — this is a new, self-contained module.

## Added — Tests (4 files)

| File | Covers |
|---|---|
| `tests/ai/fallback.test.ts` | First-success short circuit; OpenAI→Gemini and Gemini→Claude failover; all-providers-fail; rate-limit cooldown skip; auth-error failover; disabled-provider exclusion |
| `tests/ai/local-first.test.ts` | Rule-resolvable utterances (`saa ngapi?`, `what time is it`, `system status`) never call the AI orchestrator |
| `tests/ai/context-manager.test.ts` | System-prompt retention, turn/char trimming, always-keep-latest-turn |
| `tests/ai/orchestrator.test.ts` | Never fabricates a response on total failure; never logs a provider API key; reports itself unavailable when unconfigured |

## Modified — additive only

| File | Change |
|---|---|
| `app/backend/src/config/IConfigManager.ts` | Added `ai: {...}` section to `AppConfig` (non-secret provider settings, priorities, context limits) |
| `app/backend/src/config/default.config.ts` | Added `DEFAULT_CONFIG.ai` (all providers `enabled: false` by default) |
| `app/backend/src/config/ConfigManager.ts` | Added `ai` merge block (env → file → default precedence, same pattern as every other section) |
| `config/app.config.json` | Added an explicit `ai` block matching the new defaults |
| `app/backend/src/core/env.ts` | Added `AppEnv` fields for AI settings **and** the three secret key fields (`openaiApiKey`, `geminiApiKey`, `anthropicApiKey`) — secrets are deliberately kept out of `AppConfig` (see architecture doc, Security section) |
| `.env.example` | Added `OPENAI_*`, `GEMINI_*`, `CLAUDE_*`/`ANTHROPIC_API_KEY`, `AI_PROVIDER_PRIMARY`, `AI_CONTEXT_MAX_*` — all providers off by default |
| `app/backend/src/core/constants.ts` | Added `AI` to `IPC_NAMESPACE` |
| `app/backend/src/ipc/channels.ts` | Added `AI_GET_HEALTH`, `AI_GET_USAGE` channels |
| `app/backend/src/ipc/handlers/aiHandlers.ts` (new) | Registers the two new channels, returning only sanitized health/usage summaries |
| `app/backend/src/ipc/registerIpc.ts` | Now also calls `registerAiHandlers`; signature gained one parameter (`aiOrchestrator`) |
| `app/backend/src/bootstrap/AppBootstrapper.ts` | Added `buildAIOrchestrator()`, registers `AI_TOKENS.ToolRegistry` / `AI_TOKENS.Orchestrator`, and changes what is registered under `BRAIN_TOKENS.CloudReasoner` from `NullCloudReasoner` to the built `AIOrchestrator`. `BrainManager`'s own construction call is **unchanged** — it still receives one `ICloudReasoner`, resolved from the same token. |

**Risk level:** Low. Every change is additive (new fields, new optional
config, new IPC channels, new DI registrations). No existing method
signature in `BrainManager`, `RulesEngine`, `TaskPlanner`,
`ActionExecutor`, or any agent was changed. `registerIpc`'s signature
gained a parameter, but it has exactly one caller
(`AppBootstrapper.ts`), which was updated in the same change.

## Not modified (verified byte-for-byte untouched)

`app/backend/src/brain/{BrainManager,RulesEngine,TaskPlanner,ActionExecutor,CloudReasoner,types,tokens,index}.ts`,
every file under `app/backend/src/agents/`, `app/backend/src/security/`,
`app/backend/src/memory/`, `app/backend/src/voice-*`,
`app/backend/src/speech-to-text/`, `app/backend/src/wake-word/`,
`app/backend/src/audio/`, `app/backend/src/infrastructure/`.

## Known gaps (see architecture doc's Migration Notes for detail)

- No `npm install`/`tsc`/`vitest` run was possible in this sandbox
  (no network access to install dependencies). All new/changed files
  were manually re-checked against the project's existing types,
  conventions, and `strict`/`noUnusedLocals`/`noUnusedParameters`
  tsconfig settings, but a real `npm run typecheck && npm test` run is
  still required before merging.
- Full AI ⇄ tool ⇄ AI round trip is not yet wired into
  `BrainManager`'s cloud-fallback branch (tracked as M5.2).
- Streaming is not implemented (`ICloudReasoner.complete()` remains
  request/response, matching the pre-existing M4 contract).

## Follow-up fix — pre-existing baseline gap found on first real `npm run dev`

Running the project for real (`npm install && npm run dev`) surfaced a
build error unrelated to M5.1: `AppBootstrapper.ts` (M1/M2 code, not
touched by this milestone) imports
`DatabaseManager` from `@backend/database/DatabaseManager`, but that
file does not exist anywhere in the uploaded archive — confirmed by
extracting the original, untouched zip and checking: no
`app/backend/src/database/` directory at all. `docs/ARCHITECTURE.md`
already documents `DatabaseManager` as a Milestone 1 component
("receives already-resolved `AppConfig` values through constructor
injection (see `WindowManager`, `DatabaseManager`)"), so this was a
missing file in the baseline, not a gap introduced by M5.1.

**Fix:** added `app/backend/src/database/DatabaseManager.ts` — a thin
`better-sqlite3` connection wrapper (`connect()` / `getConnection()` /
`close()`) matching the exact constructor call already present in
`AppBootstrapper.ts` (`directory, filename, logger`) and the
`SqlDatabase` (`exec`/`prepare`) shape `SqliteMemoryRepository`
already expected. No other file needed to change for this.

Also added, purely additively, so the new `ai:get-health` /
`ai:get-usage` channels are actually reachable from the renderer:
`preload.ts`, `preload.cjs` (`getAIHealth`/`getAIUsage` bridge
methods), `app/frontend/src/vite-env.d.ts` (`JarvisBridge` type), and
`app/frontend/src/ipc/ipcClient.ts` (matching client methods).

## V7.1.1 follow-up — Windows development startup reliability

- Fixed the development launcher assuming TCP port `5173` is always free.
- Added automatic free-port selection starting at `5173`.
- The selected port is injected through `VITE_PORT` and `VITE_DEV_SERVER_URL`, keeping Electron aligned with the actual Vite server.
- Kept `strictPort` enabled for the selected port so a race condition fails clearly instead of silently starting on another port.
- Documented that `npm run doctor` is diagnostic and that `npm run bootstrap` creates `.env` but cannot create API credentials.
- Documented the expected `better-sqlite3` ABI repair flow and the current lockfile limitation.
