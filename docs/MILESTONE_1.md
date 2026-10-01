# Milestone 1 — Project Foundation

## Scope

This milestone delivers the **project foundation only**: a working,
production-grade Electron + React + TypeScript skeleton with no AI
features whatsoever.

## Delivered

- Electron main process, split by responsibility:
  - `app/backend/src/main.ts` — minimal entry point
  - `app/backend/src/bootstrap/AppBootstrapper.ts` — composition root
  - `app/backend/src/lifecycle/AppLifecycle.ts` — Electron lifecycle events
  - `app/backend/src/windows/WindowManager.ts` — window creation
  - `app/backend/src/ipc/registerIpc.ts` — IPC handler registration
- React + Vite + TypeScript renderer (`app/frontend`) styled with
  TailwindCSS, state managed with Zustand.
- Secure IPC bridge: `contextBridge` preload -> typed `window.jarvis` API
  -> `IpcRouter` (transport only) -> `registerIpc.ts` -> handler functions.
- SQLite initialization via `better-sqlite3`, wrapped by
  `DatabaseManager` (WAL mode, foreign keys on, no schema yet).
- Configuration Manager (`ConfigManager`) merging defaults,
  `config/app.config.json`, and environment variables — including the
  renderer dev-server URL, so no runtime value is hardcoded.
- Logging Manager (`Logger`) with pluggable console/file transports.
- Centralized error handling (`AppError` hierarchy + `ErrorHandler`,
  global `uncaughtException` / `unhandledRejection` hooks).
- Folder bootstrap (`FolderBootstrap` + `scripts/bootstrap.ts`) ensuring
  `config/`, `database/`, `logs/`, `assets/` exist at runtime.
- Full tooling: TypeScript (strict, path aliases), ESLint, Prettier,
  EditorConfig, `.gitignore`, `.env.example`, Vitest smoke tests,
  electron-builder configuration.
- Placeholder structure for every future subsystem: `brain`, `agents`,
  `communication`, `voice`, `vision`, `memory`, `awareness`, `security`,
  `plugins` — each with `README.md`, `index.ts`, and `types.ts`.
- Documented conventions: [`docs/CONVENTIONS.md`](./CONVENTIONS.md).

## Explicitly NOT delivered (by design)

No voice, memory, vision, agents, automation, or any AI/LLM integration.

## Getting started

```bash
npm install
npm bootstrap      # creates config/, database/, logs/, assets/, and .env
npm dev            # starts the Vite dev server + Electron together
```

Production build:

```bash
npm build          # type-checks and builds frontend + backend
npm package        # produces installers via electron-builder
```

Quality checks:

```bash
npm lint
npm format
npm typecheck
npm test
```

## Next milestone

Milestone 2 begins implementation inside one of the placeholder feature
modules (e.g. `memory` or `voice`) — not before this foundation is
reviewed and accepted.
