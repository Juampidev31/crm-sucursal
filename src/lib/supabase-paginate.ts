/**
 * Paginación para superar el límite de filas de PostgREST/Supabase.
 *
 * Supabase corta toda respuesta en `max-rows` (1000 por defecto): una consulta
 * sin `Range` devuelve `content-range: 0-999/*` en silencio, sin error. Para
 * traer una tabla completa hay que pedir páginas sucesivas con `.range()`.
 *
 * Esta función encapsula ese bucle, que estaba repetido a mano en varios
 * módulos (RegistrosProvider, BulkModifyTab, ReasignadosTab, auditoría de
 * Ajustes, export-xlsx). No hace nada más: recibe una función que construye
 * la consulta de una página y devuelve todas las filas concatenadas.
 */

/** Límite de filas por respuesta que aplica Supabase por defecto. */
export const SUPABASE_PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export interface FetchAllRowsOptions {
  /** Filas por página. Debe coincidir con el `max-rows` del backend. */
  pageSize?: number;
  /** Tope defensivo de filas, para no iterar sin fin si el backend se comporta raro. */
  safetyLimit?: number;
  /** Se consulta entre páginas; si devuelve true, se aborta (efecto desmontado). */
  isCancelled?: () => boolean;
}

/**
 * Pide páginas sucesivas hasta que una devuelva menos de `pageSize`.
 *
 * @param fetchPage recibe el rango inclusivo `[from, to]` y devuelve esa página.
 * @returns `rows` con todo lo acumulado y `error` con el primer fallo (si lo hubo).
 *          Ante error se devuelve lo acumulado hasta ese punto, igual que hacía
 *          el bucle manual que reemplaza.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: FetchAllRowsOptions = {},
): Promise<{ rows: T[]; error: string | null; cancelled: boolean }> {
  const pageSize = options.pageSize ?? SUPABASE_PAGE_SIZE;
  const safetyLimit = options.safetyLimit ?? 100_000;
  const rows: T[] = [];
  let from = 0;

  while (from < safetyLimit) {
    if (options.isCancelled?.()) return { rows, error: null, cancelled: true };

    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { rows, error: error.message, cancelled: false };
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { rows, error: null, cancelled: options.isCancelled?.() ?? false };
}
