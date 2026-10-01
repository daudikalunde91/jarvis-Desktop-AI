# JARVIS OS — Handover Audit & Current Baseline

## Baseline
This release is based on `JARVIS-M5-M9-BRAIN-AGENTS(2).zip` and preserves the M1-M4.0 architecture from `JARVIS-M3-M4-MERGED-FINAL.zip`.

## Current implemented layers
- M1 foundation: Electron, React/TypeScript, configuration, logging, database, IPC, lifecycle.
- M2 infrastructure: DI, event system, communication bus, capability registry, health monitor, agent manager.
- M3.1-M3.4: voice provider, speech-to-text, wake-word and audio pipeline architecture.
- M4.0: voice runtime framework.
- M5-M9 foundation: offline rules, task planner, action executor, system/file/browser/coding/memory agents, SQLite memory, permissions/risk policy and optional cloud-reasoner interface.

## Important gaps
- No real microphone/STT provider is bundled.
- No real wake-word model is bundled.
- No real TTS provider is bundled.
- Browser automation is only open/search, not DOM/computer-use automation.
- Coding agent is read/inspect/write/command foundation, not autonomous repo-level coding.
- Vision/camera production implementation is not present.
- Plugin system and advanced awareness are not implemented.
- Renderer remains a foundation shell; product HUD/voice-first command center is not finished.

## Corrections made in this release
1. Fixed project-root resolution in `AppBootstrapper` for both source/dev and compiled/dist execution.
2. Wired the existing M5-M9 Brain, agents, memory and permission layers into the real application composition root.
3. Wired SQLite-backed long-term memory initialization.
4. Registered a safe local-owner permission role (`admin`) in the desktop composition root; sensitive actions still require explicit confirmation.
5. Added Brain IPC and health IPC so the renderer can exercise the real Brain pipeline.
6. Corrected `MemoryManager.forgetAll()` so a disabled memory subsystem does not mutate storage.
7. Prevented `app.open`/`app.close` from treating arbitrary user strings as executable names; only known application profiles are launched.
8. Updated this handover documentation to distinguish implemented code from remaining placeholders.

## Validation note
Dependencies were not available in the audit runtime, so package-level TypeScript/Vitest execution could not be completed here. Static source inspection and dependency/wiring analysis were performed. The first local validation step is `npm install`, followed by `npm run typecheck`, `npm run test`, `npm run build`.
