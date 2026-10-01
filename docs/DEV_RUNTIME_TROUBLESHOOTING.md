# JARVIS Development Runtime Troubleshooting

## 1. `.env` shows NOT FOUND in Doctor

`npm run doctor` is diagnostic only. It does not create secrets. Run:

```powershell
npm run bootstrap
```

Then edit:

```text
JARVIS\.env
```

and set the provider keys locally. Never paste or commit real API keys into `.env.example`, README files, source code, or the ZIP.

## 2. `better-sqlite3` reports NODE_MODULE_VERSION 127 vs 125

This is a native ABI mismatch between normal Node.js and Electron. V7.1.1 keeps automatic repair in the development launcher. Run:

```powershell
npm run dev
```

A successful automatic repair is shown by:

```text
[JARVIS] better-sqlite3: compatible with Electron.
```

## 3. `Port 5173 is already in use`

The V7.1.1 launcher no longer requires 5173 to be free. It probes starting at 5173 and uses the first free port, for example `5174`. It then sets `VITE_DEV_SERVER_URL` for Electron automatically.

You should see:

```text
[JARVIS] Renderer URL: http://127.0.0.1:5174
```

A previously running Vite/JARVIS process can therefore remain on 5173 without blocking a new development launch.

## 4. OpenAI is configured but returns 429

A log such as:

```text
openai: { enabled: true, configured: true }
AI_RATE_LIMIT_ERROR
```

means the `.env` key was detected and the request reached the OpenAI provider, but the provider rejected the request as rate-limited/quota-limited. Configure at least one additional provider if you want runtime failover.

## 5. Provider failover

Failover is only useful when more than one provider is actually configured. `configured: false` means there is no usable key for that provider.

## 6. No lockfile

This distribution currently does not include a generated `package-lock.json` because dependency metadata could not be resolved in the offline build environment used to prepare the archive. On the target Windows machine, after a successful install, generate and retain the lockfile with:

```powershell
npm install --package-lock-only
```

Commit that lockfile before treating the dependency set as frozen/reproducible.
