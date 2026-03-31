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

// Canal singleton para broadcast en tiempo real — se suscribe al importar el módulo
const auditBroadcastChannel = supabase
  .channel('auditoria-live', { config: { broadcast: { self: true } } })
  .subscribe();

/**
 * Escribe una entrada de auditoría en la tabla `auditoria` y la difunde
 * por broadcast para que la tab de Auditoría se actualice en tiempo real.
 * Fire-and-forget: no bloquea la UI (no usar await).
 */
export function logAudit(entry: AuditEntry): void {
  const session = getSession();
  const now = new Date().toISOString();
  const payload = {
    id_registro: entry.id_registro ?? '',
    analista: entry.analista ?? session?.username ?? '',
    accion: entry.accion,
    campo_modificado: entry.campo_modificado ?? '',
    valor_anterior: entry.valor_anterior ?? '',
    valor_nuevo: entry.valor_nuevo ?? '',
    id_analista: session?.username ?? '',
    fecha_hora: now,
  };

  console.log('[Auditoría] Payload antes de insertar:', payload);
  supabase.from('auditoria').insert(payload).select().then(({ data, error }) => {
    if (error) {
      console.error('[Auditoría] Error al escribir log:', error.message, error.details ?? '');
      return;
    }
    console.log('[Auditoría] Insertado:', data?.[0]);
    const inserted = data?.[0] ?? { ...payload, fecha_hora: now };
    auditBroadcastChannel.send({
      type: 'broadcast',
      event: 'auditoria_insert',
      payload: { entry: inserted },
    });
  });
}
