# Foundation Alignment Report

Scope: alignment only, per the approved architecture checklist. No
redesign, no Milestone 2 work. Every change below is either a **move**
(existing code relocated, behavior unchanged), an **addition**
(placeholder/documentation), or a **targeted fix** (one hardcoded value).
Nothing was rewritten wholesale. The full pipeline
(`npm run typecheck && npm run lint && npm run test && npm run build`) was re-run
after these changes and passes cleanly.

---

### 1. Project Folder Alignment — verified, no change

Reviewed the existing tree against the approved root architecture:
`app/{frontend,backend,brain,agents,communication,voice,vision,memory,
awareness,security,plugins}` plus root-level `config/`, `database/`,
`logs/`, `assets/`, `scripts/`, `tests/`, `docs/`. This already matched
exactly. No folders were moved, renamed, or nested differently.

### 2. Placeholder Standardization — added `types.ts` to every future module

Every one of the 9 reserved modules (`brain`, `agents`, `communication`,
`voice`, `vision`, `memory`, `awareness`, `security`, `plugins`) now
contains exactly three files: `README.md`, `index.ts`, `types.ts`
(interface placeholder, `export {}`, documented as reserved for the
module's own milestone). READMEs were updated to state this standard
explicitly so it's self-enforcing going forward. No logic was added.

### 3. Electron Separation — split `main.ts` into four files

Previously `main.ts` contained the `AppBootstrapper` class, Electron
lifecycle wiring, and the entry point all in one file. It is now split,
with no behavioral change:

- `bootstrap/AppBootstrapper.ts` — composition root (unchanged logic,
  moved out of `main.ts`).
- `lifecycle/AppLifecycle.ts` — new file, owns `app.whenReady`,
  `activate`, `window-all-closed`, `before-quit` (moved out of
  `main.ts`, logic unchanged).
- `ipc/registerIpc.ts` — new aggregator file; `main.ts`/`AppBootstrapper`
  previously called `registerSystemHandlers` directly, now calls
  `registerIpc`, which itself calls `registerSystemHandlers`. This is the
  single place future handler groups get added.
- `main.ts` — now ~10 lines: constructs `AppBootstrapper`, calls
  `registerAppLifecycle`.

Window creation was already isolated in `WindowManager.ts` and required
no change beyond the config fix in item 6.

### 4. IPC Foundation Cleanup — documented boundary, reserved namespace

`IpcRouter` and `channels.ts` already contained no business logic. Added:

- An explicit doc comment on `IpcRouter` stating it is transport-only and
  describing exactly how the future Communication Bus will attach
  (as a handler group via `registerIpc.ts`, not by modifying the router).
- `IPC_NAMESPACE.COMMUNICATION` — a reserved, currently-unused namespace
  constant so future channel names stay consistent with `system:` /
  `config:` naming. No communication bus code was added.

### 5. Naming Convention — documented, no renames

Audited all class/interface/file names. The existing convention
(`Manager` / `Handler` / `Router` / `Bootstrap(per)` / `Transport`
suffixes, `I`-prefixed interfaces, camelCase for non-class files,
`SCREAMING_SNAKE_CASE` constants) was already applied consistently, so
nothing was renamed. It is now written down in
[`docs/CONVENTIONS.md`](./CONVENTIONS.md) so later milestones follow the
same pattern instead of drifting.

### 6. Environment Structure — removed one hardcoded value

Found one hardcoded literal: the Vite dev-server URL
(`'http://localhost:5173'`) was passed directly into `WindowManager`'s
constructor from `main.ts`. Fixed by:

- Adding `VITE_DEV_SERVER_URL` to `.env.example` and `AppEnv` (`core/env.ts`).
- Adding `renderer.devServerUrl` to `AppConfig` (`IConfigManager.ts`),
  `default.config.ts`, and `config/app.config.json`.
- `ConfigManager` now merges it with the same
  defaults → file → env precedence as every other setting.
- `WindowManager` reads `this.config.renderer.devServerUrl` instead of a
  constructor literal.

Everything else in `.env.example` / `core/env.ts` was already complete
(app, logging, database, window settings) — verified, not changed.

### 7. Configuration Foundation — verified, no change

Confirmed no module other than `ConfigManager` reads `config/app.config.json`
or the `.env` file directly. `DatabaseManager` and `WindowManager` both
receive already-resolved config values through their constructors. This
boundary is now stated explicitly in `docs/ARCHITECTURE.md`.

### 8. Logging Foundation — verified, no change

Confirmed `console.*` is only called from: (a) `ConsoleTransport`, the
designated logging transport itself, (b) `FileTransport`'s internal
last-resort fallback if a log write itself fails, and (c)
`scripts/bootstrap.ts`, which runs before the app (and thus before a
`Logger` instance exists) to prepare `.env`/folders. This matches "no
direct console logging except during bootstrap." Documented explicitly in
`docs/ARCHITECTURE.md`; no code changed.

### 9. TypeScript — verified, no change

- `strict: true` confirmed in `tsconfig.base.json`.
- Path aliases confirmed consistent across root, backend, and frontend
  tsconfigs (`@backend/*`, `@frontend/*`, `@config/*`, and one alias per
  placeholder module).
- Shared types: the renderer's `window.jarvis` bridge type
  (`vite-env.d.ts`) is intentionally kept as a manually-synced mirror of
  `preload.ts`, since frontend and backend are separate build targets
  with no runtime dependency on each other. A generated/shared-types
  package is a reasonable Milestone 2 improvement once a real IPC
  contract (beyond the 3 system channels) exists, but was not introduced
  here to avoid scope creep.
- Re-ran `npm run typecheck` for both packages after all changes — passes
  with zero errors.

### 10. Documentation — updated

- `README.md` — rewritten to include folder explanation, architecture
  summary, full dev/build script table, conventions pointer, and explicit
  "contains / does not contain" lists.
- `docs/ARCHITECTURE.md` — updated to reflect the main-process file split
  and the configuration/logging boundaries.
- `docs/MILESTONE_1.md` — updated file list to match the split.
- `docs/CONVENTIONS.md` — new.
- `docs/ALIGNMENT_REPORT.md` — this file.

---

## Explicitly not touched

No AI, voice, STT/TTS, vision, memory, agents, plugins, Communication Bus
implementation, Capability Registry, or automation code was added.
`app/frontend`'s React shell, Zustand store, Tailwind config, and Vite
config were not modified. `DatabaseManager`, `Logger`, `ConfigManager`
(beyond the one config-key addition in item 6), `ErrorHandler`,
`AppError`, and `FolderBootstrap` internals are unchanged from Milestone
1.

## Verification performed

```
npm install     # clean install, no errors
npm run typecheck   # frontend + backend, 0 errors
npm run lint        # 0 errors, 0 warnings
npm run test        # 3/3 passing
npm run build       # frontend (vite build) + backend (tsc), both succeed
```

Stopping here, as instructed. Milestone 2 has not been started.
