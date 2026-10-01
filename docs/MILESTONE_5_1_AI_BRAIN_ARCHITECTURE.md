# Milestone 5.1 — Real AI Brain (Multi-Provider Orchestration)

## Scope

Give JARVIS real natural-language reasoning (OpenAI, Google Gemini,
Anthropic Claude), while keeping JARVIS itself — not any AI vendor —
as the orchestrator, tool executor, and permission authority.

M1–M4 are **unchanged**. `BrainManager`, `RulesEngine`, `TaskPlanner`,
`ActionExecutor`, and every agent (`SystemAgent`, `FileAgent`,
`BrowserAgent`, `CodingAgent`, `MemoryAgent`) are exactly as they were.

## Why zero changes were needed in `BrainManager`

`BrainManager` already depended on a small interface, not a concrete
class:

```ts
export interface ICloudReasoner {
  readonly id: string;
  isAvailable(): boolean;
  complete(request: CloudRequest): Promise<string>;
}
```

`AIOrchestrator` (new) implements exactly this interface. Wiring it in
is a one-line change in `AppBootstrapper.ts` — swap what gets
registered under `BRAIN_TOKENS.CloudReasoner` — and everything
downstream (`BrainManager.handle`'s existing rules-first / cloud-last
resolution order, its offline-apology fallback, its confirmation flow)
keeps working exactly as designed.

## New module: `app/backend/src/ai/`

```
ai/
  types.ts                    Provider-agnostic message/tool/health/usage types
  errors.ts                   Normalized ProviderError hierarchy
  interfaces/IAIProvider.ts   The only contract providers must satisfy
  providers/
    BaseHttpProvider.ts       Shared fetch + timeout + HTTP-status normalization
    OpenAIProvider.ts         OpenAI Chat Completions adapter
    GeminiProvider.ts         Google Gemini generateContent adapter
    ClaudeProvider.ts         Anthropic Messages adapter
    LocalProvider.ts          Future on-device model placeholder (always unconfigured today)
  ProviderRegistry.ts         In-memory catalog of registered providers
  ProviderHealthManager.ts    Cooldown-based health/availability tracking
  ProviderRouter.ts           Task-type priority ordering, filtered by health+config
  FallbackManager.ts          Tries router's candidates in order; never calls all at once
  ContextManager.ts           Per-request history trimming (turns + char budget)
  UsageTracker.ts             In-memory telemetry (provider/model/latency/tokens/outcome)
  tools/
    ToolDefinitions.ts        Declarative tool list, mapped to existing agent actions
    ToolRegistry.ts           AI tool-call -> permission check -> ActionAgentRegistry bridge
  AIOrchestrator.ts           Composes all of the above; implements ICloudReasoner
  tokens.ts                   DI tokens
  index.ts                    Barrel export
```

## Request flow

```
User utterance
  -> BrainManager.handle()
       1. RulesEngine (offline, instant)         <- most commands stop here
       2. TaskPlanner + ActionExecutor            <- permission-gated tool execution
       3. AIOrchestrator.complete()  (ICloudReasoner)   <- only for open-ended conversation
            -> ContextManager.trim()
            -> FallbackManager.complete()
                 -> ProviderRouter.candidatesFor(taskType)
                 -> try candidate[0].complete()  -- success? return.
                                                  -- ProviderError? mark health, try candidate[1].
                 -> ... until success or AllProvidersFailedError
```

`BrainManager` never sees a provider directly — only the single
`ICloudReasoner.complete()` call it always had. If every provider
fails, `AIOrchestrator.complete()` re-throws; `BrainManager`'s existing
`catch { /* fall through to offline apology */ }` handles the rest. No
response is ever fabricated when reasoning was unavailable.

## Local-first

`BrainManager.handle()` already tries the Rules Engine and the
Action Executor *before* it ever reaches step 3. Every command listed
in the M5 spec as "should not require AI" (time, date, system info,
opening/closing apps, file listing/search, etc.) is already handled by
`RulesEngine` + the M4 agents and therefore **never reaches
`AIOrchestrator` at all** — see `tests/ai/local-first.test.ts`, which
asserts a zero call-count on the AI layer for those utterances.

## Provider routing & failover

Priorities are configurable per task type in `config/app.config.json`
under `ai.priorities` (defaults in `config/default.config.ts`):

| Task type  | Default order                        |
|------------|---------------------------------------|
| general    | openai → gemini → claude → local      |
| coding     | claude → openai → gemini → local      |
| multimodal | gemini → openai → claude → local      |
| planning   | openai → claude → gemini → local      |

`AIOrchestrator` currently classifies a request as `coding` when the
latest user message matches common error/code-related keywords,
otherwise `general`. (Task-type is already a first-class field on
`AICompletionRequest` — a future IPC surface can pass it through
explicitly once the renderer needs to.)

`ProviderHealthManager` marks a provider `RATE_LIMITED` or
`UNAVAILABLE` with a cooldown after any `ProviderError`, so subsequent
requests skip it automatically until the cooldown elapses —
implementing the "OpenAI → 429 → Gemini → success" failover from the
spec without a manual reset step.

## Tool calling

AI providers never execute anything directly:

```
AI -> ToolCall -> ToolRegistry.execute()
                    -> PermissionManager.authorize()   (existing M4 security layer)
                    -> ActionAgentRegistry.execute()   (existing M4 agents)
                    -> AIToolResult -> back to the model
```

