import { supabase } from '@/lib/supabase';
import { normalizePersonName } from '@/lib/normalize-person-name';

export interface NormalizableNameRow {
  id: string;
  nombre: string;
}

export interface NormalizationResult<T extends NormalizableNameRow> {
  changed: T[];
  failed: number;
}

const CONCURRENCY = 40;

export function rowsNeedingNameNormalization<T extends NormalizableNameRow>(rows: T[]): T[] {
  return rows.filter(row => normalizePersonName(row.nombre) !== row.nombre);
}

/**
 * Persiste nombres diferentes por fila. Cada UPDATE genera un evento
 * postgres_changes, que mantiene sincronizadas las sesiones abiertas.
 */
export async function persistNormalizedNames<T extends NormalizableNameRow>(
  table: 'registros' | 'gestion_diaria',
  rows: T[],
  onProgress?: (completed: number, total: number) => void,
): Promise<NormalizationResult<T>> {
  const pending = rowsNeedingNameNormalization(rows);
  const changed: T[] = [];
  let failed = 0;

  for (let start = 0; start < pending.length; start += CONCURRENCY) {
    const batch = pending.slice(start, start + CONCURRENCY);
    const results = await Promise.all(batch.map(async row => {
      const nombre = normalizePersonName(row.nombre);
      const { error } = await supabase.from(table).update({ nombre }).eq('id', row.id);
      return error ? null : { ...row, nombre };
    }));

    results.forEach(result => {
      if (result) changed.push(result);
      else failed += 1;
    });
    onProgress?.(Math.min(start + batch.length, pending.length), pending.length);
  }

  return { changed, failed };
}
