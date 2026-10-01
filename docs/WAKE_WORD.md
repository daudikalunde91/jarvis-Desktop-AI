# Standby Voice / Wake-Word Architecture — Status (V7.2)

**No microphone button exists in the JARVIS UI, and V7.2 does not add
one.** This is a hard requirement carried forward from Stage 6's spec
and was already true going into this stage — confirmed by inspection
(`app/frontend/src` has no microphone/push-to-talk component).

## What actually exists today

The full provider-independent architecture for standby listening +
wake-word detection + STT already exists as of Milestone 3.1–3.3 and
Milestone 4.0, unchanged by V7.2:

- `app/backend/src/audio/` — audio capture/routing
- `app/backend/src/voice-provider/` — voice provider abstraction
- `app/backend/src/speech-to-text/` — STT provider abstraction
- `app/backend/src/wake-word/` — wake-word manager/registry/factory
  (see `docs/MILESTONE_3_3_WAKE_WORD_ARCHITECTURE.md` for the full
  module breakdown)
- `app/backend/src/voice-runtime/` — the Milestone 4.0 orchestration
  layer that wires the above into `StandbyListener`-style state
  (standby → listening → thinking → responding)

Every one of these modules is explicit, in its own header comment,
about being **architecture only**: interfaces, registries, and state
machines exist; no actual wake-word detection model, no STT/TTS
engine, and no microphone hardware access is wired in anywhere. This
was true before V7.2 and remains true after it — V7.2's scope was the
AI provider layer (see `docs/AI_PROVIDERS.md`), and touching the voice
stack was out of scope for this pass specifically to avoid destabilizing
something that already works as designed.

## What is testable right now

- The activity/thinking UI states (`STANDBY`, `Listening for
  "Jarvis"...`, thinking/executing/responding) render correctly from
  the frontend state machine, driven by manual/text input — there is
  no live audio path to exercise them from a real wake word yet.
- The voice-runtime, wake-word, speech-to-text, and voice-provider test
  suites (`tests/voice-runtime/`, `tests/wake-word/`,
  `tests/speech-to-text/`, `tests/voice-provider/`) exercise the state
  machines and interfaces against fakes/mocks — not real audio.
- There is nothing to "say to JARVIS" yet — no engine is listening.

## What is NOT implemented

- Actual microphone capture wired to a real audio pipeline.
- A real wake-word detection engine (openWakeWord, Porcupine, or
  otherwise) — only the `IWakeWordProvider` interface + registry exist.
- Real STT (speech → text) or TTS (text → speech) engines.
- Barge-in/interruption handling.

## Where this goes next

This is explicitly **Stage 8 — Full Native Voice** in
`docs/JARVIS_ROADMAP.md` / the master Stage 6 prompt's roadmap section,
not V7.2. Wiring a real wake-word engine in is a meaningfully sized,
separate effort (model selection, Windows mic permission handling,
always-on process lifecycle) and shouldn't be rushed into a stage whose
actual focus is the AI provider layer.
