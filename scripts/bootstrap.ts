import fs from 'node:fs';
import path from 'node:path';

/**
 * Standalone bootstrap script (run via `npm bootstrap`).
 * Ensures the runtime directory layout and a local `.env` file exist
 * before the backend or frontend dev servers start. This mirrors
 * FolderBootstrap in app/backend but runs pre-install, before any
 * TypeScript path aliases are available.
 */
const ROOT_DIR = path.resolve(__dirname, '..');
const RUNTIME_DIRECTORIES = ['config', 'database', 'logs', 'assets'];

function ensureDirectories(): void {
  for (const dir of RUNTIME_DIRECTORIES) {
    const fullPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`[bootstrap] created directory: ${dir}`);
    }
  }
}

function ensureEnvFile(): void {
  const envPath = path.join(ROOT_DIR, '.env');
  const examplePath = path.join(ROOT_DIR, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('[bootstrap] created .env from .env.example');
  }
}

function main(): void {
  ensureDirectories();
  ensureEnvFile();
  console.log('[bootstrap] project foundation ready.');
}

main();
