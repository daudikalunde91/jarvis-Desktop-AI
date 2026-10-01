# MILESTONE_4_ALIGNMENT_CHANGELOG.md / Merge Changelog

Controlled merge of SOURCE A (Milestone 3 project: M1 + M2 + M3.4) and
SOURCE B (Milestone 4.0 project: M1 + M2 + M3.4 + M4.0 Voice Runtime
Framework), plus newly-created M3.1/M3.2/M3.3 (confirmed absent from
both sources by direct inspection — see
`MILESTONE_4_INTEGRATION_REPORT.md` for the audit).

**Base used:** SOURCE B (verified byte-identical to SOURCE A for every
M1/M2/M3.4 file except `config/*`, `core/env.ts`, and
`bootstrap/AppBootstrapper.ts`, which SOURCE B only extends additively —
see the audit in the integration report). Using SOURCE B as the base
avoided reconstructing M4.0; every M1/M2/M3.4 file is identical to
SOURCE A's.

## Added — Milestone 3.1 (Voice Provider Architecture)

All new files, zero prior version to compare against.

| File | Change Type | Reason |
|---|---|---|
| `app/backend/src/voice-provider/types/{VoiceGender,VoiceDeploymentMode}.ts`, `index.ts` | Add | M3.1 type vocabulary |
| `app/backend/src/voice-provider/errors/VoiceProviderError.ts`, `index.ts` | Add | M3.1 error hierarchy, extends Milestone 1's `AppError` |
| `app/backend/src/voice-provider/interfaces/{IVoiceProvider,IVoiceProviderRegistry,IVoiceProviderFactory}.ts`, `index.ts` | Add | M3.1 provider contract, registry contract, factory contract |
| `app/backend/src/voice-provider/models/VoiceProfile.ts`, `index.ts` | Add | Voice Profile + Voice Metadata, default female/natural/calm/professional/friendly/clear |
| `app/backend/src/voice-provider/VoiceProviderRegistry.ts` | Add | Concrete provider catalog |
| `app/backend/src/voice-provider/VoiceProviderFactory.ts` | Add | Concrete profile constructor |
| `app/backend/src/voice-provider/VoiceManager.ts` | Add | Concrete class implementing Milestone 4.0's `IVoiceManager` — the M3.1↔M4.0 integration boundary |
| `app/backend/src/voice-provider/tokens.ts`, `index.ts` | Add | DI tokens + module barrel |
| `tests/voice-provider/voice-provider.test.ts` | Add | 13 tests: profile defaults/validation, registry, factory, `VoiceManager` contract compliance |

**Affected milestone:** M3.1 (new). **Risk level:** Low — purely
additive, no existing file's behavior changed by these additions alone.

## Added — Milestone 3.2 (Speech-to-Text Architecture)

| File | Change Type | Reason |
|---|---|---|
| `app/backend/src/speech-to-text/types/{SupportedLanguage,SpeechSessionStatus,TranscriptionMode}.ts`, `index.ts` | Add | M3.2 type vocabulary; `FIRST_CLASS_LANGUAGES = ['en-US','sw-KE']` |
| `app/backend/src/speech-to-text/errors/SpeechError.ts`, `index.ts` | Add | M3.2 error hierarchy |
| `app/backend/src/speech-to-text/interfaces/{ISpeechProvider,ISpeechProviderRegistry,ISpeechProviderFactory}.ts`, `index.ts` | Add | M3.2 provider/registry/factory contracts |
| `app/backend/src/speech-to-text/models/{SpeechSession,SpeechResult,SpeechChunk}.ts`, `index.ts` | Add | Session, result (partial/final via `isFinal`), lightweight chunk descriptor |
| `app/backend/src/speech-to-text/SpeechProviderRegistry.ts` | Add | Concrete provider catalog |
| `app/backend/src/speech-to-text/SpeechProviderFactory.ts` | Add | Concrete session/result constructor |
| `app/backend/src/speech-to-text/SpeechManager.ts` | Add | Concrete class implementing Milestone 4.0's `ISpeechManager` — the M3.2↔M4.0 integration boundary |
| `app/backend/src/speech-to-text/tokens.ts`, `index.ts` | Add | DI tokens + module barrel |
| `tests/speech-to-text/speech-to-text.test.ts` | Add | 9 tests: registry, factory, first-class languages, `SpeechManager` contract compliance (started/finished/recognized event derivation) |

