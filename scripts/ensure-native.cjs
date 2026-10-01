const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ELECTRON_PKG = path.join(ROOT, 'node_modules', 'electron', 'package.json');
const ELECTRON_EXE = process.platform === 'win32'
  ? path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron');
const ELECTRON_REBUILD = path.join(
  ROOT,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild',
);
const SQLITE_BINARY = path.join(ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    ...options,
  });
}

function runElectronBinary(args, env) {
  // electron.exe is a real executable. Run it directly with shell:false so
  // JavaScript expressions containing spaces/quotes are passed untouched.
  return spawnSync(ELECTRON_EXE, args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    env,
  });
}

function runWindowsCmd(command, args, env) {
  // .cmd shims require cmd.exe on Windows. Keep shell usage isolated here.
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    shell: true,
    env,
  });
}

function requireElectronInstalled() {
  // npm 12 blocks dependency install scripts by default, which skips Electron's
  // postinstall (the binary download). Self-heal by running it directly.
  const electronInstaller = path.join(ROOT, 'node_modules', 'electron', 'install.js');
  if (fs.existsSync(ELECTRON_PKG) && !fs.existsSync(ELECTRON_EXE) && fs.existsSync(electronInstaller)) {
    console.log('[JARVIS] Electron binary missing - downloading it now (npm install-script was blocked)...');
    const r = spawnSync(process.execPath, [electronInstaller], { cwd: path.dirname(electronInstaller), stdio: 'inherit', windowsHide: true });
    if (r.status !== 0) console.error('[JARVIS] Electron download failed (exit ' + r.status + ').');
  }
  if (!fs.existsSync(ELECTRON_PKG) || !fs.existsSync(ELECTRON_EXE)) {
    throw new Error('Electron is not installed. Finish `npm install` before starting JARVIS.');
  }
}

function electronEval(expression) {
  // ELECTRON_RUN_AS_NODE makes the Electron executable behave like Node for
  // diagnostics. This avoids the Electron CLI trying to resolve an app path,
  // which caused the previous "Cannot find Electron app at ..."/ABI failures.
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
  const r = runElectronBinary(['-e', expression], env);
  const output = String(r.stdout || '').trim();
  const error = String(r.stderr || '').trim();
  if (r.status !== 0 || !output) {
    throw new Error(error || output || `Electron diagnostic exited with code ${r.status ?? 'unknown'}`);
  }
  return output;
}

function sqliteLoadsInElectron() {
  if (!fs.existsSync(SQLITE_BINARY)) return { ok: false, reason: 'native binary missing' };
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
  const expression = [
    "try {",
    "  const Database = require('better-sqlite3');",
    "  const db = new Database(':memory:');",
    "  const row = db.prepare('SELECT 1 AS ok').get();",
    "  db.close();",
    "  process.stdout.write('JARVIS_SQLITE_OK:' + String(row.ok));",
    "} catch (e) {",
    "  process.stderr.write((e && e.stack) ? e.stack : String(e));",
    "  process.exitCode = 2;",
    "}",
  ].join(' ');
  const r = runElectronBinary(['-e', expression], env);
  const output = String(r.stdout || '').trim();
  const error = String(r.stderr || '').trim();
  const ok = r.status === 0 && output.includes('JARVIS_SQLITE_OK:1');
  return {
    ok,
    reason: error || output || `exit code ${r.status ?? 'unknown'}`,
    status: r.status,
  };
}

function rebuild() {
  console.log('[JARVIS] Rebuilding better-sqlite3 for Electron...');
  if (!fs.existsSync(ELECTRON_REBUILD)) {
    throw new Error('electron-rebuild is not installed. Run npm install again.');
  }
  const version = JSON.parse(fs.readFileSync(ELECTRON_PKG, 'utf8')).version;
  const args = ['-f', '-w', 'better-sqlite3', '--version', version];
  const r = process.platform === 'win32'
    ? runWindowsCmd(ELECTRON_REBUILD, args, process.env)
    : run(ELECTRON_REBUILD, args);
  const error = String(r.stderr || '').trim();
  const output = String(r.stdout || '').trim();
  if (output) console.log(output);
  if (r.status !== 0) throw new Error(error || output || `electron-rebuild exited with code ${r.status ?? 'unknown'}`);

  const check = sqliteLoadsInElectron();
  if (!check.ok) {
    throw new Error([
      'better-sqlite3 still cannot load in Electron after rebuild.',
      `exit=${check.status ?? 'unknown'}` ,
      check.reason,
    ].filter(Boolean).join(' '));
  }
  console.log('[JARVIS] better-sqlite3: compatible with Electron.');
}

try {
  requireElectronInstalled();
  const abi = electronEval('process.stdout.write(process.versions.modules)');
  console.log(`[JARVIS] Electron ABI: ${abi}`);
  const result = sqliteLoadsInElectron();
  if (result.ok) {
    console.log('[JARVIS] Native SQLite check: PASS (no rebuild needed)');
  } else {
    console.log(`[JARVIS] Native SQLite check: ${result.reason}`);
    rebuild();
  }
} catch (error) {
  console.error(`[JARVIS] Native runtime check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
