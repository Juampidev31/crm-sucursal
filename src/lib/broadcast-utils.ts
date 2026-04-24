import { z } from 'zod';

/**
 * Valida un payload de broadcast entrante contra un schema Zod.
 * Retorna el dato tipado o null si la validación falla (con warning en consola).
 */
export function validateBroadcast<T>(event: string, schema: z.ZodType<T>, payload: unknown): T | null {
  const r = schema.safeParse(payload);
  if (!r.success) {
    console.warn(`[broadcast] ${event} payload inválido:`, r.error.issues);
    return null;
  }
  return r.data;
}
