# Milestone 3.1 — Voice Provider Architecture

> **Status:** architecture only. No Text-to-Speech engine, no provider
> SDK, no downloaded voice model, no external API call exists anywhere
> in this milestone.

## Purpose

A provider-independent architecture for JARVIS voice output (TTS),
allowing future providers (OpenAI TTS, ElevenLabs, Microsoft Azure
Speech, Google Cloud TTS, Amazon Polly, Piper, Kokoro, ...) to be
plugged in without changing anything above the provider boundary.

## Placement

`app/backend/src/voice-provider/` — alongside `audio/`,
`speech-to-text/`, and `wake-word/`, following the precedent set in
Milestone 2 (`infrastructure/`) and Milestone 3.4 (`audio/`). `app/voice/`
remains the untouched Milestone 1 placeholder.

```
voice-provider/
├── types/            VoiceGender, VoiceDeploymentMode
├── errors/           VoiceProviderBaseError hierarchy
├── interfaces/       IVoiceProvider, IVoiceProviderRegistry, IVoiceProviderFactory
├── models/           VoiceProfile (includes VoiceMetadata)
├── VoiceProviderRegistry.ts
├── VoiceProviderFactory.ts
├── VoiceManager.ts    ← implements Milestone 4.0's IVoiceManager
└── tokens.ts
```

## Responsibilities

| Requirement | Delivered as |
|---|---|
| Voice Manager | `VoiceManager` |
| Voice Provider interface | `IVoiceProvider` |
| Voice Provider Registry | `IVoiceProviderRegistry` / `VoiceProviderRegistry` |
| Voice Provider Factory | `IVoiceProviderFactory` / `VoiceProviderFactory` |
| Voice Profile | `VoiceProfile` |
| Voice Configuration | `AppConfig.voiceProvider` |
| Voice Capabilities | `VoiceCapabilities` (on `IVoiceProvider.getCapabilities()`) |
| Voice Metadata | `VoiceMetadata` (on `VoiceProfile.metadata`) |
| Provider Status / Health | `ModuleStatus` (shared type, reused — not duplicated) via `IVoiceProvider.healthCheck()` |

## The Milestone 4.0 integration boundary

Milestone 4.0 (Voice Runtime Framework) already defines a thin,
runtime-facing contract:

```ts
interface IVoiceManager extends IHealthCheckable {
  speak(sessionId: string, text: string): void | Promise<void>;
  cancel(sessionId: string): void | Promise<void>;
  onVoiceResponseReady(handler: (event: VoiceResponseReadyEvent) => void): () => void;
}
```

**This file (`voice-runtime/interfaces/IVoiceManager.ts`) was not
touched.** `voice-provider/VoiceManager.ts` is the concrete class that
*implements* it — internally backed by the richer M3.1 architecture
(registry + factory + profile + capabilities). This is the integration
boundary: M4.0 defines what the runtime needs; M3.1 provides the real
implementation underneath. There is exactly one `VoiceManager` class in
the project — no duplicate, no second "voice manager" concept.

`AppBootstrapper.ts` wires them together (the only place a compatibility
change was needed — see `MILESTONE_MERGE_CHANGELOG.md`):

```ts
new VoiceManager(logger, voiceProviderRegistry, defaultProfile, audioRouter)
// ...
new VoiceRuntimeManager(logger, { ..., voiceManager: theVoiceManagerAbove }, config)
```

## Default JARVIS voice

`VoiceProfile`'s constructor defaults to:

- `gender: 'female'`
- `styleTags: ['natural', 'calm', 'professional', 'friendly', 'clear']`

This is the agreed default — but it is data on a `VoiceProfile`
instance, not a hardcoded provider or string baked into `VoiceManager`.
Swapping the default is a configuration change
(`AppConfig.voiceProvider.defaultGender` / `defaultLanguage`), and a
future milestone can register any number of alternative `VoiceProfile`s.

## Offline + cloud preparation

- `VoiceDeploymentMode` (`'offline' | 'cloud' | 'hybrid'`) is part of
  every provider's declared `VoiceCapabilities` — a registry consumer
  can filter/select providers by deployment mode.
- `AppConfig.voiceProvider.fallbackEnabled` and `.preferredProviderId`
  exist so a future milestone can implement "prefer offline, fall back
  to cloud if unavailable" logic — no such logic is implemented here;
  the config keys exist so the *shape* of that decision doesn't require
  a schema change later.
- `VoiceProviderRegistry` can hold any number of providers
  simultaneously; `VoiceManager.setActiveProvider(id)` is how a future
  fallback/selection strategy would switch between them. No selection
  strategy is implemented — `VoiceManager` never picks a provider on
  its own.

## Audio Pipeline integration point

When a registered provider's synthesis completes, `VoiceManager`
publishes a structural marker chunk through the **existing**
`AudioRouter.routeTTSOutput()` (Milestone 3.4) — the dedicated route the
Audio Pipeline already reserved for this. The chunk's `payload` is an
empty `Uint8Array`; no audio bytes are fabricated. This proves the wiring
point exists for a future speaker-output stage without pretending any
synthesis actually occurred. Since no provider is registered anywhere in
this project, this code path is dormant.

## Privacy & security notes

- No voice sample, audio recording, or biometric data is stored,
  transmitted, or processed anywhere in this milestone.
- `VoiceProfile` and `VoiceMetadata` are pure configuration/descriptive
  data — no personal data fields exist on either.

## Performance notes

Registry and factory operations are O(1)/O(n) in-memory map operations;
no polling, no background timers. `VoiceManager.speak()` with no active
provider returns immediately (a no-op), which is the correct behavior
for a low-resource target (see MILESTONE_3_3_WAKE_WORD_ARCHITECTURE.md
for the shared hardware-constraint discussion).

## What is explicitly NOT implemented

No provider SDK, no external API call, no downloaded voice model, no
real speech synthesis, no audio output. `IVoiceProvider` has zero
concrete implementations anywhere in this project.