**Affected milestone:** M3.2 (new). **Risk level:** Low — additive only.

## Added — Milestone 3.3 (Wake Word Architecture)

| File | Change Type | Reason |
|---|---|---|
| `app/backend/src/wake-word/types/{DetectionState,SecureWakeLevel}.ts`, `index.ts` | Add | M3.3 type vocabulary |
| `app/backend/src/wake-word/errors/WakeWordError.ts`, `index.ts` | Add | M3.3 error hierarchy |
| `app/backend/src/wake-word/interfaces/{IWakeWordProvider,IWakeWordProviderRegistry,IWakeWordProviderFactory,ITrustedVoiceVerifier}.ts`, `index.ts` | Add | M3.3 provider/registry/factory contracts + Secure Wake verifier contract (unused, architecture prep only) |
| `app/backend/src/wake-word/models/WakeWordProfile.ts`, `index.ts` | Add | Default phrase "Jarvis", sensitivity/confidence/cooldown, `[0,1]`-validated |
| `app/backend/src/wake-word/WakeWordProviderRegistry.ts` | Add | Concrete provider catalog |
| `app/backend/src/wake-word/WakeWordProviderFactory.ts` | Add | Concrete profile constructor |
| `app/backend/src/wake-word/WakeWordManager.ts` | Add | Concrete class implementing Milestone 4.0's `IWakeWordManager` — the M3.3↔M4.0 integration boundary; confidence-threshold + cooldown false-trigger protection |
| `app/backend/src/wake-word/tokens.ts`, `index.ts` | Add | DI tokens + module barrel |
| `tests/wake-word/wake-word.test.ts` | Add | 13 tests: profile validation, registry, factory, `WakeWordManager` contract compliance, cooldown, confidence filtering, disabled state |

**Affected milestone:** M3.3 (new). **Risk level:** Low — additive only.

## Modified — Integration wiring (M3.1/3.2/3.3 → M3.4 → M4.0)

| File | Change Type | Reason | Previous Behavior | New Behavior | Affected Milestone | Risk Level |
|---|---|---|---|---|---|---|
| `app/backend/src/config/IConfigManager.ts` | Modify (additive) | New config sections needed for M3.1/3.2/3.3 | `AppConfig` had no `voiceProvider`/`speechToText`/`wakeWord` keys | Three new sections added; every pre-existing key/type unchanged | M3.1, M3.2, M3.3 | Low — type-only addition, no existing field touched |
| `app/backend/src/config/default.config.ts` | Modify (additive) | Provide fallback defaults for the new sections | No defaults for the new sections | Added `voiceProvider`/`speechToText`/`wakeWord` default blocks | M3.1, M3.2, M3.3 | Low |
| `app/backend/src/config/ConfigManager.ts` | Modify (additive) | Merge the new sections into resolved config | `load()` didn't merge the new sections | Three new merge blocks appended, following the exact `env ?? file ?? default` pattern already used for every other section; **no existing merge block edited** | M3.1, M3.2, M3.3 | Low |
| `app/backend/src/core/env.ts` | Modify (additive) | Read the new sections' env var overrides | `AppEnv` had no fields for the new sections | Added optional fields + `loadEnv()` reads; added two small helpers (`toFloatOptional`, `toStringArrayOptional`) alongside the existing `toIntOptional`/`toBoolOptional` | M3.1, M3.2, M3.3 | Low |
| `.env.example` | Modify (additive) | Document the new env vars | No entries for the new sections | Appended `VOICE_PROVIDER_*`, `SPEECH_TO_TEXT_*`, `WAKE_WORD_*` blocks | M3.1, M3.2, M3.3 | None (docs/example only) |
| `config/app.config.json` | Modify (additive) | Provide the new sections' default runtime config | No `voiceProvider`/`speechToText`/`wakeWord` keys | Appended three new JSON objects | M3.1, M3.2, M3.3 | None (data file) |
| `app/backend/src/bootstrap/AppBootstrapper.ts` | Modify | Register the three new managers into the *existing* DI Container and supply them to `VoiceRuntimeManager`'s already-optional constructor dependencies | Step 8 registered only `VoiceRuntimeFactory`/`VoiceRuntimeManager`, passing `wakeWordManager`/`speechManager`/`voiceManager` as `undefined` (omitted) | A new step 8 registers `WakeWordProviderRegistry`/`Factory`/`WakeWordManager`, `SpeechProviderRegistry`/`Factory`/`SpeechManager`, and `VoiceProviderRegistry`/`Factory`/`VoiceManager`; the (renumbered) Voice Runtime step now passes the three real manager instances instead of omitting them. New fields (`wakeWordManager`, `speechManager`, `voiceManager`) and getters added. **`VoiceRuntimeManager.ts` itself was not opened for this change** — only the values supplied to its pre-existing optional constructor parameters changed, here in the composition root | M3.1, M3.2, M3.3, M4.0 (wiring only) | Medium — this is the one file where M3→M4 integration logic lives; fully covered by the existing 45 M4.0 tests (unmodified, all still passing) plus the 35 new M3.1/3.2/3.3 tests |

