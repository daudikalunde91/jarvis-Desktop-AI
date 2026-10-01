# Voice Session Runtime

What a `VoiceSession` is, its runtime lifecycle, its timeout mechanics,
and how it relates to an `AudioSession` (Milestone 3).

## What it is

A `VoiceSession` represents one wake-word-to-response interaction —
runtime bookkeeping only. Like `AudioSession` before it, it holds no
audio or transcript payload: state, timing, and metadata only.

## Field reference

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Generated via `generateId()` (same generator as every other ID in the project) |
| `audioSessionId` | `string \| null` | Correlates with an `IAudioSession.id` from the Audio Pipeline Architecture; `null` if the interaction has no associated audio session |
| `language` | `string` | Defaults to `'en-US'` |
| `startedAt` | `number` | `Date.now()` at construction |
| `lastActivityAt` | `number` | Updated by `touch()` — drives the inactivity timeout |
| `endedAt` | `number \| null` | Set once, when the session ends |
| `timeoutMs` | `number` | Sourced from `AppConfig.voiceRuntime.defaultSessionTimeoutMs`, defaults to 30 000ms |
| `state` | `VoiceSessionState` | `'listening-for-wake-word' \| 'active' \| 'processing' \| 'responding' \| 'ended' \| 'timed-out' \| 'failed'` |
| `metadata` | `Record<string, unknown>` | Free-form |

## Relationship to AudioSession

A `VoiceSession` and an `AudioSession` (Milestone 3) are deliberately
**separate objects with separate lifecycles**, linked only by ID:

- An `AudioSession` represents "one audio device session" (which
  microphone/speaker, what format, how long the device was engaged).
- A `VoiceSession` represents "one voice interaction" (wake word → speech
  → response) — the runtime's view of a single conversational turn.

A `VoiceSession` may reference zero or one `AudioSession` via
`audioSessionId`. `VoiceRuntimeManager.endVoiceSession()` will
best-effort end the correlated `AudioSession` too (if it exists and
isn't already ended) — but ending a `VoiceSession` never assumes an
`AudioSession` exists, and vice versa. This separation means a future
milestone could support one continuous `AudioSession` spanning multiple
back-to-back `VoiceSession`s (e.g., a follow-up question without a new
wake word) without restructuring either model.

## Lifecycle

```
listening-for-wake-word → active → processing → responding → ended
                                                       ↘ timed-out
                                                       ↘ failed
```

Driven by `VoiceRuntimeManager`:

1. **Created** — `startVoiceSession()` (called automatically when a
   connected `IWakeWordManager` fires `onWakeWordDetected`, or directly
   by any future caller). State starts at `'listening-for-wake-word'`
   from the model's constructor, immediately set to `'active'` by the
   wake-word handler.
2. **Speech begins** — `ISpeechManager.onSpeechStarted` (if connected)
   moves state to `'processing'` and resets the inactivity timer.
3. **Speech recognized** — `onSpeechRecognized` resets the inactivity
   timer again; state remains `'processing'`. The recognized text is
   emitted as `SPEECH_RECOGNIZED` (see `VOICE_RUNTIME_EVENTS.md`) and
   nothing further happens to it inside this module — no AI Brain call.
4. **Response ready** — `IVoiceManager.onVoiceResponseReady` (if
   connected) moves state to `'responding'`, then the runtime
   immediately calls `endVoiceSession()`.
5. **Ended** — either explicitly (`endVoiceSession()`), automatically
   after a voice response, as part of `stop()`'s graceful shutdown, or
   via timeout.

## Session Timeout

**Mechanism:** inactivity-based, not a fixed deadline (see
ADR-VOICE-003 in `VOICE_RUNTIME.md`). Every event that "touches" a
session — `SpeechStarted`, `SpeechFinished`, `SpeechRecognized`,
`VoiceResponseReady` — calls
`VoiceRuntimeManager`'s private `rescheduleSessionTimeout()`, which:

1. Updates `session.lastActivityAt = Date.now()`.
2. Clears any existing timeout timer for that session.
3. Schedules a new `setTimeout(() => timeoutSession(id), session.timeoutMs)`,
   marked `.unref()` so it never keeps the process alive on its own.

If no further activity touches the session before `timeoutMs` elapses,
`timeoutSession()` runs: state → `'timed-out'`, `endedAt` stamped,
`SESSION_ENDED` emitted with `reason: 'timeout'`, and the
`sessionsTimedOut` statistic increments.

**Configuring the timeout:** `AppConfig.voiceRuntime.defaultSessionTimeoutMs`
(env var `VOICE_RUNTIME_SESSION_TIMEOUT_MS`, default 30000). Every
session created without an explicit `timeoutMs` in `StartVoiceSessionOptions`
uses this value; `startVoiceSession()` doesn't currently expose a
per-call override in the public interface, since no caller in this
project needs a different timeout than the configured default — a
trivial addition if a future milestone needs one.

## Session Metadata

`IVoiceSessionMetadata` is a free-form `Record<string, unknown>`, exactly
like `AudioSession.metadata`. Nothing in this milestone writes to it
automatically — it exists for a future caller (e.g., a UI passing
`{ initiatedBy: 'manual-button' }` alongside a manually-started session).

## Runtime session APIs

```ts
const session = voiceRuntimeManager.startVoiceSession({
  audioSessionId: audioSession.id,
  language: 'en-US',
});

voiceRuntimeManager.getVoiceSession(session.id);
voiceRuntimeManager.listVoiceSessions();
voiceRuntimeManager.endVoiceSession(session.id); // idempotent
```

`endVoiceSession()` is intentionally idempotent — calling it twice on an
already-ended session simply returns the session unchanged rather than
throwing or double-counting statistics. This matters because a session
can legitimately be ended by more than one code path racing (e.g., a
timeout firing at nearly the same moment `VOICE_RESPONSE_READY` arrives)
— the first caller wins, the second is a no-op.
