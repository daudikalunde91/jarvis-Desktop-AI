# JARVIS — Desktop AI Assistant

JARVIS is a native Electron desktop assistant that combines local computer control with cloud AI reasoning. V7.2 RC2 (Stage 6) keeps the existing Electron/IPC/SQLite foundation and adds three more AI provider adapters (Groq, OpenRouter, Lovable AI Gateway), self-healing Gemini model selection, and quota-vs-rate-limit-aware provider health tracking, on top of everything V7.1 already had (model tool-calling, Windows computer awareness, dynamic application discovery, guarded file operations, Office document/presentation automation, screenshot capture).

## What is working in this build

- Native Electron desktop window + Vite renderer
- Node.js + TypeScript backend
- SQLite memory layer
- Six AI provider adapters — OpenAI, Gemini, Claude, Groq, OpenRouter, Lovable AI Gateway — with health tracking, capability-aware routing and automatic fallback (see [`docs/AI_PROVIDERS.md`](docs/AI_PROVIDERS.md))
- AI tool-calling loop with a bounded execution budget
- Permission/confirmation gate between AI and machine actions
- Detailed system telemetry and troubleshooting
- Windows Start-menu application discovery and launch
- File list/search/read/create/move/copy/rename/open capabilities
- Browser open/search capabilities
- Microsoft Word `.docx` creation on Windows when Word is installed
- Microsoft PowerPoint `.pptx` creation on Windows when PowerPoint is installed
- Windows primary-screen screenshot capture
- English/Swahili response guidance

## Still under development

- Always-listening microphone mode (intentionally absent — see [`docs/WAKE_WORD.md`](docs/WAKE_WORD.md))
- Production wake-word detection engine
- Real STT/TTS providers
- Multimodal image-to-AI reasoning
- Deep UI automation inside arbitrary desktop apps
- Full persistent application inventory/watch service
- Gmail/WhatsApp/Calendar/Drive/Outlook/OneDrive/Telegram/Discord OAuth integrations (scaffolding only — see [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md))

See [`docs/V7_2_RC2_RELEASE.md`](docs/V7_2_RC2_RELEASE.md) for this release's implementation report and limitations, or [`docs/V7_1_ARCHITECTURE_UPGRADE.md`](docs/V7_1_ARCHITECTURE_UPGRADE.md) for the prior one.

## Stack

Electron · React · TypeScript · Vite · Node.js · SQLite (`better-sqlite3`) · Zustand · TailwindCSS · Electron Builder · npm

## Quick start

```powershell
npm install
npm run doctor
npm run dev
```

Place your local secrets in the project-root `.env`. Never commit `.env`. Use `.env.example` only as a template.

## Useful scripts

| Command | Purpose |
|---|---|
| `npm run doctor` | Check Electron/native/config health |
| `npm run dev` | Start Vite + Electron desktop runtime |
| `npm run typecheck` | Type-check frontend + backend |
| `npm run build` | Build frontend + backend |
| `npm run test` | Run Vitest tests |
| `npm run rebuild:native` | Rebuild `better-sqlite3` for Electron |
| `npm run package` | Build and package with Electron Builder |

## AI provider configuration

