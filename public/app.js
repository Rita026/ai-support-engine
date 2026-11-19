const form = document.querySelector('#analyze-form');
const message = document.querySelector('#message');
const methodInputs = [...form.querySelectorAll('[name="mode"]')];
const counter = document.querySelector('#counter');
const messageError = document.querySelector('#message-error');
const status = document.querySelector('#status');
const panel = document.querySelector('#results-panel');
const resultsTitle = document.querySelector('#results-title');
const results = document.querySelector('#results');
const emptyState = document.querySelector('#empty-state');
const context = document.querySelector('#analysis-context');
const staleNotice = document.querySelector('#stale-notice');
const comparison = document.querySelector('#comparison-summary');
const template = document.querySelector('#result-template');
const submitLabel = document.querySelector('#submit-label');
let busy = false;
let lastTicket = '';
let outcomes = new Map();

const categories = { ACCESS: 'Acceso a la cuenta', BUG: 'Error del sistema', FEATURE: 'Nueva funcionalidad', SECURITY: 'Seguridad' };
const priorities = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' };
const engines = {
  traditional: {
    name: 'Por reglas', short: 'Reglas', action: 'con reglas',
    description: 'Clasificación con reglas y respuesta predefinida',
    loading: 'Revisando las reglas de clasificación…',
    help: 'Este método no necesita una conexión con Gemini.',
  },
  generative: {
    name: 'Con Gemini', short: 'Gemini', action: 'con Gemini',
    description: 'Interpretación del contexto y respuesta personalizada',
    loading: 'Gemini está preparando su respuesta…',
    help: 'Gemini puede tardar unos segundos en preparar la respuesta.',
  },
  ml: {
    name: 'Con machine learning', short: 'Machine learning', action: 'con machine learning',
    description: 'Clasificación con un modelo entrenado y respuesta predefinida',
    loading: 'El modelo está clasificando la solicitud…',
    help: 'Este método usa el servicio de machine learning; debe estar en ejecución.',
  },
};
const allEngines = Object.keys(engines);
const examples = {
  access: 'No puedo iniciar sesión. El sistema indica que mi contraseña es incorrecta.',
  bug: 'Al guardar un documento aparece un error 500 y no puedo completar mi trabajo.',
  feature: 'Me gustaría agregar una opción para exportar los reportes a Excel.',
  security: 'Detecté una posible vulnerabilidad que permite acceder a datos de otras cuentas.',
};

const selectedMethod = () => methodInputs.find((input) => input.checked).value;

function updateMethod() {
  const method = selectedMethod();
  if (!busy) submitLabel.textContent = method === 'compare' ? 'Comparar resultados' : `Analizar ${engines[method].action}`;
  document.querySelector('#method-help').textContent = method === 'compare'
    ? 'Comparar consulta los tres motores, incluido Gemini, y puede tardar unos segundos.'
    : engines[method].help;
  if (emptyState.hidden === false) emptyState.querySelector('p').textContent = `Escribe tu mensaje o elige un ejemplo y pulsa ${submitLabel.textContent}.`;
}

function onMessageChange() {
  message.removeAttribute('aria-invalid');
  messageError.hidden = true;
  counter.textContent = `${message.value.length} / 5000`;
  document.querySelector('#clear-button').disabled = busy || (message.value.length === 0 && !lastTicket);
  staleNotice.hidden = !lastTicket || message.value.trim() === lastTicket;
}

function setBusy(value) {
  busy = value;
  form.querySelectorAll('button, input, textarea').forEach((control) => { control.disabled = value; });
  results.querySelectorAll('button').forEach((control) => { control.disabled = value; });
  document.querySelector('#clear-button').disabled = value || (message.value.length === 0 && !lastTicket);
  panel.setAttribute('aria-busy', String(value));
  document.querySelector('#analyze-button').classList.toggle('is-loading', value);
  if (value) submitLabel.textContent = 'Analizando…';
  else updateMethod();
}

function prepareCard(card, engine) {
  card.querySelector('.engine-state').textContent = 'Analizando';
  card.querySelector('.loading-state').hidden = false;
  card.querySelector('.loading-text').textContent = engines[engine].loading;
  card.querySelector('.result-body').hidden = true;
  card.querySelector('.error-box').hidden = true;
  card.querySelector('.copy-status').textContent = '';
  card.querySelector('.copy-button').textContent = 'Copiar respuesta';
  card.querySelectorAll('details').forEach((details) => { details.open = false; });
}

