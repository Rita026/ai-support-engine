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
const engineNames = { traditional: 'Por reglas', generative: 'Con Gemini' };
const examples = {
  access: 'No puedo iniciar sesión. El sistema indica que mi contraseña es incorrecta.',
  bug: 'Al guardar un documento aparece un error 500 y no puedo completar mi trabajo.',
  feature: 'Me gustaría agregar una opción para exportar los reportes a Excel.',
  security: 'Detecté una posible vulnerabilidad que permite acceder a datos de otras cuentas.',
};

const selectedMethod = () => methodInputs.find((input) => input.checked).value;

function updateMethod() {
  const method = selectedMethod();
  if (!busy) submitLabel.textContent = method === 'compare' ? 'Comparar resultados' : method === 'traditional' ? 'Analizar con reglas' : 'Analizar con Gemini';
  document.querySelector('#method-help').textContent = method === 'compare'
    ? 'Comparar incluye un análisis con Gemini y puede tardar unos segundos.'
    : method === 'traditional' ? 'Este método no necesita una conexión con Gemini.'
      : 'Gemini puede tardar unos segundos en preparar la respuesta.';
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
  card.querySelector('.loading-text').textContent = engine === 'generative' ? 'Gemini está preparando su respuesta…' : 'Revisando las reglas de clasificación…';
  card.querySelector('.result-body').hidden = true;
  card.querySelector('.error-box').hidden = true;
  card.querySelector('.copy-status').textContent = '';
  card.querySelector('.copy-button').textContent = 'Copiar respuesta';
  card.querySelectorAll('details').forEach((details) => { details.open = false; });
}

function createCard(engine, ticket) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.mode = engine;
  card.querySelector('.engine-name').textContent = engineNames[engine];
  card.querySelector('.engine-description').textContent = engine === 'traditional' ? 'Clasificación con reglas y respuesta predefinida' : 'Interpretación del contexto y respuesta personalizada';
  card.querySelector('.retry-button').textContent = engine === 'generative' ? 'Reintentar con Gemini' : 'Reintentar con reglas';
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

function updateSummary() {
  const entries = [...outcomes.values()];
  const succeeded = entries.filter((entry) => entry.ok).length;
  const compare = entries.length === 2;
  status.textContent = succeeded === entries.length ? (compare ? '2 análisis completados' : 'Análisis completado')
    : succeeded ? '1 resultado disponible · 1 motor con error' : 'No se pudo completar el análisis';
  comparison.hidden = !compare;
  if (!compare) return;
  let title;
  let detail;
  let state;
  if (succeeded === 2) {
    const first = entries[0].data;
    const second = entries[1].data;
    const agree = first.category === second.category && first.priority === second.priority;
    title = agree ? 'Ambos motores coinciden' : 'Los motores proponen resultados diferentes';
    detail = agree ? 'La categoría y la prioridad son iguales. Compara sus respuestas a continuación.' : 'Revisa la categoría, la prioridad y las respuestas antes de decidir el siguiente paso.';
    if (first.requiresHumanReview !== second.requiresHumanReview) detail += ' La indicación de revisión humana es diferente.';
    state = agree ? 'agreement' : 'difference';
  } else {
    title = succeeded ? 'Puedes consultar el resultado disponible' : 'Los motores no pudieron responder';
    detail = succeeded ? 'Reintenta el motor que falló para completar la comparación.' : 'Revisa los mensajes de error y vuelve a intentarlo.';
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
  const engines = method === 'compare' ? ['traditional', 'generative'] : [method];
  lastTicket = ticket;
  outcomes = new Map();
  staleNotice.hidden = true;
  messageError.hidden = true;
  message.removeAttribute('aria-invalid');
  context.hidden = false;
  document.querySelector('#analyzed-message').textContent = ticket;
  results.replaceChildren();
  results.classList.toggle('is-comparison', engines.length === 2);
  emptyState.hidden = true;
  comparison.hidden = true;
  const cards = engines.map((engine) => createCard(engine, ticket));
  setBusy(true);
  status.textContent = engines.length === 2 ? 'Comparando los dos motores…' : `Analizando ${method === 'traditional' ? 'con reglas' : 'con Gemini'}…`;
  focusResults();
  try {
    const responses = await Promise.all(engines.map((engine, index) => analyze(engine, ticket, cards[index])));
    engines.forEach((engine, index) => outcomes.set(engine, responses[index]));
    updateSummary();
  } finally { setBusy(false); }
}

async function retry(engine, ticket, card) {
  if (busy) return;
  prepareCard(card, engine);
  setBusy(true);
  comparison.hidden = true;
  status.textContent = `Reintentando ${engine === 'generative' ? 'con Gemini' : 'con reglas'}…`;
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