Configure at least one provider to enable cloud reasoning. For real failover, configure two or more. Full details (why each default model was chosen, what "OpenAI-compatible" means for Groq/OpenRouter/Lovable, and how Gemini's model self-healing works) are in [`docs/AI_PROVIDERS.md`](docs/AI_PROVIDERS.md).

```dotenv
OPENAI_ENABLED=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

GEMINI_ENABLED=true
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash

CLAUDE_ENABLED=true
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6
# ANTHROPIC_WORKSPACE_ID=   # only for workspace-scoped gateways, see docs/AI_PROVIDERS.md

GROQ_ENABLED=true
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

LOVABLE_ENABLED=true
LOVABLE_API_KEY=
LOVABLE_MODEL=          # e.g. google/gemini-3.7-flash — see docs/AI_PROVIDERS.md

OPENROUTER_ENABLED=true
OPENROUTER_API_KEY=
OPENROUTER_MODEL=       # e.g. anthropic/claude-sonnet-4.6 — see docs/AI_PROVIDERS.md
```

The provider activation log should show `configured: true` for every provider whose key (and, for OpenRouter/Lovable, model) is actually set. A `429` on one provider is a provider/account quota or rate-limit problem; another provider can only take over when it is also configured and eligible — run `npm run doctor:ai` for a live per-provider check.

## Architecture

```text
User
  -> Brain
      -> Rules / Planner / Permission
      -> AI Orchestrator
          -> Provider Router / Fallback
          -> OpenAI / Gemini / Claude
          -> Tool Registry
              -> System / Files / Apps / Browser / Office / Vision / Coding
      -> Memory
      -> final explanation
```

The model chooses tools, but it never executes the OS operation itself. Tool execution remains in the Electron main process and passes through permission checks.

## Documentation

- [`docs/V7_2_RELEASE.md`](docs/V7_2_RELEASE.md) — this release: implemented, partial and remaining
- [`docs/AI_PROVIDERS.md`](docs/AI_PROVIDERS.md) — all six AI providers, routing, health/fallback, model discovery
- [`docs/MIGRATION.md`](docs/MIGRATION.md) — upgrading an existing V7.1 `.env`/install to V7.2
- [`docs/WAKE_WORD.md`](docs/WAKE_WORD.md) — standby voice architecture status
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — Gmail/WhatsApp/Calendar/etc. status
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — what's automated vs. manual, and how to run it
- [`docs/V7_1_ARCHITECTURE_UPGRADE.md`](docs/V7_1_ARCHITECTURE_UPGRADE.md) — prior upgrade: implemented, partial and remaining
- [`docs/JARVIS_ROADMAP.md`](docs/JARVIS_ROADMAP.md) — priority-based roadmap
- [`docs/MILESTONE_5_1_AI_BRAIN_ARCHITECTURE.md`](docs/MILESTONE_5_1_AI_BRAIN_ARCHITECTURE.md) — multi-provider AI design
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — core application architecture
- [`docs/DEV_RUNTIME_TROUBLESHOOTING.md`](docs/DEV_RUNTIME_TROUBLESHOOTING.md) — Electron/npm/native troubleshooting
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — cumulative changes

## Security rules

- API secrets stay in `.env` and never cross the renderer boundary.
- AI requests are limited to registered tools.
- Unknown actions are deny-by-default.
- Medium/high/sensitive actions require confirmation.
- File agents restrict operations to approved roots.
- Do not use `npm audit fix --force` while stabilizing the Electron/native dependency tree.

## Known release note

This ZIP (V7.2 / Stage 6) was implemented and statically type-checked (`tsc --noEmit`, scoped to the changed files, with a temporary `@types/node` stub since no dependencies are installed in this repo snapshot) in a sandboxed build environment with no network access — so `npm install`, `npm run build`, `npm run dev`, and every live provider API call described in this README were **not** executed there. See [`docs/V7_2_RC2_RELEASE.md`](docs/V7_2_RC2_RELEASE.md) for the exact list of what was and wasn't run, and validate on your target Windows PC before treating this as a release build.

## V7.1.1 startup fixes

The development launcher now probes for an available renderer port starting at `5173`. If `5173` is occupied by another process, JARVIS automatically uses the next available port and passes the matching renderer URL to Electron. This prevents the common `Port 5173 is already in use` startup failure.

Recommended first-run order:

```powershell
npm install
npm run bootstrap
# edit .env and add provider keys
npm run doctor
npm run dev
```

`npm run dev` also runs bootstrap automatically, so `npm run bootstrap` is safe but optional. `npm run doctor` only reports the current environment; it does not invent API keys.

If `npm run doctor` reports `better-sqlite3 in Electron: INCOMPATIBLE` immediately after `npm install`, run `npm run dev`; the launcher automatically rebuilds `better-sqlite3` for Electron ABI 125 when needed.

## Personal integrations (Stage 7)
Gmail and Google Calendar can be connected from the INTEGRATIONS panel after configuring `GOOGLE_CLIENT_ID` (see `docs/INTEGRATIONS.md`).
Diagnostics: `npm run doctor:integrations`. Drive/WhatsApp/Microsoft are **not implemented yet**.
