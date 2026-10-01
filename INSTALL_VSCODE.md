# JARVIS — VS Code Installation Guide (Windows)

This guide starts the JARVIS desktop application from Visual Studio Code.

## 1. Install prerequisites

Install these before opening the project:

1. [Visual Studio Code](https://code.visualstudio.com/)
2. Node.js **20 or newer** (use the LTS installer from [nodejs.org](https://nodejs.org/))
3. Git for Windows (optional, only needed if you plan to use Git)

Open PowerShell and confirm Node is available:

```powershell
node --version
```

It must show version 20 or newer.

## 2. Extract and open the project

1. Extract `JARVIS-HUD-v6.zip` somewhere outside `Downloads`, for example `C:\Projects\JARVIS`.
2. Open VS Code.
3. Select **File → Open Folder...**.
4. Select the extracted `JARVIS` folder — the folder that contains `package.json` and `npm-workspace.yaml`.
5. If VS Code asks whether you trust the authors, select **Yes, I trust the authors**.

Do not open `app/frontend` by itself. Open the top-level `JARVIS` folder.

## 3. Install dependencies

In VS Code, select **Terminal → New Terminal**, then run:

```powershell
npm install
```

If `corepack` is unavailable, install npm once instead:

```powershell
npm install --global npm@9
npm install
```

The first install may take a few minutes. Do not copy `node_modules` from another computer.

## 4. Configure JARVIS

Run the project bootstrap script:

```powershell
npm bootstrap
```

It prepares runtime folders and creates `.env` from `.env.example` when needed.

Never commit or share `.env`: it may later contain API keys or private settings.

## 5. Start the desktop app

Run:

```powershell
npm dev
```

Vite starts the React interface and Electron opens the JARVIS desktop window. Wait for the HUD to show `CORE // ONLINE`.

To stop JARVIS, close the Electron window and press `Ctrl+C` in the VS Code terminal if the process is still running.

## Useful commands

```powershell
npm typecheck          # TypeScript verification
npm test               # Automated tests
npm build              # Build frontend and backend
npm package            # Create Windows installer artifacts
npm dev:frontend       # Run only the React UI
npm dev:backend        # Run only Electron/backend
```

## VS Code extensions (recommended)

- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense

## Troubleshooting

### `npm` is not recognized

Close and reopen the VS Code terminal after installing Node.js, then run the Corepack commands in step 3.

### `better-sqlite3` or Electron fails after Node.js changes

Close JARVIS, then run:

```powershell
npm install
```

### The JARVIS window does not open

First check the terminal output. Then run:

```powershell
npm typecheck
npm dev
```

The current HUD is connected to the text-command pipeline. Real microphone, wake-word, and vision capture are future runtime modules; their panels intentionally show standby/planned states until those providers are integrated.