function createCard(engine, ticket) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.mode = engine;
  card.querySelector('.engine-name').textContent = engines[engine].name;
  card.querySelector('.engine-description').textContent = engines[engine].description;
  card.querySelector('.retry-button').textContent = `Reintentar ${engines[engine].action}`;
  card.querySelector('.retry-button').addEventListener('click', () => retry(engine, ticket, card));
  card.querySelector('.copy-button').addEventListener('click', async () => {
    const text = outcomes.get(engine)?.data?.response;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      card.querySelector('.copy-button').textContent = 'Copiada';
      card.querySelector('.copy-status').textContent = 'Respuesta copiada al portapapeles.';
    } catch {
      card.querySelector('.copy-status').textContent = 'No se pudo copiar. Selecciona el texto de la respuesta para copiarlo.';
    }
  });
  results.append(card);
  prepareCard(card, engine);
  return card;
}

async function analyze(engine, ticket, card) {
  const started = performance.now();
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: ticket, mode: engine }), signal: AbortSignal.timeout(40_000),
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('El servidor no devolvió una respuesta válida. Intenta nuevamente.'); }
    if (!response.ok) {
      const error = new Error(data?.error?.message || 'No fue posible analizar la solicitud.');
      error.code = data?.error?.code || `HTTP_${response.status}`;
      throw error;
    }
    if (!data || !Object.hasOwn(categories, data.category) || !Object.hasOwn(priorities, data.priority) || typeof data.response !== 'string' || typeof data.requiresHumanReview !== 'boolean' || data.mode !== engine) {
      throw new Error('El resultado recibido está incompleto. Intenta nuevamente.');
    }
    card.querySelector('.engine-state').textContent = `Listo · ${((performance.now() - started) / 1000).toFixed(1)} s`;
    card.querySelector('.category').textContent = categories[data.category];
    const priority = card.querySelector('.priority');
    priority.textContent = priorities[data.priority];
    priority.dataset.priority = data.priority;
    card.querySelector('.review').classList.toggle('needs-review', data.requiresHumanReview);
    card.querySelector('.review-title').textContent = data.requiresHumanReview ? 'Requiere revisión humana' : 'Respuesta lista para revisar';
    card.querySelector('.review-description').textContent = data.requiresHumanReview ? 'Solicita que una persona de soporte evalúe este caso.' : 'Verifica la sugerencia antes de compartirla.';
    card.querySelector('.response').textContent = data.response;
    card.querySelector('.json').textContent = JSON.stringify(data, null, 2);
    card.querySelector('.result-body').hidden = false;
    return { ok: true, data };
  } catch (error) {
    card.querySelector('.engine-state').textContent = 'Sin respuesta';
    card.querySelector('.error-box').hidden = false;
    card.querySelector('.error-message').textContent = error.name === 'TimeoutError'
      ? 'La conexión tardó demasiado. Puedes reintentar este motor.'
      : error.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor. Revisa que esté en ejecución.' : error.message;
    card.querySelector('.error-code').textContent = error.code || 'CONNECTION_ERROR';
    return { ok: false };
  } finally {
    card.querySelector('.loading-state').hidden = true;
  }
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const joinNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0]);

