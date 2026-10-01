# Audio Routing Guide

How `AudioRouter` moves audio data between pipeline participants, and how
to add a new route.

## Why a router exists at all

`AudioManager` orchestrates *stages* (a fixed, ordered pipeline). Not
every consumer of audio data is a stage, though — a future wake-word
detector, STT engine, or a debugging/monitoring tool all want to
*observe* chunks without being wired into the stage chain itself.
`AudioRouter` is the publish/subscribe layer for that: anything can
`on*` a route without `AudioManager` knowing it exists.

## The five required routes

| Method | Channel | Typical subscriber (future milestone) |
|---|---|---|
| `routeMicrophoneData(chunk)` | `audio.route.microphone` | Anything downstream of raw capture |
| `routeWakeWordData(chunk)` | `audio.route.wake-word` | A wake-word detection engine |
| `routeSpeechData(chunk)` | `audio.route.speech-to-text` | An STT engine |
| `routeTTSOutput(chunk)` | `audio.route.tts-output` | The speaker-output stage |
| `routeMonitoringData(chunk)` | `audio.route.monitoring` | Diagnostics/telemetry, dev tools |

Each has a matching subscription method: `onMicrophoneData`,
`onWakeWordData`, `onSpeechData`, `onTTSOutput`, `onMonitoringData`. All
five return an unsubscribe function, the same convention `IEventSystem`
and `ICommunicationBus` already use.

```ts
const unsubscribe = audioRouter.onWakeWordData((chunk) => {
  // A future wake-word engine would inspect chunk.payload here.
  // Nothing in this milestone does.
});

audioRouter.routeWakeWordData(chunk); // delivered asynchronously (next microtask)

unsubscribe();
```

## How it's implemented

`AudioRouter` holds **no queue, no subscriber map, no dispatch loop of
its own**. Every method is a one-line call into the existing
`IEventSystem`:

```ts
routeWakeWordData(chunk: IAudioChunk): void {
  this.route(AUDIO_CHANNELS.WAKE_WORD, chunk);
}

route(channel: string, chunk: IAudioChunk): void {
  this.eventSystem.emit({
    name: channel,
    category: 'internal',
    priority: 'normal',
    timestamp: Date.now(),
    payload: chunk,
  });
}
```

This means every guarantee the Event System already provides — same-tick
priority ordering, per-handler error isolation (one throwing subscriber
never breaks another), microtask-scheduled delivery — applies to audio
routing for free, and is already covered by Milestone 2's 38 passing
tests. `AudioRouter` adds nothing to that dispatch mechanism; it only
gives the five data flows memorable names and a stable `IAudioRouter`
contract to depend on.

## Adding a future routing rule

The spec asks for the router to "support future routing rules" without
saying what they'll be — correctly, since no concrete rule (e.g.,
"duplicate wake-word audio to a debug recorder") is in scope yet.
`addRoute`/`route` are the open extension point:

```ts
const unsubscribe = audioRouter.addRoute('audio.route.debug-tap', (chunk) => {
  // future debugging consumer
});

audioRouter.route('audio.route.debug-tap', chunk);
```

Any string channel name works — `AUDIO_CHANNELS` documents the five the
milestone requires, but nothing enforces routing only through that enum.
A future milestone that needs a *stable, shared* channel name should add
it to `audio/channels/audioChannels.ts` rather than inlining a string
everywhere it's used, mirroring how `ipc/channels.ts` and
`shared/events/systemEvents.ts` are the single source of truth for their
respective names.

## What AudioRouter deliberately does not do

- **No payload inspection.** `route()` validates only that
  `chunk.metadata` exists (so a malformed chunk fails loudly instead of
  silently) — it never looks at `chunk.payload` or makes routing
  decisions based on audio content. That would be business/AI logic,
  explicitly out of scope.
- **No request/response.** All five routes are fire-and-forget. If a
  future milestone needs "route this chunk and wait for a
  transcription," that belongs on `ICommunicationBus.sendCommand`, not
  here (see ADR-AUDIO-001 in `AUDIO_PIPELINE_ARCHITECTURE.md`).
- **No persistence.** Routed chunks are never written to disk by the
  router — see `AUDIO_SESSION_GUIDE.md` for the privacy guarantees that
  apply pipeline-wide.
