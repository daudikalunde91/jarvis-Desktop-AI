# Milestone 3.3 — Wake Word Architecture

> **Status:** architecture only. No wake-word detection model, no
> hardware access, no voice biometrics exists anywhere in this
> milestone.

## Purpose

A provider-independent architecture for wake-word detection, allowing
future providers to be plugged in without changing anything above the
provider boundary.

## Placement

`app/backend/src/wake-word/` — alongside `audio/`, `speech-to-text/`,
and `voice-provider/`.

```
wake-word/
├── types/            DetectionState, SecureWakeLevel
├── errors/           WakeWordError hierarchy
├── interfaces/       IWakeWordProvider, IWakeWordProviderRegistry,
│                      IWakeWordProviderFactory, ITrustedVoiceVerifier
├── models/           WakeWordProfile
├── WakeWordProviderRegistry.ts
├── WakeWordProviderFactory.ts
├── WakeWordManager.ts  ← implements Milestone 4.0's IWakeWordManager
└── tokens.ts
```

## Responsibilities

| Requirement | Delivered as |
|---|---|
| Wake Word Manager | `WakeWordManager` |
| Wake Word Provider interface | `IWakeWordProvider` |
| Wake Word Registry | `IWakeWordProviderRegistry` / `WakeWordProviderRegistry` |
| Wake Word Factory | `IWakeWordProviderFactory` / `WakeWordProviderFactory` |
| Wake Word Profile | `WakeWordProfile` |
| Wake Word Configuration | `AppConfig.wakeWord` |
| Wake Word Capabilities | `WakeWordCapabilities` |
| Wake Word Metadata | `WakeWordProfile` fields (name, phrase, style) |
| Detection State | `DetectionState` |
| Provider Status / Health | `ModuleStatus` (reused, not duplicated) via `IWakeWordProvider.healthCheck()` |

## The Milestone 4.0 integration boundary

Milestone 4.0's `IWakeWordManager` (in
`voice-runtime/interfaces/IWakeWordManager.ts`, **untouched**):

```ts
interface IWakeWordManager extends IHealthCheckable {
  startListening(): void | Promise<void>;
  stopListening(): void | Promise<void>;
  onWakeWordDetected(handler: (event: WakeWordDetectedEvent) => void): () => void;
}
```

`wake-word/WakeWordManager.ts` is the concrete class that implements it,
backed by the richer M3.3 registry/profile/detection-state architecture.
One `WakeWordManager` class exists in the project — no duplicate, no
second wake-word manager concept, and `WakeWordDetectedEvent` (the M4.0
event payload shape) is imported and reused as-is, never redefined.

`AppBootstrapper.ts` is the only file that changed to wire this — it now
constructs a real `WakeWordManager` and passes it into
`VoiceRuntimeManager`'s already-optional `wakeWordManager` dependency
(see `MILESTONE_MERGE_CHANGELOG.md`).

## Default wake word & configurability

`WakeWordProfile` defaults `wakeWordPhrase` to `"Jarvis"`. Every field is
just data on a profile instance — `AppBootstrapper` builds this profile
from `AppConfig.wakeWord.defaultWakeWord`, so switching to "Friday",
"Nova", or any custom phrase is a configuration change, never a code
change:

```ts
new WakeWordProfile({ wakeWordPhrase: 'Friday' }); // exercised in tests
```

## Low-resource hardware preparation

Target hardware (Intel i3, 8GB RAM, Windows 10, SSD) is respected
structurally:

- **No background polling of its own.** `WakeWordManager` has no timer
  loop — health is checked only when the *existing* Health Monitor
  (Milestone 2) polls it, and detection is entirely event-driven
  (provider → `onDetected` → forwarded handlers).
- **Adjustable sensitivity & confidence threshold** —
  `WakeWordProfile.sensitivity` / `.confidenceThreshold`
  (`AppConfig.wakeWord.sensitivity` / `.confidenceThreshold`), validated
  to the `[0, 1]` range at construction.
- **Cooldown / false-trigger protection** — `WakeWordProfile.cooldownMs`
  (default 1500ms): after a forwarded detection, further detections are
  ignored until the cooldown elapses (`detectionState` becomes
  `'cooldown'`, verified by `wake-word.test.ts`).
- **Confidence-based noise tolerance** — a provider-reported
  `confidence` below `confidenceThreshold` is silently ignored before it
  ever reaches Milestone 4.0's handlers.

None of this requires a real detection model to demonstrate — the tests
simulate a fake provider emitting detections with varying confidence and
timing to prove the filtering logic works.

## Secure Wake Mode (architecture prep only)

- `SecureWakeLevel` (`'standard' | 'elevated' | 'critical'`) is a field
  on every `WakeWordProfile`.
- `ITrustedVoiceVerifier` is a contract for a future voice-identity
  verifier (`verify(request): Promise<VoiceVerificationResult>`).
  `WakeWordManager` accepts one as an optional constructor dependency
  (`getSecureWakeVerifier()`) and **never calls it** — no biometric
  verification logic exists anywhere in this project. This is
  structurally identical to how `wakeWordManager`/`speechManager`/
  `voiceManager` were optional, unused dependencies on
  `VoiceRuntimeManager` before this milestone connected real ones.

## Audio Pipeline integration point

`WakeWordManager` optionally subscribes to the **existing**
`AudioRouter.onWakeWordData()` channel (Milestone 3.4) — the dedicated
route the Audio Pipeline already reserved for this exact purpose.
Nothing publishes to it yet (no microphone capture exists), so the
subscription is dormant; it proves the wiring point without fabricating
audio flow.

## What is explicitly NOT implemented

No wake-word detection model, no hardware/microphone access, no voice
biometrics, no real Secure Wake verification. `IWakeWordProvider` has
zero concrete implementations anywhere in this project.
