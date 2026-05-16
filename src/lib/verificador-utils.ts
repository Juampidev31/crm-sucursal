import { Registro } from '@/types';

export type ColumnRole = 'fecha' | 'tipo_cliente' | 'cuil' | 'apellido_nombre' | 'edad' | 'monto' | 'cuotas' | 'analista' | 'ignore';

export interface ParsedRow {
  cells: string[];
}

export interface ColumnMapping {
  [colIndex: number]: ColumnRole;
}

export type MatchStatus = 'found' | 'mismatch' | 'not_found';

export interface VerificadorResult {
  row: ParsedRow;
  status: MatchStatus;
  dbId?: string;
  dbImporte?: number;
  dbFecha?: string;
  dbEstado?: string;
  diffDetail?: string;
}

/** Parsea texto copiado de Excel (separado por \t y \n). */
export function parsePastedText(text: string): ParsedRow[] {
  return text
    .split('\n')
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.trim() !== '')
    .map(line => ({ cells: line.split('\t') }));
}

/** Normaliza CUIL eliminando guiones y espacios */
export function normalizeCuil(raw: string): string {
  return raw.replace(/[-\s]/g, '').trim();
}

const MESES_ES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

/**
 * Parsea una fecha completa a YYYY-MM-DD para comparación.
 * Acepta: "9/1/2025", "01/09/2025", "2025-09-01"
 * Devuelve null si no puede parsear.
 */
export function parseFullDate(raw: string): string | null {
  const s = raw.trim();

  // "2025-09-01"
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;

  // "04/08/2025" → D/M/YYYY (formato argentino)
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  return null;
}

/**
 * Formatea una fecha cruda a DD/MM/YYYY para mostrar.
 * Si no puede parsear, devuelve el valor original.
 */
export function formatDateAR(raw: string): string {
  const s = raw.trim();
  // M/D/YYYY, D/M/YYYY, M-D-YYYY, D-M-YYYY (separador / o -)
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) {
    const a = parseInt(mdy[1]), b = parseInt(mdy[2]);
    const [month, day] = b > 12 ? [a, b] : [b, a];
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${mdy[3]}`;
  }
  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return raw;
}

/**
 * Extrae YYYY-MM de varios formatos:
 * "01/2025", "enero 2025", "15/01/2025", "2025-01-15"
 * Devuelve null si no puede parsear.
 */
export function extractYearMonth(raw: string): string | null {
  const s = raw.trim().toLowerCase();

  // "01/2025"
  const m1 = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[2]}-${m1[1].padStart(2, '0')}`;

  // "15/01/2025", "9/17/2025", "9-9-2025", "22-9-2025" — separador / o -
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m2) {
    const a = parseInt(m2[1]), b = parseInt(m2[2]);
    // Si b > 12 es M/D/YYYY (el mes es a), si a > 12 es D/M/YYYY (el mes es b)
    const month = b > 12 ? a : b;
    return `${m2[3]}-${month.toString().padStart(2, '0')}`;
  }

  // "2025-01-15"
  const m3 = s.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (m3) return `${m3[1]}-${m3[2]}`;

  // "enero 2025"
  for (const [nombre, num] of Object.entries(MESES_ES)) {
    const re = new RegExp(`\\b${nombre}\\b`);
    if (re.test(s)) {
      const yearMatch = s.match(/\d{4}/);
      if (yearMatch) return `${yearMatch[0]}-${num}`;
    }
  }

  return null;
}

/**
 * Cruza filas parseadas contra registros de DB.
 * Si no hay columna de mes mapeada, busca cualquier registro del CUIL.
 */
export function verificarFilas(
  rows: ParsedRow[],
  mapping: ColumnMapping,
  dbRecords: Registro[],
): VerificadorResult[] {
  const dbByCuil = new Map<string, Registro[]>();
  dbRecords.forEach(r => {
    const key = normalizeCuil(r.cuil);
    const list = dbByCuil.get(key) ?? [];
    list.push(r);
    dbByCuil.set(key, list);
  });

  const cuilCol    = Object.entries(mapping).find(([, role]) => role === 'cuil')?.[0];
  const mesCol     = Object.entries(mapping).find(([, role]) => role === 'fecha')?.[0];
  const importeCol = Object.entries(mapping).find(([, role]) => role === 'monto')?.[0];

  // Greedy matching: cada registro de DB se asigna a lo sumo a una fila Excel
  const usedIds = new Set<string>();

  return rows.map(row => {
    if (cuilCol === undefined) return { row, status: 'not_found' as MatchStatus };

    const rawCuil = row.cells[Number(cuilCol)] ?? '';
    const cuil = normalizeCuil(rawCuil);
    if (!cuil) return { row, status: 'not_found' };
    const candidates = dbByCuil.get(cuil) ?? [];

    if (candidates.length === 0) return { row, status: 'not_found' };

    // Filtrar por mes si hay columna de mes
    let pool = candidates;
    if (mesCol !== undefined) {
      const rawMes = row.cells[Number(mesCol)] ?? '';
      const ym = extractYearMonth(rawMes);
      if (ym) {
        pool = candidates.filter(r => r.fecha?.substring(0, 7) === ym);
      }
    }

    if (pool.length === 0) return { row, status: 'not_found' };

    // Comparar importe si hay columna de importe
    if (importeCol !== undefined) {
      const rawImporte = row.cells[Number(importeCol)] ?? '';
      // Argentine: "1.500,75" → dot=thousands, comma=decimal
      // US/ISO: "1500.75" → dot=decimal
      const isArgentine = rawImporte.indexOf(',') > rawImporte.indexOf('.');
      const normalized = isArgentine
        ? rawImporte.replace(/\./g, '').replace(',', '.')
        : rawImporte.replace(/,/g, '');
      const csvImporte = parseFloat(normalized.replace(/[$\s]/g, ''));

      if (!isNaN(csvImporte)) {
        const exact = pool.find(r => Math.abs((r.monto ?? 0) - csvImporte) <= 1 && !usedIds.has(r.id));
        if (exact) {
          usedIds.add(exact.id);
          return { row, status: 'found', dbId: exact.id, dbImporte: exact.monto ?? 0, dbFecha: exact.fecha ?? undefined, dbEstado: exact.estado };
        }
        // Mismo mes/CUIL pero importe diferente (o todos usados)
        const first = pool.find(r => !usedIds.has(r.id)) ?? pool[0];
        return {
          row, status: 'mismatch',
          dbId: first.id,
          dbImporte: first.monto ?? 0,
          dbFecha: first.fecha ?? undefined,
          dbEstado: first.estado,
          diffDetail: `Excel $${csvImporte.toLocaleString('es-AR')} — DB $${(first.monto ?? 0).toLocaleString('es-AR')}`,
        };
      }
    }

    // Sin importe o no parseable → encontrado si hay candidato no usado
    const first = pool.find(r => !usedIds.has(r.id)) ?? pool[0];
    usedIds.add(first.id);
    return { row, status: 'found', dbId: first.id, dbImporte: first.monto ?? 0, dbFecha: first.fecha ?? undefined, dbEstado: first.estado };
  });
}