`tools/ToolDefinitions.ts` maps each AI-visible tool name
(`system.get_info`, `system.get_time`, `app.open`, `app.close`,
`files.list`, `files.search`, `browser.open`, `terminal.execute`,
`vscode.open_project`, `system.shutdown`) to the exact existing agent
action id, with parameter shapes matched to what each agent already
expects. Dangerous tools (`system.shutdown`, `terminal.execute`) are
flagged `requiresConfirmation: true` and are gated by the same
`PermissionManager` the Rules Engine path already uses.

**Current integration status:** `ToolRegistry` and the tool
definitions are implemented and unit-testable today, and are wired
into the DI container (`AI_TOKENS.ToolRegistry`). `AIOrchestrator`
does not yet pass `tools` into `complete()` on the `ICloudReasoner`
path, because `ICloudReasoner`/`CloudRequest` (by design, from M4) is
a plain-text contract with no tool-call round trip. Turning on live
tool calling from a conversational reply is a `BrainManager`-level
decision (a new response variant, plus a loop for tool-result
follow-up turns) and was deliberately left out of this milestone to
honor "do not rewrite `BrainManager`." See **Migration Notes** below
for the follow-up task.

## Security

- API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`) are
  read once in `AppBootstrapper.buildAIOrchestrator()` directly from
  `AppEnv` and passed straight into provider constructors.
- They are **never** added to `AppConfig`/`ConfigManager`, because the
  renderer can read the entire `AppConfig` via the existing
  `config:getAll` IPC channel. Only non-secret settings (enabled
  flags, model ids, timeouts, priorities) live in `AppConfig.ai`.
- `BaseHttpProvider` redacts any `key=`/`api_key=` query parameter
  before it could ever appear in a thrown `TimeoutError`'s context.
- `UsageTracker` and `ProviderHealthManager` log only provider ids,
  model names, status/outcome, and normalized error codes — never a
  raw header, body, or key. See `tests/ai/orchestrator.test.ts`
  ("never writes a provider API key into any log line").

## Health & usage visibility

Two new, additive IPC channels:

- `ai:get-health` → `ProviderHealthSnapshot[]` (`{ providerId, state, retryAfter?, lastError?, lastCheckedAt }`)
- `ai:get-usage` → `UsageSummary[]` (`{ providerId, calls, successes, failures, fallbacks, totalTokens, averageLatencyMs }`)

Both return only safe, already-normalized data — no secrets, no raw
provider payloads.

## Configuration

See `.env.example` for the full list of new environment variables.
Nothing is enabled by default — every provider ships with
`enabled: false` until a key is supplied and the corresponding
`*_ENABLED=true` flag (or `config/app.config.json` override) is set.

## Tests

`tests/ai/`:

- `fallback.test.ts` — first-success short-circuit, OpenAI→Gemini
  failover, Gemini→Claude failover, all-fail →
  `AllProvidersFailedError`, cooldown skip after rate limit,
  authentication-error failover, disabled-provider exclusion.
- `local-first.test.ts` — rule-resolvable utterances never call the
  AI orchestrator.
- `context-manager.test.ts` — system prompt retention, turn-count
  trimming, char-budget trimming, always-keep-latest-turn guarantee.
- `orchestrator.test.ts` — never fabricates a response when every
  provider fails, never logs a provider API key, reports itself
  unavailable when unconfigured.

Not covered by these unit tests (need the full Electron/IPC
integration harness, not exercised in this sandbox — see **Migration
Notes**): IPC channel round-trip, Electron window still opens
normally, and a live end-to-end call against a real provider.

## Migration notes / follow-up

1. **Run `npm install`** in the project root — this sandbox has no
   network access, so the new code could not be type-checked or run
   here. Please run `npm run typecheck` and `npm test` after pulling
   these changes.
2. **Supply real model ids.** The defaults in
   `config/default.config.ts` (`gpt-4.1-mini`, `gemini-2.0-flash`,
   `claude-sonnet-4-6`) are placeholders — confirm against each
   vendor's current model list before enabling a provider in
   production.
3. **Tool-calling round trip.** `ToolRegistry` is ready; wiring a full
   AI ⇄ tool ⇄ AI loop into `BrainManager`'s cloud-fallback branch is
   the natural next milestone (M5.2) — it will need a new
   `BrainResponse` variant to represent "AI requested a tool, tool
   ran, here is the final answer" versus today's plain-text reply.
4. **Streaming.** `AICompletionResponse` is currently request/response,
   not streamed. The existing IPC (`ipc:handle`) is request/response
   too, so no architecture change is required to add streaming later —
   it needs an event-based IPC channel (e.g. `ai:stream-chunk`) added
   the same additive way `ai:get-health` was added here.
5. **Local model.** `LocalProvider.isConfigured()` always returns
   `false` today. Wiring in a real on-device runtime is a one-file
   change (implement `complete()`, flip `isConfigured()`).

---

## V7.1 Amendment — Tool-Using Desktop Agent

The original M5.1 provider architecture is now extended by the V7.1 upgrade. The important runtime path is:

`Brain -> AIOrchestrator -> ProviderRouter/Fallback -> Model -> ToolRegistry -> PermissionManager -> ActionAgent -> ToolResult -> Model -> final response`

This is an additive evolution of M5.1, not a replacement. The renderer still communicates through the existing Electron preload/IPC boundary, and provider secrets remain in the main process environment.

The new tool catalogue covers Windows telemetry/diagnostics, application discovery/launch, file operations, browser operations, Office creation, screenshot capture and existing coding/memory capabilities. Risky tools remain confirmation-gated.
