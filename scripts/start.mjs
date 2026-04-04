import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const backendDir = resolve(root, 'cursor-projects/DOT-Copilot/backend');

console.log('Starting backend server...');
const backend = spawn('npx', ['ts-node', 'src/server.ts'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: { ...process.env },
});

backend.on('error', (err) => {
  console.error('Backend failed to start:', err);
});

await new Promise(r => setTimeout(r, 3000));

console.log('Starting Vite dev server...');
const vite = spawn('npx', ['vite'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
});

vite.on('error', (err) => {
  console.error('Vite failed to start:', err);
});

function cleanup() {
  backend.kill();
  vite.kill();
  process.exit();
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
