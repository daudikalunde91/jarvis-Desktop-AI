# Milestone 3.2 — Speech-to-Text Architecture

> **Status:** architecture only. No transcription engine, no downloaded
> model, no external API call exists anywhere in this milestone.

## Purpose

A provider-independent architecture for speech recognition, allowing
future providers (Whisper.cpp, OpenAI Whisper, Google Speech-to-Text,
Azure Speech, Amazon Transcribe, Deepgram, Vosk, ...) to be plugged in
without changing anything above the provider boundary.

## Placement

`app/backend/src/speech-to-text/` — alongside `audio/`,
`voice-provider/`, and `wake-word/`.

```
speech-to-text/
├── types/            SupportedLanguage (first-class: en-US, sw-KE),
│                      SpeechSessionStatus, TranscriptionMode
├── errors/           SpeechError hierarchy
├── interfaces/       ISpeechProvider, ISpeechProviderRegistry, ISpeechProviderFactory
├── models/           SpeechSession, SpeechResult, SpeechChunk
├── SpeechProviderRegistry.ts
├── SpeechProviderFactory.ts
├── SpeechManager.ts   ← implements Milestone 4.0's ISpeechManager
└── tokens.ts
```

## Responsibilities

| Requirement | Delivered as |
|---|---|
| Speech Manager | `SpeechManager` |
| Speech Provider interface | `ISpeechProvider` |
| Speech Provider Registry | `ISpeechProviderRegistry` / `SpeechProviderRegistry` |
| Speech Provider Factory | `ISpeechProviderFactory` / `SpeechProviderFactory` |
| Speech Session | `SpeechSession` |
| Speech Result | `SpeechResult` |
| Speech Chunk | `SpeechChunk` |
| Speech Metadata | `SpeechResult.language` / `SpeechSession` fields |
| Confidence | `SpeechResult.confidence: number \| null` |
| Language | `SpeechSession.language`, `SupportedLanguage` |
| Provider Capabilities | `SpeechProviderCapabilities` |
| Provider Status / Health | `ModuleStatus` (reused, not duplicated) via `ISpeechProvider.healthCheck()` |

## The Milestone 4.0 integration boundary

Same pattern as M3.1/M3.3: Milestone 4.0's `ISpeechManager` (in
`voice-runtime/interfaces/ISpeechManager.ts`, **untouched**) is the
runtime-facing contract:

```ts
interface ISpeechManager extends IHealthCheckable {
  startRecognition(sessionId: string): void | Promise<void>;
  stopRecognition(sessionId: string): void | Promise<void>;
  onSpeechStarted(handler: (sessionId: string) => void): () => void;
  onSpeechFinished(handler: (sessionId: string) => void): () => void;
  onSpeechRecognized(handler: (event: SpeechRecognizedEvent) => void): () => void;
}
```

`speech-to-text/SpeechManager.ts` is the concrete class that implements
it, backed by the richer M3.2 registry/session/result architecture. One
`SpeechManager` class exists in the project — no duplicate.

**How partial vs. final results become the M4.0 event trio:**
`SpeechManager` subscribes to a registered provider's
`onPartialResult`/`onFinalResult`. The *first* partial result for a
session fires `onSpeechStarted`; a final result fires
`onSpeechRecognized` (mapped to M4.0's `SpeechRecognizedEvent`) followed
immediately by `onSpeechFinished`. No result is ever forwarded to
anything beyond the registered M4.0 handlers — in particular, nothing
here calls an AI Brain (none exists).

## Swahili is first-class

`speech-to-text/types/SupportedLanguage.ts`:

```ts
export const FIRST_CLASS_LANGUAGES = ['en-US', 'sw-KE'] as const;
```

Swahili (`sw-KE`) sits alongside English (`en-US`) as an explicitly
validated, first-class language from the start — not retrofitted. Every
language-bearing field (`SpeechSession.language`, `SpeechResult.language`,
`SpeechProviderCapabilities.languages`) is typed as a plain `string`, so
any other BCP-47 code is still structurally accepted; `FIRST_CLASS_LANGUAGES`
documents what the architecture is validated against, not a hard
allowlist that would block future multilingual expansion.

`AppConfig.speechToText.supportedLanguages` defaults to
`['en-US', 'sw-KE']` and `.autoDetectLanguage` is a first-class
configuration switch (see below) — both are schema present from day one.

## Streaming, partial/final, and auto-detection

- `TranscriptionMode` (`'streaming' | 'batch'`) is part of
  `SpeechProviderCapabilities.supportsStreaming` — the architecture
  supports either.
- `SpeechResult.isFinal: boolean` distinguishes a partial from a final
  transcription — the same type serves both, differentiated by this
  flag, avoiding two near-duplicate result types.
- `SpeechSession.autoDetectLanguage: boolean` plus
  `AppConfig.speechToText.autoDetectLanguage` prepare automatic
  language detection as a first-class, configurable behavior. No
  detection algorithm is implemented — a future provider would set
  `SpeechResult.language` based on what it detected.

## Offline + cloud + fallback preparation

Mirrors M3.1: `SpeechProviderCapabilities.supportsOffline`, a registry
that can hold multiple providers simultaneously, and
`SpeechManager.setActiveProvider(id)` as the (currently unused)
selection point for a future fallback strategy.

## Audio Pipeline integration point

`SpeechManager` optionally subscribes to the **existing**
`AudioRouter.onSpeechData()` channel (Milestone 3.4) — dormant, since
nothing publishes to it without real microphone capture. This is the
same "reserved existing channel" pattern `WakeWordManager` uses for
`onWakeWordData`.

## Privacy notes

`SpeechChunk` deliberately does not redefine an audio payload/format —
real audio bytes conceptually arrive via the Audio Pipeline's
`AudioRouter`, never duplicated or persisted here. `SpeechSession` holds
no transcript text permanently; transcripts flow through `SpeechResult`
events only, exactly like `AudioSession` and `VoiceSession` hold no
audio payload.

## What is explicitly NOT implemented

No provider SDK, no external API call, no downloaded model, no real
speech recognition. `ISpeechProvider` has zero concrete implementations
anywhere in this project.
