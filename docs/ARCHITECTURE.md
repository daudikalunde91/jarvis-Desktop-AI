# JARVIS — Architecture (Milestone 1: Project Foundation)

> This document covers the Milestone 1 foundation (Electron main-process
> wiring, config, logging, database, IPC transport). For the Core
> Infrastructure added in Milestone 2 (Communication Bus, Capability
> Registry, Agent Manager, Event System, Health Monitor, DI Container),
> see [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md) and
> [`DIAGRAMS.md`](./DIAGRAMS.md).

## Layering

```
Renderer (React)  <—— IPC (contextBridge) ——>  Main Process (Electron / Node)
                                                     |
                                     ConfigManager, Logger, DatabaseManager
                                                     |
                                              SQLite (better-sqlite3)
```

## Layering

```
Renderer (React)  <—— IPC (contextBridge) ——>  Main Process (Electron / Node)
                                                     |
                                     ConfigManager, Logger, DatabaseManager
                                                     |
                                              SQLite (better-sqlite3)
```

## Main-process responsibility split

`app/backend/src/main.ts` is intentionally a few lines: it constructs
`AppBootstrapper` and hands control to `AppLifecycle`. Each concern below
lives in exactly one file:

| Responsibility        | File                                   |
|------------------------|-----------------------------------------|
| Composition / wiring    | `bootstrap/AppBootstrapper.ts`         |
| Electron lifecycle events | `lifecycle/AppLifecycle.ts`          |
| Window creation         | `windows/WindowManager.ts`             |
| IPC registration        | `ipc/registerIpc.ts`                   |
| IPC transport           | `ipc/IpcRouter.ts`                     |
| Folder bootstrap        | `bootstrap/FolderBootstrap.ts`         |

`AppLifecycle` drives `AppBootstrapper` from the outside (calls `start()`,
`createWindow()`, `shutdown()`); `AppBootstrapper` never touches Electron's
`app` lifecycle events itself.

## Principles applied

- **Single Responsibility** — each class (ConfigManager, Logger,
  DatabaseManager, IpcRouter, WindowManager, FolderBootstrap,
  AppBootstrapper, AppLifecycle) owns exactly one concern.
- **Dependency Inversion** — high-level modules depend on interfaces
  (`ILogger`, `IConfigManager`, `IDatabaseManager`), not concrete classes.
  Transports (`ConsoleTransport`, `FileTransport`) are injected into
  `Logger`, not hardcoded.
- **Composition root** — `AppBootstrapper` is the *only* place that
  constructs concrete instances and wires them together. No subsystem
  reaches out to instantiate another.
- **Explicit configuration** — nothing is hardcoded, including the Vite
  dev server URL (`renderer.devServerUrl`). Precedence is
  `defaults -> config/app.config.json -> environment variables`.
- **Feature-based structure** — `app/brain`, `app/agents`,
  `app/communication`, `app/voice`, `app/vision`, `app/memory`,
  `app/awareness`, `app/security`, `app/plugins` are reserved as isolated
  feature modules for future milestones. Each contains only `README.md`,
  `index.ts`, and `types.ts` — no implementation.
- **Naming convention** — see [`CONVENTIONS.md`](./CONVENTIONS.md).

## IPC contract

All channel names live in `app/backend/src/ipc/channels.ts`. Handler
registration is centralized in `app/backend/src/ipc/registerIpc.ts` — the
single place new handler groups get added as the project grows. The
preload script (`app/backend/src/preload.ts`) exposes a narrow
`window.jarvis` API; the renderer never touches `ipcRenderer` or Node.js
directly (`contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`).

`IpcRouter` is transport only — it must never contain business, AI, or
agent logic. As of Milestone 2, a real Communication Bus exists (see
`docs/INFRASTRUCTURE.md`) at `app/backend/src/infrastructure/
communication-bus/`, separate from `IpcRouter` — the former routes
messages between in-process subscribers (agents, plugins, services), the
latter routes calls across the renderer/main process boundary. A future
milestone may bridge the two (e.g. exposing bus channels to the renderer
via IPC) by adding a handler group in `registerIpc.ts`, not by changing
`IpcRouter` itself. `IPC_NAMESPACE.COMMUNICATION` remains reserved
(declared, unused) for that bridge's channel prefix.

## Configuration & logging boundaries

- Only `ConfigManager` reads `config/app.config.json`. Every other module
  receives already-resolved `AppConfig` values through constructor
  injection (see `WindowManager`, `DatabaseManager`) — no module opens the
  config file itself.
- Only `Logger`'s transports (`ConsoleTransport`, `FileTransport`) call
  `console.*` / write to disk. The one accepted exception is
  `scripts/bootstrap.ts`, which runs before the app (and therefore before
  a `Logger` instance exists) to prepare `.env` and runtime folders.

## Milestone 2 addendum: Core Infrastructure

Milestone 2 added a `shared/` layer and an `infrastructure/` layer inside
`app/backend/src/`, wired into `AppBootstrapper` through a new `DIContainer`
step (between database connection and IPC registration). Full detail,
including per-module responsibilities and boundaries, lives in
[`docs/INFRASTRUCTURE.md`](./INFRASTRUCTURE.md); diagrams are in
[`docs/DIAGRAMS.md`](./DIAGRAMS.md). Nothing described in this file above
changed as a result — Milestone 2 only added a new step, it did not alter
the Milestone 1 composition order, IPC contract, or configuration/logging
boundaries.

## What is explicitly out of scope (both milestones so far)

No AI, LLM, STT/TTS, wake word, vision, memory persistence, Windows
control, browser control, coding-agent features, or automation of any
kind. No concrete agents or plugins exist. Every AI-feature placeholder
folder (`brain`, `voice`, `vision`, `memory`, `awareness`, `security`,
`plugins`) exists as a placeholder only.

## Personal Integrations (Stage 7)
`ToolRegistry → PermissionManager → IntegrationAgent → IntegrationManager → provider (Gmail/Calendar) → TokenManager → EncryptedFileCredentialStore (DPAPI)`.
OAuth and tokens never leave the main process. See `docs/INTEGRATIONS.md` and `docs/OAUTH_SECURITY.md`.
