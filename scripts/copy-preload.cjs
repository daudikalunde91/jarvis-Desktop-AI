const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..', 'app', 'backend');
const source = path.join(backendRoot, 'src', 'preload.cjs');
const target = path.join(backendRoot, 'dist', 'preload.cjs');

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`[JARVIS] Preload copied to ${target}`);
