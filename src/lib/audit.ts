import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export interface AuditEntry {
  id_registro?: string;
  analista?: string;
  accion: string;
  campo_modificado?: string;
  valor_anterior?: string;
  valor_nuevo?: string;
}

/**
 * Escribe una entrada de auditoría en la tabla `auditoria`.
 * Fire-and-forget: no bloquea la UI (no usar await).
 */
export function logAudit(entry: AuditEntry): void {
  const session = getSession();
  supabase.from('auditoria').insert({
    id_registro:      entry.id_registro      ?? '',
    analista:         entry.analista         ?? session?.username ?? '',
    accion:           entry.accion,
    campo_modificado: entry.campo_modificado ?? '',
    valor_anterior:   entry.valor_anterior   ?? '',
    valor_nuevo:      entry.valor_nuevo      ?? '',
    id_analista:      session?.username       ?? '',
  }).then(({ error }) => {
    if (error) console.error('[Auditoría] Error al escribir log:', error.message, error.details ?? '');
  });
}
