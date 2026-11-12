import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCases, evaluate, summarize, csvCell, markdownCell, renderCsv, renderMarkdown } from '../scripts/comparison-utils.js';

const cases = JSON.parse(await readFile(new URL('../fixtures/cases.json', import.meta.url), 'utf8'));
const expected = { category: 'ACCESS', priority: 'MEDIUM', requiresHumanReview: false };
const result = { ...expected, response: 'Una respuesta, con "comillas".\nNueva línea.', mode: 'traditional' };

test('referencias: 12 casos, distribución, categorías y prioridades', () => {
  assert.equal(validateCases(cases).length, 12);
  assert.equal(cases.filter((entry) => entry.kind === 'injection').length, 2);
  assert.ok(cases.every((entry) => entry.rationale.length > 10));
});

test('referencias: rechaza duplicados, cantidad, distribución y cobertura incorrectas', () => {
  assert.throws(() => validateCases(cases.slice(0, 11)));
  const duplicate = structuredClone(cases); duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateCases(duplicate));
  const wrongKind = structuredClone(cases); wrongKind[0].kind = 'ambiguous';
  assert.throws(() => validateCases(wrongKind));
  const noSecurity = structuredClone(cases); noSecurity.filter((entry) => entry.kind === 'normal').forEach((entry) => { entry.expected.category = 'BUG'; });
  assert.throws(() => validateCases(noSecurity));
});

test('evaluación: acierto conjunto y revisión independiente', () => {
  assert.equal(evaluate(expected, 'traditional', 200, result).correct, true);
  const reviewMismatch = evaluate(expected, 'traditional', 200, { ...result, requiresHumanReview: true });
  assert.equal(reviewMismatch.correct, true);
  assert.equal(reviewMismatch.humanReviewCorrect, false);
  assert.equal(evaluate(expected, 'traditional', 200, { ...result, priority: 'HIGH' }).correct, false);
  assert.equal(evaluate(expected, 'traditional', 200, { ...result, category: 'BUG' }).correct, false);
});

test('evaluación: errores y contratos inválidos nunca cuentan como aciertos', () => {
  for (const [http, value] of [[429, result], [null, null], [200, { ...result, mode: 'generative' }], [200, { ...result, extra: true }], [200, null]]) {
    const outcome = evaluate(expected, 'traditional', http, value);
    assert.equal(outcome.correct, false);
    assert.equal(outcome.formatValid, false);
  }
});

test('métricas: usa 12 como denominador e incluye errores', () => {
  const rows = [
    { mode: 'traditional', correct: true, formatValid: true, categoryCorrect: true, priorityCorrect: true, humanReviewCorrect: true, httpStatus: 200, latencyMs: 10 },
    { mode: 'traditional', correct: false, formatValid: false, httpStatus: 429, latencyMs: 30 },
  ];
  const summary = summarize(rows);
  assert.equal(summary.traditional.accuracyPercent, 8.33);
  assert.equal(summary.traditional.errors, 1);
  assert.equal(summary.traditional.averageLatencyMs, 20);
  assert.equal(summary.generative.accuracyPercent, 0);
  assert.equal(summary.generative.averageLatencyMs, null);
});

test('reportes: escapa CSV y Markdown y conserva respuestas', () => {
  assert.equal(csvCell('uno,"dos"\ntres'), '"uno,""dos""\ntres"');
  assert.equal(markdownCell('A|B\nC'), 'A\\|B<br>C');
  const row = { caseId: 'x', kind: 'normal', message: 'A|B', expected, mode: 'traditional', httpStatus: 200, latencyMs: 1, ...evaluate(expected, 'traditional', 200, result), result, error: null };
  assert.ok(renderCsv([row]).includes('""comillas""'));
  const markdown = renderMarkdown({ startedAt: 'fecha', model: 'modelo', fixturesSha256: 'hash', summary: summarize([row]), rows: [row], complete: false });
  assert.ok(markdown.includes('8.33%'));
  assert.ok(markdown.includes('ACCESS / MEDIUM'));
  assert.ok(markdown.includes('Ejecución con errores'));
});
