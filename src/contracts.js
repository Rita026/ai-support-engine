import { z } from 'zod';

export const CATEGORIES = ['ACCESS', 'BUG', 'FEATURE', 'SECURITY'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const MODES = ['traditional', 'generative'];

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
