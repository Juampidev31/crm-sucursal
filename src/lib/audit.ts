import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export interface AuditEntry {
  accion: string;
  campo_modificado?: string;
  valor_anterior?: string;
  valor_nuevo?: string;
  id_registro?: string;
  nombre?: string;
  cuil?: string;
  analista?: string;
}

/**
 * Escribe una entrada de auditoría en la tabla `auditoria` y la difunde
 * por broadcast para que la tab de Auditoría se actualice en tiempo real.
 * Fire-and-forget: no bloquea la UI (no usar await).
 *
 * NOTA: en lugar de un canal singleton (que creaba conflictos de nombre con
 * el canal receptor en ajustes/page.tsx), se usa el canal efímero de Supabase
 * que ya está suscripto en ajustes — el evento se transmite al mismo nombre
 * de canal 'auditoria-live' y Supabase lo rutea correctamente.
 */
export function logAudit(entry: AuditEntry): void {
  const session = getSession();
  const now = new Date().toISOString();
  const payload = {
    accion: entry.accion,
    campo_modificado: entry.campo_modificado ?? '',
    valor_anterior: entry.valor_anterior ?? '',
    valor_nuevo: entry.valor_nuevo ?? '',
    analista: entry.analista ?? '',
    id_analista: session?.username ?? '',
    id_registro: entry.id_registro ?? '',
    nombre: entry.nombre ?? '',
    cuil: entry.cuil ?? '',
    fecha_hora: now,
  };

  supabase.from('auditoria').insert(payload).select().then(({ data, error }) => {
    if (error) {
      console.error('[Auditoría] Error al escribir log:', error.message, error.details ?? '');
      return;
    }
    const inserted = data?.[0] ?? { ...payload, fecha_hora: now };

    // Emitir el evento por el canal 'auditoria-live'.
    // Supabase permite enviar a un canal aunque no estés suscripto desde este
    // cliente — el receptor en ajustes/page.tsx lo capturará.
    const bc = supabase
      .channel('auditoria-live', { config: { broadcast: { self: true } } })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          bc.send({
            type: 'broadcast',
            event: 'auditoria_insert',
            payload: { entry: inserted },
          }).finally(() => {
            supabase.removeChannel(bc);
          });
        }
      });
  });
}
