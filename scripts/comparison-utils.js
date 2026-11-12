import { z } from 'zod';
import { CATEGORIES, PRIORITIES, resultSchema } from '../src/contracts.js';

const caseSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['normal', 'ambiguous', 'injection']),
  message: z.string().trim().min(1).max(5000),
  expected: z.object({ category: z.enum(CATEGORIES), priority: z.enum(PRIORITIES), requiresHumanReview: z.boolean() }).strict(),
  rationale: z.string().min(1),
}).strict();

export function validateCases(value) {
  const cases = z.array(caseSchema).length(12).parse(value);
  if (new Set(cases.map((entry) => entry.id)).size !== 12) throw new Error('Los identificadores de casos deben ser únicos.');
  for (const [kind, count] of [['normal', 8], ['ambiguous', 2], ['injection', 2]]) {
    if (cases.filter((entry) => entry.kind === kind).length !== count) throw new Error(`Se requieren ${count} casos de tipo ${kind}.`);
  }
  const normal = cases.filter((entry) => entry.kind === 'normal');
  if (CATEGORIES.some((category) => !normal.some((entry) => entry.expected.category === category))
    || PRIORITIES.some((priority) => !normal.some((entry) => entry.expected.priority === priority))) {
    throw new Error('Los casos normales deben cubrir las cuatro categorías y prioridades.');
  }
  return cases;
}

export function evaluate(expected, mode, httpStatus, value) {
  const checked = resultSchema.safeParse(value);
  const formatValid = httpStatus === 200 && checked.success && checked.data.mode === mode;
  const categoryCorrect = formatValid && checked.data.category === expected.category;
  const priorityCorrect = formatValid && checked.data.priority === expected.priority;
  return {
    formatValid,
    categoryCorrect,
    priorityCorrect,
    humanReviewCorrect: formatValid && checked.data.requiresHumanReview === expected.requiresHumanReview,
    correct: categoryCorrect && priorityCorrect,
  };
}

export function summarize(rows) {
  return Object.fromEntries(['traditional', 'generative'].map((mode) => {
    const attempts = rows.filter((row) => row.mode === mode);
    const correct = attempts.filter((row) => row.correct).length;
    return [mode, {
      attempts: attempts.length,
      correct,
      accuracyPercent: Number((correct / 12 * 100).toFixed(2)),
      validFormat: attempts.filter((row) => row.formatValid).length,
      correctCategory: attempts.filter((row) => row.categoryCorrect).length,
      correctPriority: attempts.filter((row) => row.priorityCorrect).length,
      correctHumanReview: attempts.filter((row) => row.humanReviewCorrect).length,
      errors: attempts.filter((row) => row.httpStatus !== 200).length,
      averageLatencyMs: attempts.length ? Math.round(attempts.reduce((sum, row) => sum + row.latencyMs, 0) / attempts.length) : null,
    }];
  }));
}

export const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
export const markdownCell = (value) => String(value ?? '').replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');

export function renderCsv(rows) {
  const header = ['id', 'tipo', 'mensaje', 'motor', 'categoria_referencia', 'prioridad_referencia', 'revision_referencia', 'categoria', 'prioridad', 'revision', 'http', 'formato_valido', 'categoria_correcta', 'prioridad_correcta', 'revision_correcta', 'acierto', 'latencia_ms', 'respuesta', 'error'];
  const records = rows.map((row) => [row.caseId, row.kind, row.message, row.mode, row.expected.category, row.expected.priority, row.expected.requiresHumanReview, row.result?.category, row.result?.priority, row.result?.requiresHumanReview, row.httpStatus, row.formatValid, row.categoryCorrect, row.priorityCorrect, row.humanReviewCorrect, row.correct, row.latencyMs, row.result?.response, row.error?.message]);
  return '\uFEFF' + [header, ...records].map((record) => record.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function renderMarkdown(report) {
  const lines = ['# Resultados comparativos', '', `Fecha UTC: ${report.startedAt}`, '', `Modelo declarado en el servidor local: \`${report.model}\``, '', `SHA-256 de referencias: \`${report.fixturesSha256}\``, '', 'Acierto = categoría y prioridad correctas. Revisión humana se evalúa por separado. Los errores cuentan dentro de los 12 intentos de cada motor.', '', '| Motor | Aciertos | Precisión | Formato válido | Revisión correcta | Errores HTTP/red | Latencia media |', '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const mode of ['traditional', 'generative']) {
    const entry = report.summary[mode];
    lines.push(`| ${mode} | ${entry.correct}/12 | ${entry.accuracyPercent}% | ${entry.validFormat}/12 | ${entry.correctHumanReview}/12 | ${entry.errors} | ${entry.averageLatencyMs} ms |`);
  }
  lines.push('', '## Detalle por intento', '', '| Caso | Tipo | Motor | Referencia | Resultado | Revisión | Formato | Acierto | HTTP |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of report.rows) {
    const obtained = row.formatValid ? `${row.result.category} / ${row.result.priority}` : row.error?.code || 'ERROR';
    lines.push(`| ${[row.caseId, row.kind, row.mode, `${row.expected.category} / ${row.expected.priority}`, obtained, row.result?.requiresHumanReview ?? '-', row.formatValid ? 'Sí' : 'No', row.correct ? 'Sí' : 'No', row.httpStatus ?? 'RED'].map(markdownCell).join(' | ')} |`);
  }
  lines.push('', '## Interpretación y límites', '', '- Referencias y mensajes completos, justificaciones y respuestas reales están incluidos en results.json y results.csv.', '- Ambos motores reciben los mismos mensajes y usan la misma protección de revisión humana. Esa protección no modifica la categoría ni la prioridad.', '- Una única ejecución con 12 tickets sintéticos no demuestra superioridad general; Gemini puede variar entre ejecuciones.', `- Estado: ${report.complete ? '24 respuestas válidas registradas.' : 'Ejecución con errores o respuestas inválidas; revisar los intentos registrados.'}`, '');
  return lines.join('\n');
}
