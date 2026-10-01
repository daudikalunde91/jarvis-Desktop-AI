# V7.2.3 — npm 12 / Windows install fixes

1. `Cannot find module @rollup/rollup-win32-x64-msvc` (vitest + vite build): npm optional-dependency bug.
   Fixed by declaring `@rollup/rollup-win32-x64-msvc` in root `optionalDependencies` (skipped automatically on other OSes) and removing `prefer-offline` from `.npmrc`.
2. `Electron is not installed` / blocked install scripts: npm 12 blocks dependency install scripts.
   Fixed by pre-approving `electron`, `better-sqlite3`, `esbuild`, `electron-winstaller`, `unrs-resolver` in `allowScripts` (root package.json).
   `scripts/ensure-native.cjs` also self-heals by running Electron's installer if the binary is missing.
3. New `INSTALL-JARVIS.bat`: deletes node_modules + package-lock.json, then clean install, doctor and build.

Clean install: run `INSTALL-JARVIS.bat`, or manually: delete `node_modules` and `package-lock.json`, then `npm install`.

---

# JARVIS Node 22 — Full Electron + IPC Fix

## What was fixed

### 1. Electron desktop window
JARVIS is now launched by Electron after Vite is ready. The normal `npm run dev` command does not require the user to open localhost manually.

### 2. IPC preload bridge
The previous preload was a TypeScript/CommonJS preload running with Electron sandboxing. This could prevent the preload from initializing and left `window.jarvis` undefined.

A dedicated, self-contained `src/preload.cjs` is now used. It exposes only the approved IPC API through `contextBridge`.

Electron settings:
- contextIsolation: true
- nodeIntegration: false
- sandbox: false

### 3. Dev/prod preload paths
Development loads `app/backend/src/preload.cjs`.
Production loads `app/backend/dist/preload.cjs`.

### 4. Startup race
Vite is started first and the launcher waits for TCP port 5173 before Electron starts.

### 5. Visible diagnostics
Electron logs preload initialization, renderer load failures, and renderer console messages.

## Run

```powershell
npm install
npm run dev
```

Do not open `http://localhost:5173` yourself as the normal way to use JARVIS. That URL is only the renderer development server. The actual JARVIS application is the Electron window.

You can also run:

```powershell
.\RUN-JARVIS.bat
```

Do not use `npm audit fix --force` before boot verification.


## M5.1 V3 native/Electron startup fix
- Native diagnostics now run the real Electron executable with `ELECTRON_RUN_AS_NODE=1`; they no longer depend on the Electron CLI resolving an app path.
- This fixes the `Electron ABI: UNKNOWN` / native startup failure caused by CLI-based diagnostics on Windows.
- `npm run dev` still launches the actual Electron desktop window and uses Vite only as the internal renderer server.
- npm-only delivery: pnpm lock/workspace files removed.

## V7.1.3 — AI provider failure diagnostics fix (Sept 2026)
Fixes the "Cloud AI providers were unavailable: openai: AI_RATE_LIMIT_ERROR,
gemini: AI_MODEL_UNAVAILABLE_ERROR, claude: AI_INVALID_REQUEST_ERROR" report.
Full writeup: `docs/M5_1_V7_1_2_AI_DEBUG_FIX.md`. Short version:
- `FallbackManager.ts`, `errors.ts` (`AllProvidersFailedError`), and
  `AIOrchestrator.ts` were all silently discarding the real HTTP
  status/response-body detail each provider failure already carried in
  `ProviderError.context` — only the bare error *code* was ever logged.
  Now the full detail is logged at every level.
- New: `npm run doctor:ai` sends one real minimal request to every
  configured provider and prints its actual status + error message,
  so you can tell which of your three keys/models is actually broken
  without opening the Electron app at all.
- Also see `docs/CAPABILITIES_ROADMAP_RECOMMENDATIONS.md` — a from-the-code
  audit of your JARVIS capabilities wishlist (what's already real vs. what
  still needs building, in priority order).

## V7.2 — Stage 6 Production Foundation (Sept 2026)
V7.1.3 (above) fixed *logging* so the real cause of a provider failure
was visible. V7.2 fixes the underlying causes it exposed:
- `gemini: AI_MODEL_UNAVAILABLE_ERROR` — `gemini-2.5-flash` is on
  Google's deprecation path; default moved to `gemini-3.6-flash`, and
  `GeminiProvider` now self-heals past a future model rename
  automatically instead of needing another manual fix like this one.
- `openai: AI_RATE_LIMIT_ERROR` (actually `insufficient_quota`, i.e. no
  credits left, not a transient rate limit) — `BaseHttpProvider` now
  tells these apart, so an out-of-credits provider gets a real cooldown
  instead of being retried every ~30s forever.
- `claude: AI_INVALID_REQUEST_ERROR` — if this was actually a
  workspace-scope issue on a gateway deployment, `ClaudeProvider` now
  accepts `ANTHROPIC_WORKSPACE_ID`; if it was a plain invalid key, that
  still needs a real key in `.env`, which no code change can fix.
- Also added: Groq, OpenRouter, and the Lovable AI Gateway as three more
  fallback providers, so a single provider issue is less likely to take
  down cloud reasoning entirely.
Full report: `docs/V7_2_RELEASE.md`. Provider details: `docs/AI_PROVIDERS.md`.

## V7.2.1 — tool-name hotfix
Tool names like `system.get_info` were rejected (HTTP 400) by Claude, OpenAI,
Groq, OpenRouter and Lovable. Adapters now translate names at the wire
boundary (`ai/tools/ProviderToolNames.ts`); internal names are unchanged.
Run `npm run doctor:ai` and a tool request ("Open VS Code") to confirm on
your machine — this fix was not run under the real npm/Electron toolchain.
