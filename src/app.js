import express from 'express';
import { fileURLToPath } from 'node:url';
import { requestSchema, resultSchema } from './contracts.js';
import { AppError } from './errors.js';
import { applySafetyReview } from './safety.js';
import { createGenerativeAnalyzer } from './engines/generative.js';

export function createApp({ traditionalAnalyzer, generativeAnalyzer = createGenerativeAnalyzer() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    next();
  });

  app.post('/api/analyze', (req, _res, next) => {
    if (!req.is('application/json')) {
      return next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envía la solicitud como application/json.'));
    }
    next();
  }, express.json({ limit: '64kb' }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const input = requestSchema.safeParse(req.body);
    if (!input.success) {
      throw new AppError(400, 'INVALID_REQUEST', 'Envía message como texto de 1 a 5000 caracteres y mode como traditional o generative, sin campos adicionales.');
    }
    const { message, mode } = input.data;
    const analyzer = mode === 'traditional' ? traditionalAnalyzer : generativeAnalyzer;
    if (typeof analyzer !== 'function') {
      throw new AppError(503, 'ENGINE_NOT_CONFIGURED', 'El motor solicitado no está configurado.');
    }
    const result = await analyzer(message);
    const checked = resultSchema.safeParse({ ...result, mode });
    if (!checked.success) {
      throw new AppError(500, 'INVALID_ENGINE_RESULT', 'El motor no devolvió el formato esperado.');
    }
    res.json(applySafetyReview(message, checked.data));
  });

  // Vercel serves public/ directly; this middleware is for the local server.
  app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url)), { dotfiles: 'deny' }));
  app.use((req, _res, next) => {
    if (req.path === '/api/analyze') {
      return next(new AppError(405, 'METHOD_NOT_ALLOWED', 'Usa POST para analizar una solicitud.'));
    }
    next(new AppError(404, 'NOT_FOUND', 'Recurso no encontrado.'));
  });
  app.use((error, _req, res, _next) => {
    let failure = error;
    if (error.type === 'entity.parse.failed') {
      failure = new AppError(400, 'INVALID_JSON', 'El cuerpo de la solicitud no es JSON válido.');
    } else if (error.type === 'entity.too.large') {
      failure = new AppError(413, 'PAYLOAD_TOO_LARGE', 'La solicitud supera el tamaño permitido.');
    } else if (!(error instanceof AppError)) {
      failure = new AppError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado al analizar la solicitud.');
    }
    if (failure.status >= 500) console.error(`[analyze] ${failure.code}`);
    res.set('Cache-Control', 'no-store');
    if (failure.status === 405) res.set('Allow', 'POST');
    res.status(failure.status).json({ error: { code: failure.code, message: failure.message } });
  });
  return app;
}
