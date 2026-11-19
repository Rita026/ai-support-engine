// Inicia el servicio Python de machine learning con el entorno virtual de ml-service/.
// Funciona en Windows (.venv\Scripts\python.exe) y en macOS/Linux (.venv/bin/python).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../ml-service/', import.meta.url));
const python = process.platform === 'win32'
  ? join(root, '.venv', 'Scripts', 'python.exe')
  : join(root, '.venv', 'bin', 'python');

if (!existsSync(python)) {
  console.error('No se encontró ml-service/.venv. Crea el entorno e instala las dependencias (ver la sección «Servicio de machine learning» del README).');
  process.exit(1);
}

let url;
try {
  url = new URL(process.env.ML_SERVICE_URL?.trim() || 'http://127.0.0.1:8000');
} catch {
  console.error('ML_SERVICE_URL no es una URL válida.');
  process.exit(1);
}
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
  console.log(`ML_SERVICE_URL apunta a ${url.origin}; no se inicia un servicio local.`);
  process.exit(0);
}

const args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', url.port || '8000'];
// --reload reinicia el servicio al cambiar el código, sin vigilar .venv ni los datos.
if (process.argv.includes('--reload')) args.push('--reload', '--reload-dir', 'app', '--reload-dir', 'ml');

const child = spawn(python, args, { cwd: root, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
