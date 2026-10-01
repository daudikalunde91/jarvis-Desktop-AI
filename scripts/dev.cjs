const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const children = [];
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function start(args, label) {
  const child = spawn(npmCommand, args, { cwd: ROOT, stdio: 'inherit', windowsHide: false, shell: process.platform === 'win32' });
  children.push({ child, label });
  child.on('error', (error) => console.error(`[${label}] process error:`, error));
  child.on('exit', (code, signal) => {
    if (code !== 0 && signal == null) console.error(`[${label}] exited with code ${code}`);
  });
  return child;
}

function findFreePort(host, preferredPort, maxAttempts = 20) {
  return new Promise((resolve, reject) => {
    const tryPort = (port, attempt) => {
      const server = net.createServer();
      server.once('error', (error) => {
        server.close();
        if (error && error.code === 'EADDRINUSE' && attempt < maxAttempts) {
          tryPort(port + 1, attempt + 1);
        } else {
          reject(error);
        }
      });
      server.listen(port, host, () => {
        const actual = server.address();
        const selectedPort = typeof actual === 'object' && actual ? actual.port : port;
        server.close(() => resolve(selectedPort));
      });
    };
    tryPort(preferredPort, 0);
  });
}

function waitForPort(host, port, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const socket = net.createConnection({ host, port });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started >= timeoutMs) reject(new Error(`Vite did not become ready at http://${host}:${port}`));
        else setTimeout(probe, 250);
      });
    };
    probe();
  });
}

async function waitExit(child) {
  return new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 1)));
}

async function main() {
  console.log('[JARVIS] 1/4 bootstrap');
  const bootstrap = start(['run', 'bootstrap'], 'bootstrap');
  const bootstrapCode = await waitExit(bootstrap);
  if (bootstrapCode !== 0) throw new Error(`bootstrap exited with code ${bootstrapCode}`);

  console.log('[JARVIS] 2/4 native runtime check');
  const native = start(['run', 'prepare:native'], 'native');
  const nativeCode = await waitExit(native);
  if (nativeCode !== 0) throw new Error(`native preparation exited with code ${nativeCode}`);

  console.log('[JARVIS] 3/4 frontend');
  const preferredPort = Number.parseInt(process.env.JARVIS_DEV_PORT || '5173', 10);
  const frontendPort = await findFreePort('127.0.0.1', Number.isFinite(preferredPort) ? preferredPort : 5173);
  const rendererUrl = `http://127.0.0.1:${frontendPort}`;
  process.env.VITE_DEV_SERVER_URL = rendererUrl;
  process.env.VITE_PORT = String(frontendPort);
  console.log(`[JARVIS] Renderer URL: ${rendererUrl}`);

  const frontend = start(
    ['run', 'dev', '--workspace=jarvis-frontend', '--', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'],
    'frontend',
  );
  await waitForPort('127.0.0.1', frontendPort);

  console.log('[JARVIS] 4/4 electron desktop');
  const electron = start(['run', 'dev', '--workspace=jarvis-backend'], 'electron');
  frontend.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[frontend] stopped unexpectedly with code ${code}`);
      cleanup(code || 1);
    }
  });
  electron.on('exit', (code) => {
    if (code !== null) cleanup(code);
  });

  // Keep the launcher alive until a child exits.
}

function cleanup(code = 0) {
  for (const { child } of children) {
    if (!child.killed) { try { child.kill(); } catch {} }
  }
  process.exit(code);
}
process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));
main().catch((error) => { console.error('[JARVIS] STARTUP FAILED:', error instanceof Error ? error.message : String(error)); cleanup(1); });
