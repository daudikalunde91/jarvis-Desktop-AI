# Voice Runtime Framework — Architecture Report

Verifies the Voice Runtime Framework milestone against every constraint
stated in the instructions, item by item.

## Upload discrepancy — stated plainly

No project file was uploaded with this milestone's request. Work
continued from this session's own in-progress workspace (Milestones 1,
2, and 3 as previously delivered). The instructions describe Milestones
3.1 (Voice Provider Architecture), 3.2 (Speech-to-Text Architecture),
3.3 (Wake Word Architecture), and 3.4 (Audio Pipeline Architecture) as
already locked. The actual workspace contains Milestone 3 delivered as
a single "Audio Pipeline Architecture" milestone (not subdivided into
3.1–3.4), and no `WakeWordManager`, `SpeechManager`, or `VoiceManager`
implementation exists anywhere — `app/voice/` is still the unmodified
Milestone 1 placeholder. This is reported here rather than assumed or
fabricated, consistent with how the same discrepancy was handled in
Milestone 3's own architecture report.

## Locked-milestone preservation

| Constraint | Status | Evidence |
|---|---|---|
| Milestone 1 (Foundation) preserved | ✅ Untouched | No file under `bootstrap/`, `lifecycle/`, `windows/`, `ipc/`, `database/`, `core/`, `logging/` was modified except the additive `AppBootstrapper.ts` wiring step |
| Milestone 2 (Core Infrastructure) preserved | ✅ Untouched | `infrastructure/*` and `shared/*` are unchanged |
| Milestone 3 (Audio Pipeline Architecture) preserved | ✅ Untouched | `audio/*` is unchanged — `VoiceRuntimeManager` only *calls* `IAudioManager.getSession()`/`endSession()`, never modifies `AudioManager`'s implementation |
| Milestones 3.1–3.3 preserved | ⚠️ Not present | See "Upload discrepancy" above |
| No module renamed | ✅ | Every existing class/interface name is unchanged |
| No folder moved | ✅ | `app/voice/` and every other placeholder remain exactly where and what they were |
| DI not replaced | ✅ | `infrastructure/di-container/DIContainer.ts` has zero diff; only new `container.register(VOICE_RUNTIME_TOKENS.*, ...)` calls were added in `AppBootstrapper.ts` |
| Logging not modified | ✅ | `logging/Logger.ts`, `logging/ILogger.ts`, both transports have zero diff; `VoiceRuntimeManager` takes `ILogger` via constructor exactly like every other class |
| Configuration Manager not modified | ✅ (schema extended, mechanism untouched) | `config/ConfigManager.ts`'s `load()` precedence algorithm is structurally identical — a new `voiceRuntime: {...}` block was added to the same three-way merge already present for `app`, `window`, `renderer`, `infrastructure`, `audio` |

## Requested connections — delivery status

| Connect | Status | How |
|---|---|---|
| AudioManager | ✅ | `VoiceRuntimeManagerDependencies.audioManager` (required) — session correlation via `audioSessionId` |
| WakeWordManager | ⚠️ Interface only, optional | `IWakeWordManager` defined; no concrete class exists; `VoiceRuntimeManager` operates correctly with it absent |
| SpeechManager | ⚠️ Interface only, optional | `ISpeechManager` defined; same as above |
| VoiceManager | ⚠️ Interface only, optional | `IVoiceManager` defined; same as above |
| Communication Bus | ✅ | `voice-runtime.control` command channel (start/stop/pause/resume via `sendCommand`/`respond`) |
| Event System | ✅ | All 8 runtime events (7 required + `STATE_CHANGED`) emitted through it |
| Health Monitor | ✅ | One health check registered per connected subsystem; `onFailureThresholdExceeded` wired to `handleSubsystemFailure` |
| Configuration | ✅ | `AppConfig.voiceRuntime`, resolved only through `ConfigManager` |
| Logging | ✅ | `ILogger` via constructor throughout |

**No AI Brain connection was made** — confirmed by inspection: no file
under `voice-runtime/` imports from, references, or has any awareness of
an AI/brain/inference module (none exists in the project).

## VoiceRuntimeManager — requested responsibilities

