const form = document.querySelector('#analyze-form');
const message = document.querySelector('#message');
const mode = document.querySelector('#mode');
const counter = document.querySelector('#counter');
const status = document.querySelector('#status');
const panel = document.querySelector('.results-panel');
const results = document.querySelector('#results');
const emptyState = document.querySelector('#empty-state');
const template = document.querySelector('#result-template');
const buttons = [...document.querySelectorAll('button')];
let busy = false;

const examples = {
  access: 'No puedo iniciar sesión. El sistema indica que mi contraseña es incorrecta.',
  bug: 'Al guardar un documento aparece un error 500 y no puedo completar mi trabajo.',
  feature: 'Me gustaría agregar una opción para exportar los reportes a Excel.',
  security: 'Detecté una posible vulnerabilidad que permite acceder a datos de otras cuentas.',
};
message.addEventListener('input', () => {
  message.setCustomValidity('');
  counter.textContent = `${message.value.length} / 5000`;
});
document.querySelectorAll('[data-example]').forEach((button) => {
  button.addEventListener('click', () => {
    message.value = examples[button.dataset.example];
    message.dispatchEvent(new Event('input'));
    message.focus();
  });
});

function resultCard(engine, ticket) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.mode = engine;
  card.querySelector('.engine-name').textContent = engine === 'traditional' ? 'Motor tradicional' : 'Gemini';
  card.querySelector('.engine-detail').textContent = 'Analizando…';
  card.querySelector('.analyzed-message').textContent = ticket;
  card.querySelector('.result-body').hidden = true;
  results.append(card);
  return card;
}

async function analyze(engine, ticket, card) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: ticket, mode: engine }),
      signal: AbortSignal.timeout(40_000),
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('El servidor no devolvió una respuesta JSON válida.'); }
    if (!response.ok) {
      const error = new Error(data.error?.message || 'No fue posible analizar la solicitud.');
      error.code = data.error?.code || `HTTP_${response.status}`;
      throw error;
    }
    card.querySelector('.engine-detail').textContent = 'Análisis completado';
    card.querySelector('.category').textContent = data.category;
    const priority = card.querySelector('.priority');
    priority.textContent = data.priority;
    priority.dataset.priority = data.priority;
    const review = card.querySelector('.review');
    review.textContent = data.requiresHumanReview ? 'Requiere revisión humana' : 'Sin revisión humana requerida';
    review.classList.toggle('needs-review', data.requiresHumanReview);
    card.querySelector('.response').textContent = data.response;
    card.querySelector('.json').textContent = JSON.stringify(data, null, 2);
    card.querySelector('.result-body').hidden = false;
    return true;
  } catch (error) {
    card.querySelector('.engine-detail').textContent = 'Análisis no disponible';
    card.querySelector('.error-box').hidden = false;
    card.querySelector('.error-message').textContent = error.name === 'TimeoutError'
      ? 'La conexión tardó demasiado. Intenta nuevamente.'
      : error.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor. Revisa que esté en ejecución.' : error.message;
    card.querySelector('.error-code').textContent = error.code || 'CONNECTION_ERROR';
    return false;
  }
}

async function submit(compare) {
  if (busy) return;
  message.setCustomValidity(message.value.trim() ? '' : 'Escribe una solicitud de soporte.');
  if (!form.reportValidity()) return;
  busy = true;
  const ticket = message.value.trim();
  const engines = compare ? ['traditional', 'generative'] : [mode.value];
  buttons.forEach((button) => { button.disabled = true; });
  mode.disabled = true;
  message.disabled = true;
  panel.setAttribute('aria-busy', 'true');
  status.textContent = compare ? 'Comparando ambos motores…' : 'Analizando tu solicitud…';
  results.replaceChildren();
  emptyState.hidden = true;
  const cards = engines.map((engine) => resultCard(engine, ticket));
  try {
    const outcomes = await Promise.all(engines.map((engine, index) => analyze(engine, ticket, cards[index])));
    const succeeded = outcomes.filter(Boolean).length;
    status.textContent = succeeded === engines.length ? (compare ? 'Comparación completada' : 'Análisis completado')
      : succeeded ? 'Comparación parcial: revisa el error del motor' : 'No se pudo completar el análisis';
  } finally {
    busy = false;
    buttons.forEach((button) => { button.disabled = false; });
    mode.disabled = false;
    message.disabled = false;
    panel.setAttribute('aria-busy', 'false');
  }
}
form.addEventListener('submit', (event) => { event.preventDefault(); submit(false); });
document.querySelector('#compare-button').addEventListener('click', () => submit(true));
