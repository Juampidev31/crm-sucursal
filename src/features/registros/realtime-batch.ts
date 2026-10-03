import type { Registro } from '@/types';

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';
export type CambioRegistro = { type: ChangeType; registro: Registro };

// `updated_at` lo pisa un trigger de la DB en CADA escritura, así que el eco
// realtime de una modificación masiva siempre trae un valor nuevo aunque el
// dato de negocio no haya cambiado. Si lo tuviéramos en cuenta, ningún eco
// podría descartarse y volveríamos a re-renderizar la app una vez por fila.
// La app no lee esta columna en ninguna pantalla; se re-sincroniza sola en el
// próximo refresh() completo.
const CAMPOS_IGNORADOS = new Set(['updated_at']);

function mismoValor(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return false;
}

// Comparación por valor sobre la unión de claves: una clave ausente y una clave
// con `undefined` son lo mismo (las filas cargadas con un SELECT parcial no
// traen todas las columnas que sí trae el payload de realtime).
export function mismoRegistro(a: Registro, b: Registro): boolean {
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of claves) {
    if (CAMPOS_IGNORADOS.has(k)) continue;
    if (!mismoValor((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

// Aplica un lote de cambios realtime en una sola pasada.
//
// Devuelve la MISMA referencia si el lote no modifica nada: es el caso normal
// cuando el cambio lo hizo esta misma pestaña (ya se aplicó local con
// `mutateRegistros`), y hace que React se saltee el re-render por completo.
export function aplicarCambiosRegistros(prev: Registro[], cambios: CambioRegistro[]): Registro[] {
  if (cambios.length === 0) return prev;

  const posicion = new Map<string, number>();
  for (let i = 0; i < prev.length; i++) posicion.set(prev[i].id, i);

  let copia: Registro[] | null = null;      // copia perezosa: sólo si hay que tocar algo
  const borrados = new Set<string>();
  const agregados = new Map<string, Registro>();

  for (const { type, registro } of cambios) {
    const id = registro.id;
    const pos = posicion.get(id);

    if (type === 'DELETE') {
      agregados.delete(id);                 // alta y baja dentro del lote se cancelan
      if (pos !== undefined) borrados.add(id);
      continue;
    }

    if (pos !== undefined) {
      borrados.delete(id);                  // re-aparece: la baja previa del lote queda sin efecto
      const actual = (copia ?? prev)[pos];
      if (!mismoRegistro(actual, registro)) {
        copia ??= prev.slice();
        copia[pos] = registro;
      }
      continue;
    }

    const yaAgregado = agregados.get(id);
    if (!yaAgregado || !mismoRegistro(yaAgregado, registro)) agregados.set(id, registro);
  }

  if (copia === null && borrados.size === 0 && agregados.size === 0) return prev;

  let resultado = copia ?? prev;
  if (borrados.size > 0) resultado = resultado.filter(r => !borrados.has(r.id));
  if (agregados.size > 0) {
    // Los nuevos van al principio y el último en llegar queda primero, igual
    // que el `[reg, ...prev]` que hacía el handler fila por fila.
    resultado = [...Array.from(agregados.values()).reverse(), ...resultado];
  }

  return resultado;
}