| Responsibility | Delivered as |
|---|---|
| Initialize Voice Stack | `initialize()` |
| Start runtime | `start()` |
| Stop runtime | `stop()` (graceful: ends sessions, stops listening, tolerates provider errors) |
| Pause | `pause()` |
| Resume | `resume()` |
| Health monitoring | `getRuntimeHealth()` |
| Session lifecycle | `startVoiceSession`/`endVoiceSession`/`getVoiceSession`/`listVoiceSessions` |
| Runtime statistics | `getStatistics()` |
| Error recovery | `retrySubsystemOperation()` + `handleSubsystemFailure()` |

## VoiceSession — requested support

| Requirement | Delivered as |
|---|---|
| VoiceSession | `IVoiceSession` / `VoiceSession` |
| Session State | `VoiceSessionState` (7 states) |
| Session Lifecycle | Driven by `VoiceRuntimeManager` (see `VOICE_SESSION_RUNTIME.md`) |
| Session Timeout | Inactivity-based, `rescheduleSessionTimeout()`/`timeoutSession()`, configurable via `AppConfig.voiceRuntime.defaultSessionTimeoutMs` |
| Session Metadata | `IVoiceSessionMetadata` (free-form) |

## Event Flow — requested events, all delivered

`WakeWordDetected`, `SpeechStarted`, `SpeechFinished`, `SpeechRecognized`,
`VoiceResponseReady`, `SessionEnded`, `Errors` — all present in
`VOICE_RUNTIME_EVENTS`, all emitted through the existing Event System,
all covered by `tests/voice-runtime/event-flow.test.ts`.

## Error Handling — requested items, all delivered

| Requirement | Delivered as |
|---|---|
| Retry policy | `retrySubsystemOperation()` — exponential backoff via the *existing* `shared/utilities/backoff.ts` + `delay.ts` (no duplicated retry logic; same utilities Milestone 2's `CommunicationBus` uses) |
| Graceful shutdown | `stop()` ends active sessions and tolerates a throwing `wakeWordManager.stopListening()` before completing |
| Provider failure recovery | `handleSubsystemFailure()`, triggered by the Health Monitor's `onFailureThresholdExceeded` callback |
| Health checks | Per-subsystem registration in `initialize()` |

## "Do Not Implement" compliance

| Item | Status |
|---|---|
| AI Brain | Not implemented — no reasoning/inference code; `SPEECH_RECOGNIZED` is emitted and never forwarded anywhere (verified by `event-flow.test.ts`'s explicit "no AI Brain call" test) |
| Intent Detection | Not implemented — no NLU/intent-parsing code exists |
| Command Execution | Not implemented — the only "commands" are the four runtime lifecycle actions (`start`/`stop`/`pause`/`resume`) on the Communication Bus control channel, not user/voice commands |
| Windows Automation | Not implemented |
| Browser Automation | Not implemented |
| Vision | Not implemented |
| Memory | Not implemented |
| Coding Agent | Not implemented |

## Dependency Injection

`VOICE_RUNTIME_TOKENS.{VoiceRuntimeManager, VoiceRuntimeFactory,
WakeWordManager, SpeechManager, VoiceManager}` are declared in
`voice-runtime/tokens.ts`. Only `VoiceRuntimeManager` and
`VoiceRuntimeFactory` are actually registered in `AppBootstrapper.ts` —
the three provider tokens are declared for a future milestone to
register against, but nothing registers a concrete implementation for
them today (none exists). This does not "break previous DI": every
existing registration from Milestones 2–3 (`INFRA_TOKENS.*`,
`AUDIO_TOKENS.*`) is untouched, and the same `DIContainer` instance is
reused, not replaced.

## Logging & Configuration verification

```bash
grep -rn "console\." app/backend/src/voice-runtime/   # → no matches
grep -rn "process\.env" app/backend/src/voice-runtime/ # → no matches
```

Both confirmed clean (see command output below).

## Verification performed

```
npm install     # clean install, no errors
npm run typecheck   # frontend + backend, 0 errors
npm run lint        # 0 errors, 0 warnings
npm run test        # 125/125 passing (45 new + 80 from Milestones 1–3)
npm run build       # frontend (vite build) + backend (tsc), both succeed
```

## Conclusion

The Voice Runtime Framework is implemented as runtime orchestration
only, connecting one real subsystem (`AudioManager`) and three optional
provider contracts with zero concrete implementations. Every locked
constraint that could be verified against the actual workspace is
satisfied; the constraints that couldn't be verified (preservation of
Milestones 3.1–3.4 as separately-named milestones, and the missing
upload) are reported honestly rather than assumed.
