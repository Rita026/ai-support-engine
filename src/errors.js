export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export function providerError(error) {
  if (error instanceof AppError) return error;
  const status = Number(error?.status ?? error?.code);
  // Inspect provider details only to classify the failure; never send or log them.
  const detail = String(error?.message ?? '');
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || /timeout|timed out|aborted/i.test(detail)) {
    return new AppError(504, 'GEMINI_TIMEOUT', 'Gemini tardó demasiado. Intenta nuevamente.');
  }
  if (status === 429) {
    return new AppError(429, 'GEMINI_QUOTA', 'Se alcanzó la cuota de Gemini. Espera y revisa los límites de tu cuenta.');
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid|API key expired/i.test(detail)) {
    return new AppError(503, 'GEMINI_AUTH', 'La clave de Gemini no es válida o no tiene permisos. Revisa la configuración del servidor.');
  }
  if (status === 404) {
    return new AppError(503, 'GEMINI_MODEL', 'El modelo configurado no está disponible. Revisa GEMINI_MODEL.');
  }
  return new AppError(502, 'GEMINI_UNAVAILABLE', 'No fue posible obtener una respuesta de Gemini. Intenta más tarde.');
}
