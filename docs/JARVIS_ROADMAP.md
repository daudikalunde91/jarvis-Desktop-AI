# JARVIS Roadmap — V7.2 and Beyond

## Current position

JARVIS has moved beyond the foundation stage. The current runtime contains an Electron desktop shell, SQLite memory, rules/planning, permission controls, multi-provider AI orchestration across six providers (OpenAI, Gemini, Claude, Groq, OpenRouter, Lovable AI Gateway — see `docs/AI_PROVIDERS.md`), AI tool calling, Windows system awareness, application discovery, file operations, browser actions, Office document/presentation creation, and screenshot capture.

## Priority 1 — High

1. ~~Configure at least two real cloud providers so rate-limit failover can be tested end to end.~~ V7.2 makes this easier — six provider adapters now exist, so any two API keys are enough. Still needs an actual end-to-end run on a real machine (see `docs/V7_2_RELEASE.md`, "Tests performed").
2. Complete multimodal input so screenshots/images can be sent to vision-capable providers.
3. Expand Windows system diagnostics with startup programs, services, GPU data, network state, and richer hardware sensors.
4. Add robust tool-result schemas so the model receives structured telemetry rather than only human-readable strings.
5. Add regression tests for tool loops, confirmation, provider fallback, and Windows-agent parameter validation.

## Priority 2 — Medium

1. Windows UI Automation for interacting with applications after launch.
2. More complete Office workflows: multi-slide PowerPoint generation, Word styling, save-as PDF, Excel workbook creation.
3. File organization planner with preview/dry-run, confirmation, execution, and post-action verification.
4. Persistent application inventory and change detection after software installation.
5. Memory-aware personalization and user preferences.

## Priority 3 — Low / future polish

1. Real wake-word standby listening.
2. Production-grade STT/TTS with English + Swahili switching.
3. Vision overlays and HUD activity timeline.
4. Plugin SDK and sandboxing.
5. Installer signing, auto-update, crash diagnostics, and performance profiling.

## Non-negotiable architecture rules

- Electron main process remains the authority for machine actions.
- Renderer never receives provider API secrets.
- AI models never execute commands directly.
- Every action is permission checked.
- Destructive actions require confirmation.
- File operations remain path-guarded.
- Provider adapters remain vendor-agnostic at the orchestration boundary.
- npm remains the package manager for this project.

## Stage 7 status
Delivery 1 done: foundation, Gmail, Calendar (IMPLEMENTED, live-unverified). Delivery 2 pending: Drive, WhatsApp Cloud API, Microsoft Graph (Outlook/OneDrive), Telegram/Discord boundaries.
Next stages unchanged: 8 native voice, 9 vision, 10 autonomous agent, 11 adaptive assistant, 12 local/offline AI.
