import type { GestionDiaria } from '@/types';
import { formatCurrency } from '@/lib/utils';

export const GESTION_SHEETS = {
  Victoria: '1GVPFJrrX4j0AM3vd4meGWtd6O-IS67Ljx7l_3Enyb_I',
  Magali: '1WUz03tOW-pYVop-cfXYxUlX0wnCxToHUX9V3hU6NGFc',
} as const;

export const GESTION_SHEET_TABS = {
  ingresos: { gid: '1686263284', label: 'Ingreso diario ventas' },
  flyers: { gid: '2080980149', label: 'Flyers' },
  emails: { gid: '1110496106', label: 'Emails enviados' },
} as const;

export type GestionSheetAnalyst = keyof typeof GESTION_SHEETS;

interface GoogleSheetCell { v?: unknown; f?: string }
interface GoogleSheetResponse {
  status?: string;
  errors?: Array<{ detailed_message?: string; message?: string }>;
  table?: {
    cols?: Array<{ id?: string; label?: string }>;
    rows?: Array<{ c?: Array<GoogleSheetCell | null> }>;
  };
}

export interface SheetTableData {
  columns: string[];
  rows: string[][];
}

export interface IncomeSheetRow {
  id: string;
  databaseId?: string;
  analista?: string;
  tipoCliente: string;
  fecha: string;
  nombre: string;
  cuil: string;
  actividad: string;
  estado: string;
  score: string;
  tipoOperacion: string;
  montoOtorgado: string;
  interesVenta: string;
  comentarios: string;
}

export interface PersistedSheetChanges {
  overrides: Record<string, IncomeSheetRow>;
  deletedIds: string[];
}

export function normalizeGestionValue(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export function buildIncomeRows(data: SheetTableData, analista?: string): IncomeSheetRow[] {
  const headerIndex = new Map(data.columns.map((column, index) => [normalizeGestionValue(column), index]));
  const indexOf = (...labels: string[]) => labels.map(label => headerIndex.get(normalizeGestionValue(label))).find(index => index != null) ?? -1;
  const indexes = {
    fecha: indexOf('FECHA'),
    tipoCliente: indexOf('TIPO DE CLIENTE', 'TIPO CLIENTE'),
    nombre: indexOf('APELLIDO Y NOMBRE', 'NOMBRE'),
    cuil: indexOf('CUIL'),
    actividad: indexOf('ACTIVIDAD'),
    estado: indexOf('ESTADO'),
    score: indexOf('SCORE'),
    tipoOperacion: indexOf('APERTURA/RENOVACION', 'AP/REN'),
    montoOtorgado: indexOf('MONTO OTORGADO'),
    interesVenta: indexOf('(I) X VENTA', 'I X VENTA'),
    comentarios: indexOf('COMENTARIOS'),
  };
  const cell = (row: string[], index: number) => index >= 0 ? row[index] : '';
  return data.rows
    .map((row, index) => ({
      id: `${index}-${cell(row, indexes.cuil)}-${cell(row, indexes.fecha)}`,
      analista,
      tipoCliente: cell(row, indexes.tipoCliente),
      fecha: cell(row, indexes.fecha),
      nombre: cell(row, indexes.nombre),
      cuil: cell(row, indexes.cuil),
      actividad: cell(row, indexes.actividad),
      estado: cell(row, indexes.estado),
      score: cell(row, indexes.score),
      tipoOperacion: cell(row, indexes.tipoOperacion),
      montoOtorgado: cell(row, indexes.montoOtorgado),
      interesVenta: cell(row, indexes.interesVenta),
      comentarios: cell(row, indexes.comentarios),
    }))
    .sort((left, right) => right.fecha.localeCompare(left.fecha));
}

export function databaseRowToIncomeRow(row: GestionDiaria): IncomeSheetRow {
  return {
    id: `database-${row.id}`,
    databaseId: row.id,
    analista: row.analista,
    tipoCliente: row.tipo_cliente,
    fecha: row.fecha ?? '',
    nombre: row.nombre,
    cuil: row.cuil,
    actividad: row.actividad,
    estado: row.estado,
    score: row.score == null ? '' : String(row.score),
    tipoOperacion: row.tipo_operacion,
    montoOtorgado: row.monto_otorgado ? formatCurrency(row.monto_otorgado) : '',
    interesVenta: row.interes_x_venta == null ? '' : formatCurrency(row.interes_x_venta),
    comentarios: row.comentarios,
  };
}

export function incomeRowIdentity(row: IncomeSheetRow): string {
  return [row.cuil, row.fecha, row.nombre].map(normalizeGestionValue).join('|');
}

export function sheetChangesStorageKey(analyst: string): string {
  return `gestion-diaria-sheet-changes:${analyst}`;
}

export function readPersistedSheetChanges(analyst: string): PersistedSheetChanges {
  if (typeof window === 'undefined' || !analyst) return { overrides: {}, deletedIds: [] };
  try {
    const stored = window.localStorage.getItem(sheetChangesStorageKey(analyst));
    return stored ? JSON.parse(stored) as PersistedSheetChanges : { overrides: {}, deletedIds: [] };
  } catch {
    return { overrides: {}, deletedIds: [] };
  }
}

function sheetCellText(cell: GoogleSheetCell | null | undefined): string {
  if (!cell || cell.v == null) return '';
  const raw = String(cell.v);
  const date = raw.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
  if (date) return `${date[1]}-${String(Number(date[2]) + 1).padStart(2, '0')}-${date[3].padStart(2, '0')}`;
  if (cell.f != null) return cell.f;
  return raw;
}

export function loadGoogleSheet(sheetId: string, gid: string): Promise<SheetTableData> {
  return new Promise((resolve, reject) => {
    const callbackName = `__gestionSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => finish(new Error('La hoja tardó demasiado en responder.')), 15000);
    const callbacks = window as unknown as Record<string, unknown>;

    function cleanup() {
      window.clearTimeout(timeout);
      script.remove();
      delete callbacks[callbackName];
    }

    function finish(error?: Error, data?: SheetTableData) {
      cleanup();
      if (error) reject(error);
      else if (data) resolve(data);
    }

    callbacks[callbackName] = (response: GoogleSheetResponse) => {
      if (response.status === 'error' || !response.table) {
        const message = response.errors?.[0]?.detailed_message || response.errors?.[0]?.message || 'No se pudo leer la hoja.';
        finish(new Error(message));
        return;
      }
      const sourceRows = response.table.rows ?? [];
      const columnCount = Math.max(response.table.cols?.length ?? 0, ...sourceRows.map(row => row.c?.length ?? 0), 0);
      const columns = Array.from({ length: columnCount }, (_, index) => (
        response.table?.cols?.[index]?.label?.trim() || `Columna ${index + 1}`
      ));
      const rows = sourceRows
        .map(row => Array.from({ length: columnCount }, (_, index) => sheetCellText(row.c?.[index])))
        .filter(row => row.some(Boolean));
      finish(undefined, { columns, rows });
    };

    script.onerror = () => finish(new Error('No se pudo conectar con Google Sheets.'));
    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}&tqx=out:json;responseHandler:${callbackName}`;
    document.head.appendChild(script);
  });
}
