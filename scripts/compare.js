import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_MODEL } from '../src/engines/generative.js';
import { validateCases, evaluate, summarize, renderCsv, renderMarkdown } from './comparison-utils.js';

export async function compare() {
  const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:3000');
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('BASE_URL debe ser un origen HTTP/HTTPS sin credenciales, ruta ni parámetros.');
  }
  const delayMs = Number(process.env.COMPARE_DELAY_MS || 5000);
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60000) throw new Error('COMPARE_DELAY_MS debe ser un entero entre 0 y 60000.');
  const fixtureBytes = await readFile(new URL('../fixtures/cases.json', import.meta.url));
  const cases = validateCases(JSON.parse(fixtureBytes.toString('utf8')));
  const startedAt = new Date().toISOString();
  const fixturesSha256 = createHash('sha256').update(fixtureBytes).digest('hex');
  let sourceCommit = 'unavailable';
  try { sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Running a source ZIP does not require Git. */ }
  const runName = `run-${startedAt.replace(/[:.]/g, '-')}`;
  const output = new URL(`../evidence/${runName}/`, import.meta.url);
  await mkdir(output, { recursive: true });
  const report = {
    startedAt, referencesFixedAt: startedAt, finishedAt: null,
    baseUrl: base.origin, model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    sourceCommit, sourceState: 'working tree; fixtures and runner are recorded in this delivery',
    fixturesSha256, references: cases, retries: 0, delayBetweenCasesMs: delayMs,
    sharedProtection: 'Human review is forced for security signals; category and priority are not replaced.',
    rows: [], summary: null, complete: false,
  };
  // Persist references before the first HTTP request. Keep every attempt, including errors.
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
  for (let index = 0; index < cases.length; index++) {
    const entry = cases[index];
    for (const mode of ['traditional', 'generative']) {
      const start = performance.now();
      let httpStatus = null;
      let result = null;
      let error = null;
      try {
        const response = await fetch(new URL('/api/analyze', base), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: entry.message, mode }), signal: AbortSignal.timeout(40_000),
        });
        httpStatus = response.status;
        try { result = await response.json(); }
        catch { error = { code: 'NON_JSON_RESPONSE', message: 'El servidor no devolvió JSON.' }; }
        if (!response.ok) {
          error = { code: result?.error?.code || `HTTP_${httpStatus}`, message: result?.error?.message || 'Error del servidor.' };
          result = null;
        }
      } catch (failure) {
        error = { code: failure.name === 'TimeoutError' ? 'CLIENT_TIMEOUT' : 'NETWORK_ERROR', message: 'No se recibió una respuesta HTTP válida del servidor.' };
      }
      const outcome = evaluate(entry.expected, mode, httpStatus, result);
      if (!outcome.formatValid && !error) error = { code: 'INVALID_FORMAT', message: 'La respuesta no cumple el contrato.' };
      const row = { caseId: entry.id, kind: entry.kind, message: entry.message, expected: entry.expected, mode, httpStatus, latencyMs: Math.round(performance.now() - start), ...outcome, result, error };
      report.rows.push(row);
      console.log(`${entry.id} ${mode}: ${error?.code || `${result.category}/${result.priority}`} | acierto=${outcome.correct}`);
      await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
    }
    if (index < cases.length - 1) await delay(delayMs);
  }
  const finalBytes = await readFile(new URL('../fixtures/cases.json', import.meta.url));
  report.referencesUnchanged = createHash('sha256').update(finalBytes).digest('hex') === fixturesSha256;
  report.finishedAt = new Date().toISOString();
  report.summary = summarize(report.rows);
  report.complete = report.rows.length === 24 && report.rows.every((row) => row.formatValid) && report.referencesUnchanged;
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
  await writeFile(new URL('results.csv', output), renderCsv(report.rows));
  await writeFile(new URL('results.md', output), renderMarkdown(report));
  await writeFile(new URL('../evidence/README.md', import.meta.url), `# Evidencia de ejecución\n\nÚltima ejecución: ${startedAt} (UTC).\n\n- [Tabla y métricas](${runName}/results.md)\n- [Respuestas reales y referencias](${runName}/results.json)\n- [Tabla CSV](${runName}/results.csv)\n- [Conclusión técnica](conclusion.md)\n\nEstado de las 24 respuestas: ${report.complete ? 'válidas' : 'revisar errores registrados'}. Las capturas y la verificación visual, si están disponibles, se describen en validation.md.\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Resultados guardados en evidence/${runName}`);
  if (!report.complete) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  compare().catch(() => {
    console.error('No se pudo ejecutar la comparación. Revisa BASE_URL, COMPARE_DELAY_MS, los fixtures y los permisos de escritura.');
    process.exitCode = 1;
  });
}
