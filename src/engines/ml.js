import { mlServiceSchema } from '../contracts.js';
import { AppError } from '../errors.js';

export const DEFAULT_ML_SERVICE_URL = 'http://127.0.0.1:8000';

const timeoutError = () => new AppError(504, 'ML_TIMEOUT', 'El servicio de machine learning tardó demasiado. Intenta nuevamente.');
const invalidResponse = (detail) => new AppError(502, 'ML_INVALID_RESPONSE', `El servicio de machine learning ${detail}`);
const isTimeout = (error) => error?.name === 'TimeoutError' || error?.name === 'AbortError';

// Solo se acepta un origen HTTP(S) sin credenciales ni parámetros; la ruta base es opcional.
export function predictEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
  return new URL('predict', url.href.endsWith('/') ? url.href : `${url.href}/`);
}

// fetchImpl es inyectable para probar errores sin levantar el servicio Python.
export function createMlAnalyzer({
  baseUrl = process.env.ML_SERVICE_URL?.trim() || DEFAULT_ML_SERVICE_URL,
  timeoutMs = 10_000,
  fetchImpl = globalThis.fetch,
} = {}) {
  const endpoint = predictEndpoint(baseUrl);

  return async function analyzeMl(message) {
    if (!endpoint) {
      throw new AppError(503, 'ML_NOT_CONFIGURED', 'ML_SERVICE_URL no es una URL HTTP válida. Revisa la configuración del servidor.');
    }
    const signal = AbortSignal.timeout(timeoutMs);
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message }),
        signal,
        redirect: 'error',
      });
    } catch (error) {
      if (isTimeout(error) || signal.aborted) throw timeoutError();
      throw new AppError(503, 'ML_UNAVAILABLE', 'No fue posible conectar con el servicio de machine learning. Verifica que esté en ejecución.');
    }
    if (response.status === 503) {
      throw new AppError(503, 'ML_NOT_READY', 'El modelo de machine learning no está disponible. Revisa el entrenamiento del servicio.');
    }
    if (!response.ok) {
      throw new AppError(502, 'ML_UNAVAILABLE', 'El servicio de machine learning no pudo analizar la solicitud.');
    }
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (isTimeout(error) || signal.aborted) throw timeoutError();
      throw invalidResponse('no devolvió JSON válido.');
    }
    const checked = mlServiceSchema.safeParse(payload);
    if (!checked.success) throw invalidResponse('devolvió un formato inesperado.');
    // La confianza y la versión del modelo no forman parte del contrato público.
    const { confidence: _confidence, modelVersion: _modelVersion, ...analysis } = checked.data;
    return { ...analysis, mode: 'ml' };
  };
}
