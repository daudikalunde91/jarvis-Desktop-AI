# Audio Session Guide

What an `AudioSession` is, its full field reference, its lifecycle, and
the privacy guarantees built around it.

## What it is — and isn't

An `AudioSession` represents one end-to-end audio interaction: which
devices were involved, what language was configured, when it started
and ended, and how it went. **It never holds audio data.** There is no
field on `IAudioSession` or `AudioSession` capable of storing a payload,
buffer, or recording — audio chunks flow through `AudioBufferQueue`
(bounded, in-memory, cleared on session end) and are never attached to
the session object itself.

## Field reference

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Generated via `generateId()` (the same correlation-ID generator Milestone 2 uses) |
| `inputDeviceId` | `string \| null` | References an `IAudioDevice.id`; `null` if unspecified |
| `outputDeviceId` | `string \| null` | Same, for output |
| `language` | `string` | Defaults to `'en-US'`; sourced from `StartSessionOptions.language` |
| `startTime` | `number` | `Date.now()` at construction |
| `endTime` | `number \| null` | Set once, when the session ends |
| `latencyMs` | `number \| null` | `endTime - startTime`, computed on end |
| `status` | `AudioSessionStatus` | `'idle' \| 'starting' \| 'active' \| 'ending' \| 'ended' \| 'failed'` |
| `metadata` | `Record<string, unknown>` | Free-form; `AudioManager`/`AudioSession.fail()` may add entries like `failureReason` |

## Lifecycle

```
idle → starting → active → ending → ended
                       ↘ failed
```

`AudioManager` drives this:

1. `startSession(options)` — asks `IAudioFactory.createSession()` for a
   new `AudioSession` (status `starting`), allocates a per-session
   `AudioBufferQueue`, sets status to `active`, emits
   `AUDIO_EVENTS.SESSION_STARTED`.
2. `processChunk(chunk)` — pushes the chunk into that session's buffer,
   then runs it through the registered pipeline stages.
3. `endSession(sessionId)` — sets `status = 'ended'`, stamps `endTime`,
   computes `latencyMs`, **clears and discards the session's buffer**,
   records the latency sample, emits `AUDIO_EVENTS.SESSION_ENDED`.

A session can also transition directly to `failed` (via
`AudioSession.fail(reason)`, which stamps `endTime` and records
`metadata.failureReason`) — for example if a future provider's capture
attempt errors before any audio flows.

## Session Control

"Session Control" in the pipeline spec maps to exactly the four
`AudioManager` methods above: `startSession`, `endSession`, `getSession`,
`listSessions`. There is deliberately no separate `AudioSessionManager`
class — session control is a responsibility of `AudioManager`, per the
spec's own "Session lifecycle" bullet under **AUDIO MANAGER**.

`AudioManager.startSession()` also enforces
`AppConfig.audio.maxConcurrentSessions`, throwing `AudioSessionError` if
the limit is reached — the one piece of "business rule" this milestone
does encode, and it's a resource-limiting rule about the architecture
itself, not anything about audio content.

## Privacy guarantees

1. **No field can hold a payload.** `IAudioSession` has no `payload`,
   `buffer`, or `recording` property — structurally impossible to smuggle
   audio data into a session record.
2. **Per-session buffers are bounded.** `AudioBufferQueue` evicts the
   oldest chunk once it exceeds `AppConfig.audio.bufferCapacity` — it
   never grows unbounded even mid-session.
3. **Buffers are cleared on session end.** `AudioManager.endSession()`
   calls `buffer.clear()` before deleting its reference — by the time a
   caller receives the "ended" session, no audio for it remains in
   process memory.
4. **Buffers are cleared on manager disposal.** `AudioManager.dispose()`
   clears every remaining session buffer, so shutting down the app (or
   the audio subsystem) leaves nothing buffered.
5. **Nothing is written to disk.** No file, no database table, no log
   line contains chunk payloads — `Logger` calls throughout `audio/`
   only ever log metadata (`sessionId`, `sequence`, device IDs, stage
   names), never `chunk.payload`.

These five points are the entirety of "Prepare privacy controls" for
this milestone — there is no persistent storage of audio to control,
by construction.

## Using AudioFactory instead of `new AudioSession()`

`AudioManager` depends on `IAudioFactory`, never on the concrete
`AudioSession` class:

```ts
class AudioManager {
  constructor(
    private readonly logger: ILogger,
    private readonly factory: IAudioFactory, // not AudioFactory
    // ...
  ) {}

  startSession(options: StartSessionOptions = {}): IAudioSession {
    const session = this.factory.createSession(options);
    // ...
  }
}
```

This is the same Dependency Inversion pattern used throughout the
project (`AgentManager` depends on `IHealthMonitor`, not `HealthMonitor`;
`WindowManager` depends on `AppConfig`, not a concrete config loader). A
future milestone could swap in a different `IAudioFactory` (e.g., one
that pools sessions, or attaches provider-specific defaults) without
changing a line of `AudioManager`.
