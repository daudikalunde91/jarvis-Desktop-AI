# Test Plan (V7.2)

## Automated — `npm run test` (Vitest)

Run with `npm run test` (equivalently `npx vitest run`). No network
access is required — every AI provider test mocks `fetch` via
`vi.stubGlobal('fetch', ...)` rather than calling a real API.

| Area | File(s) | Covers |
|---|---|---|
| AI orchestrator | `tests/ai/orchestrator.test.ts` | end-to-end request flow, real `OpenAIProvider` against mocked HTTP |
| Fallback / routing | `tests/ai/fallback.test.ts` | provider-to-provider failover, health-based exclusion, **new**: tool-capability-based exclusion |
| Context management | `tests/ai/context-manager.test.ts` | conversation trimming |
| Local-first routing | `tests/ai/local-first.test.ts` | deterministic local commands bypass cloud AI |
| **New** OpenAI-compatible providers | `tests/ai/openai-compatible-providers.test.ts` | Groq/OpenRouter/Lovable: success parsing, quota-vs-rate-limit distinction, tool-call parsing, `supportsTools:false` dropping tools, secret redaction, unconfigured-provider short-circuit |
| **New** Gemini model discovery | `tests/ai/gemini-model-discovery.test.ts` | no discovery call on a healthy model; header-based key; 404 → discover → retry → cache; discovery-service-down → static fallback; fallback-also-fails → original error preserved; non-model errors never trigger fallback; `modelDiscoveryEnabled:false` |
| **New** Claude workspace header | `tests/ai/claude-workspace.test.ts` | header omitted by default; sent when `workspaceId` configured |
| Infrastructure | `tests/infrastructure/*.test.ts` | event system, agent manager, health monitor, communication bus |
| Voice/wake-word interfaces | `tests/voice-provider/`, `tests/speech-to-text/`, `tests/audio/`, `tests/voice-runtime/`, `tests/wake-word/` | architecture-level tests against fakes — see `docs/WAKE_WORD.md` for what this does and doesn't prove |

## Static checks

- `npm run typecheck` — frontend + backend, via each workspace's own `tsc --noEmit`.
- `npm run lint` — ESLint.

## Manual (needs a real Windows machine + real Electron runtime)

These cannot be automated in CI/sandbox and must be checked by hand:

1. `npm run dev` opens a **native Electron window** — not a
   browser-only localhost page.
2. `npm run doctor` reports Node/npm/Electron/workspace/preload/
   database/Electron ABI/better-sqlite3/`.env` health.
3. `npm run doctor:ai` — with at least one real API key set, confirms
   a live 200 (or a clearly-explained failure) for each configured
   provider. See "Tests performed" in `docs/V7_2_RELEASE.md` for why
   this specific command could not be run during this release's
   preparation.
4. Ask JARVIS an open-ended question ("Explain quantum computing") and
   confirm the answer comes from a real provider, not a hardcoded
   string.
5. Ask JARVIS to do a deterministic local action ("Open VS Code") and
   confirm it routes locally without a cloud call.
6. Temporarily unset/break one provider's key and confirm the next
   configured provider in that task type's priority list answers
   instead (see `docs/AI_PROVIDERS.md` for the default order).
7. Confirm there is still no microphone button anywhere in the UI.

## What this release (V7.2) actually ran

See `docs/V7_2_RELEASE.md`, section "Tests performed", for the exact,
non-fabricated list of what was and wasn't executed while preparing
this ZIP — in short: static type-checking was run and passed for every
changed file; `npm install`/`npm run test`/`npm run dev`/live API calls
were **not** run, because the preparation environment had no network
access. Items 1–7 above are exactly what to run yourself first on your
Windows machine.
