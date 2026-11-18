import { z } from 'zod';

export const CATEGORIES = ['ACCESS', 'BUG', 'FEATURE', 'SECURITY'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const MODES = ['traditional', 'generative', 'ml'];

export const requestSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  mode: z.enum(MODES),
}).strict();

export const analysisSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  response: z.string().trim().min(1).max(5000),
  requiresHumanReview: z.boolean(),
}).strict();

export const resultSchema = analysisSchema.extend({ mode: z.enum(MODES) });

// The same schema is sent to Gemini and used to validate its parsed JSON.
export const analysisJsonSchema = z.toJSONSchema(analysisSchema);

// Respuesta del servicio Python (ml-service). Incluye datos de diagnóstico que no
// forman parte del contrato público: Node solo devuelve los campos de analysisSchema.
export const mlServiceSchema = analysisSchema.extend({
  confidence: z.object({
    category: z.number().min(0).max(1),
    priority: z.number().min(0).max(1),
  }).strict(),
  modelVersion: z.string().min(1).max(100),
}).strict();