**No file under `infrastructure/`, `shared/`, `audio/`, `logging/`,
`ipc/`, `lifecycle/`, `windows/`, `database/`, or `voice-runtime/` was
modified.** Confirmed by direct diff against both SOURCE A and SOURCE B
— see the audit in `MILESTONE_4_INTEGRATION_REPORT.md`.

## Documentation added

| File | Change Type |
|---|---|
| `docs/MILESTONE_3_1_VOICE_PROVIDER_ARCHITECTURE.md` | Add |
| `docs/MILESTONE_3_2_SPEECH_TO_TEXT_ARCHITECTURE.md` | Add |
| `docs/MILESTONE_3_3_WAKE_WORD_ARCHITECTURE.md` | Add |
| `docs/MILESTONE_4_INTEGRATION_REPORT.md` | Add |
| `docs/MILESTONE_MERGE_CHANGELOG.md` (this file) | Add |
| `README.md` | Modify (additive) — new milestone links, folder tree, contents lists |
| `docs/CHANGELOG.md` | Modify (additive) — new top entry for this merge |

## Not touched (verified)

`DIContainer.ts`, `Logger.ts`/`ILogger.ts`/transports, `ConfigManager`'s
merge/precedence *algorithm*, every Milestone 2 infrastructure class,
every Milestone 3.4 audio class, every Milestone 4.0
`voice-runtime/` file (`VoiceRuntimeManager.ts`, `VoiceRuntimeFactory.ts`,
all interfaces, all models, all events, `tokens.ts`), `app/frontend`,
`WindowManager`, `IpcRouter`, all nine Milestone 1 placeholder modules
(including `app/voice/`), and all 125 pre-existing tests (all still
passing, unmodified).

## Verification performed

```
npm install     # clean install, no errors
npm run typecheck   # frontend + backend, 0 errors
npm run lint        # 0 errors, 0 warnings
npm run test        # 160/160 passing (125 pre-existing, unmodified + 35 new)
npm run build       # frontend (vite build) + backend (tsc), both succeed
```

Circular-dependency check (manual, via grep — no import cycle exists):

```
voice-runtime/  → imports nothing from wake-word/, speech-to-text/, voice-provider/
audio/          → imports nothing from wake-word/, speech-to-text/, voice-provider/, voice-runtime/
infrastructure/, shared/ → import nothing from any of the above
```

Dependency direction is strictly:
`wake-word/`, `speech-to-text/`, `voice-provider/` → `voice-runtime/`
(interface types only) + `audio/` (`IAudioRouter` only) +
`infrastructure/`/`shared/`/`core/`/`logging/`. No back-references.