function updateSummary() {
  const entries = [...outcomes.entries()];
  const total = entries.length;
  const succeeded = entries.filter(([, entry]) => entry.ok);
  const failed = total - succeeded.length;
  const compare = total > 1;
  status.textContent = failed === 0 ? (compare ? `${total} análisis completados` : 'Análisis completado')
    : succeeded.length ? `${plural(succeeded.length, 'resultado disponible', 'resultados disponibles')} · ${plural(failed, 'motor', 'motores')} con error`
      : 'No se pudo completar el análisis';
  comparison.hidden = !compare;
  if (!compare) return;
  let title;
  let detail;
  let state;
  if (succeeded.length >= 2) {
    // Agrupa los motores que proponen la misma categoría y prioridad.
    const groups = new Map();
    for (const [engine, entry] of succeeded) {
      const key = `${entry.data.category}|${entry.data.priority}`;
      groups.set(key, [...(groups.get(key) || []), engines[engine].short]);
    }
    const agree = groups.size === 1;
    if (agree) {
      title = failed ? 'Los motores disponibles coinciden' : total === 3 ? 'Los tres motores coinciden' : 'Ambos motores coinciden';
      detail = 'La categoría y la prioridad son iguales. Compara sus respuestas a continuación.';
    } else {
      const [majority, ...others] = [...groups.values()].sort((a, b) => b.length - a.length);
      title = 'Los motores proponen resultados diferentes';
      detail = majority.length > 1
        ? `${joinNames(majority)} coinciden; ${joinNames(others.flat())} ${others.flat().length > 1 ? 'proponen' : 'propone'} otro resultado.`
        : 'Cada motor propone una clasificación distinta.';
      detail += ' Revisa la categoría, la prioridad y las respuestas antes de decidir el siguiente paso.';
    }
    if (new Set(succeeded.map(([, entry]) => entry.data.requiresHumanReview)).size > 1) detail += ' La indicación de revisión humana es diferente.';
    if (failed) detail += ' Reintenta el motor que falló para completar la comparación.';
    state = failed ? 'partial' : agree ? 'agreement' : 'difference';
  } else {
    title = succeeded.length ? 'Puedes consultar el resultado disponible' : 'Los motores no pudieron responder';
    detail = succeeded.length ? 'Reintenta los motores que fallaron para completar la comparación.' : 'Revisa los mensajes de error y vuelve a intentarlo.';
    state = 'partial';
  }
  comparison.dataset.state = state;
  document.querySelector('#comparison-title').textContent = title;
  document.querySelector('#comparison-detail').textContent = detail;
}

function focusResults() {
  resultsTitle.focus({ preventScroll: true });
  resultsTitle.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}

async function submit() {
  if (busy) return;
  const ticket = message.value.trim();
  if (!ticket || ticket.length > 5000) {
    messageError.textContent = !ticket ? 'Escribe una solicitud o elige uno de los ejemplos.' : 'La solicitud debe tener como máximo 5000 caracteres.';
    messageError.hidden = false;
    message.setAttribute('aria-invalid', 'true');
    message.focus();
    return;
  }
  const method = selectedMethod();
  const selected = method === 'compare' ? allEngines : [method];
  lastTicket = ticket;
  outcomes = new Map();
  staleNotice.hidden = true;
  messageError.hidden = true;
  message.removeAttribute('aria-invalid');
  context.hidden = false;
  document.querySelector('#analyzed-message').textContent = ticket;
  results.replaceChildren();
  results.classList.toggle('is-comparison', selected.length > 1);
  emptyState.hidden = true;
  comparison.hidden = true;
  const cards = selected.map((engine) => createCard(engine, ticket));
  setBusy(true);
  status.textContent = selected.length > 1 ? 'Comparando los tres motores…' : `Analizando ${engines[method].action}…`;
  focusResults();
  try {
    const responses = await Promise.all(selected.map((engine, index) => analyze(engine, ticket, cards[index])));
    selected.forEach((engine, index) => outcomes.set(engine, responses[index]));
    updateSummary();
  } finally { setBusy(false); }
}

async function retry(engine, ticket, card) {
  if (busy) return;
  prepareCard(card, engine);
  setBusy(true);
  comparison.hidden = true;
  status.textContent = `Reintentando ${engines[engine].action}…`;
  try {
    outcomes.set(engine, await analyze(engine, ticket, card));
    updateSummary();
  } finally { setBusy(false); }
}

message.addEventListener('input', onMessageChange);
message.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); form.requestSubmit(); }
});
methodInputs.forEach((input) => input.addEventListener('change', updateMethod));
document.querySelectorAll('[data-example]').forEach((button) => button.addEventListener('click', () => {
  message.value = examples[button.dataset.example];
  onMessageChange();
  message.focus();
}));
document.querySelector('#clear-button').addEventListener('click', () => {
  message.value = '';
  lastTicket = '';
  outcomes = new Map();
  results.replaceChildren();
  context.hidden = true;
  comparison.hidden = true;
  emptyState.hidden = false;
  status.textContent = 'Escribe una solicitud para comenzar';
  onMessageChange();
  updateMethod();
  message.focus();
});
form.addEventListener('submit', (event) => { event.preventDefault(); submit(); });
onMessageChange();
updateMethod();
