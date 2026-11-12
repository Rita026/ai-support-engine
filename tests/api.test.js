import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';
import { createGenerativeAnalyzer } from '../src/engines/generative.js';
import { analyzeTraditional } from '../src/engines/traditional.js';
import { resultSchema } from '../src/contracts.js';
import { AppError } from '../src/errors.js';

const valid = { category: 'ACCESS', priority: 'MEDIUM', response: 'Verifica tu usuario.', requiresHumanReview: false, mode: 'generative' };
async function withApp(run, generativeAnalyzer = async () => valid) {
  const server = createApp({ traditionalAnalyzer: analyzeTraditional, generativeAnalyzer }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); } finally { await new Promise((resolve) => server.close(resolve)); }
}
const post = (base, body) => fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('API: ambos modos cumplen exactamente el contrato', () => withApp(async (base) => {
  for (const mode of ['traditional', 'generative']) {
    const response = await post(base, { message: 'No puedo iniciar sesión', mode });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(resultSchema.safeParse(data).success);
    assert.deepEqual(Object.keys(data).sort(), ['category', 'mode', 'priority', 'requiresHumanReview', 'response']);
    assert.equal(data.mode, mode);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
  }
}));

test('API: recorta texto antes de pasarlo al motor y asigna mode desde el servidor', async () => {
  let received;
  await withApp(async (base) => {
    const response = await post(base, { message: '  Ticket de prueba  ', mode: 'generative' });
    assert.equal((await response.json()).mode, 'generative');
    assert.equal(received, 'Ticket de prueba');
  }, async (message) => { received = message; return { ...valid, mode: 'traditional' }; });
});

test('API: señales de seguridad fuerzan revisión sin sustituir clasificación', () => withApp(async (base) => {
  const response = await post(base, { message: 'Hay una vulnerabilidad.', mode: 'generative' });
  assert.deepEqual(await response.json(), { ...valid, requiresHumanReview: true });
}));

test('API: valida campos, tipos, espacios, límites y campos adicionales', () => withApp(async (base) => {
  for (const body of [{}, null, [], { message: 'x' }, { message: 10, mode: 'traditional' }, { message: '   ', mode: 'traditional' }, { message: 'x'.repeat(5001), mode: 'traditional' }, { message: 'x', mode: 'unknown' }, { message: 'x', mode: 'traditional', extra: true }]) {
    const response = await post(base, body);
    assert.equal(response.status, 400);
    assert.ok(['INVALID_REQUEST', 'INVALID_JSON'].includes((await response.json()).error.code));
  }
  assert.equal((await post(base, { message: 'x'.repeat(5000), mode: 'traditional' })).status, 200);
}));

test('API: JSON mal formado, tamaño y tipo de contenido', () => withApp(async (base) => {
  const malformed = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'INVALID_JSON');
  const large = await post(base, { message: 'x'.repeat(70000), mode: 'traditional' });
  assert.equal(large.status, 413);
  const wrongType = await fetch(`${base}/api/analyze`, { method: 'POST', body: 'message=x' });
  assert.equal(wrongType.status, 415);
}));

test('API: método y rutas privadas', () => withApp(async (base) => {
  const response = await fetch(`${base}/api/analyze`);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  for (const path of ['/.env', '/.git/config', '/src/engines/generative.js', '/no-existe']) assert.equal((await fetch(base + path)).status, 404);
}));

test('API: errores inesperados y del proveedor conservan JSON y ocultan secretos', async () => {
  for (const [error, status, code] of [
    [new Error('token-ficticio-privado'), 500, 'INTERNAL_ERROR'],
    [new AppError(429, 'GEMINI_QUOTA', 'Cuota agotada.'), 429, 'GEMINI_QUOTA'],
    [new AppError(504, 'GEMINI_TIMEOUT', 'Tiempo agotado.'), 504, 'GEMINI_TIMEOUT'],
  ]) {
    await withApp(async (base) => {
      const response = await post(base, { message: 'Ticket', mode: 'generative' });
      assert.equal(response.status, status);
      const data = await response.json();
      assert.equal(data.error.code, code);
      assert.ok(!JSON.stringify(data).includes('token-ficticio-privado'));
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }, async () => { throw error; });
  }
});

test('API: tradicional funciona aunque Gemini carezca de clave', () => withApp(async (base) => {
  assert.equal((await post(base, { message: 'No puedo iniciar sesión', mode: 'traditional' })).status, 200);
  const response = await post(base, { message: 'Ticket', mode: 'generative' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'GEMINI_NOT_CONFIGURED');
}, createGenerativeAnalyzer({ apiKey: '' })));

test('API: rechaza resultados internos inválidos', () => withApp(async (base) => {
  const response = await post(base, { message: 'Ticket', mode: 'generative' });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, 'INVALID_ENGINE_RESULT');
}, async () => ({ ...valid, priority: 'UNKNOWN' })));

test('pantalla: archivos enlazados se sirven con tipos correctos y cabeceras', () => withApp(async (base) => {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  const html = await page.text();
  const urls = [...html.matchAll(/(?:src|href)="(\/[^\"]+)"/g)].map((match) => match[1]);
  assert.ok(urls.includes('/app.js'));
  assert.ok(urls.includes('/styles.css'));
  for (const path of urls) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    if (path.endsWith('.js')) assert.match(response.headers.get('content-type'), /javascript/);
    if (path.endsWith('.css')) assert.match(response.headers.get('content-type'), /text\/css/);
  }
  const client = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.ok(!client.includes('innerHTML'));
  assert.ok(!client.includes('GEMINI_API_KEY'));
}));
