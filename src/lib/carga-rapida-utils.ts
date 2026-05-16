// src/lib/carga-rapida-utils.ts
import { Registro } from '@/types';
import { ParsedRow, normalizeCuil, parseFullDate } from '@/lib/verificador-utils';

export type CargaRole =
  | 'ignore'
  | 'cuil'
  | 'apellido_nombre'
  | 'analista'
  | 'estado'
  | 'monto'
  | 'fecha'
  | 'fecha_score'
  | 'puntaje'
  | 'es_re'
  | 'comentarios'
  | 'tipo_cliente'
  | 'acuerdo_precios'
  | 'cuotas'
  | 'rango_etario'
  | 'sexo'
  | 'empleador'
  | 'localidad';

export interface CargaColumnMapping {
  [colIndex: number]: CargaRole;
}

export interface FieldDiff {
  field: keyof Registro;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface CargaRapidaResult {
  row: ParsedRow;
  status: 'new' | 'update' | 'skip';
  parsedData: Partial<Registro>;
  existingRecord?: Registro;
  diffs?: FieldDiff[];
}

export const CARGA_ROLE_OPTIONS: { value: CargaRole; label: string }[] = [
  { value: 'ignore',          label: '— Ignorar —'         },
  { value: 'cuil',            label: 'CUIL'                },
  { value: 'apellido_nombre', label: 'Apellido y Nombre'   },
  { value: 'analista',        label: 'Analista'            },
  { value: 'estado',          label: 'Estado'              },
  { value: 'monto',           label: 'Monto'               },
  { value: 'fecha',           label: 'Fecha'               },
  { value: 'fecha_score',     label: 'Fecha Score'         },
  { value: 'puntaje',         label: 'Score'               },
  { value: 'es_re',           label: 'RE (Resumen Ejecutivo)' },
  { value: 'comentarios',     label: 'Comentarios'         },
  { value: 'tipo_cliente',    label: 'Tipo de cliente'     },
  { value: 'acuerdo_precios', label: 'Acuerdo de precios'  },
  { value: 'cuotas',          label: 'Cuotas'              },
  { value: 'rango_etario',    label: 'Rango etario'        },
  { value: 'sexo',            label: 'Sexo'                },
  { value: 'empleador',       label: 'Empleador'           },
  { value: 'localidad',       label: 'Localidad'           },
];

export const CARGA_FIELD_LABELS: Partial<Record<keyof Registro, string>> = {
  analista:        'Analista',
  estado:          'Estado',
  monto:           'Monto',
  fecha:           'Fecha',
  fecha_score:     'Fecha Score',
  puntaje:         'Score',
  es_re:           'RE',
  comentarios:     'Comentarios',
  tipo_cliente:    'Tipo de cliente',
  acuerdo_precios: 'Acuerdo de precios',
  cuotas:          'Cuotas',
  rango_etario:    'Rango etario',
  sexo:            'Sexo',
  empleador:       'Empleador',
  localidad:       'Localidad',
};

const DIFFABLE_FIELDS = Object.keys(CARGA_FIELD_LABELS) as (keyof Registro)[];

export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');
}

function getCell(row: ParsedRow, mapping: CargaColumnMapping, role: CargaRole): string | undefined {
  const entry = Object.entries(mapping).find(([, r]) => r === role);
  if (!entry) return undefined;
  return row.cells[Number(entry[0])]?.trim() || undefined;
}

export function parseCargaRow(row: ParsedRow, mapping: CargaColumnMapping): Partial<Registro> {
  const result: Partial<Registro> = {};

  const rawCuil = getCell(row, mapping, 'cuil');
  if (rawCuil) result.cuil = normalizeCuil(rawCuil);

  const rawNombre = getCell(row, mapping, 'apellido_nombre');
  if (rawNombre) result.nombre = rawNombre;

  const rawAnalista = getCell(row, mapping, 'analista');
  if (rawAnalista) result.analista = rawAnalista;

  const rawEstado = getCell(row, mapping, 'estado');
  if (rawEstado) result.estado = rawEstado.toLowerCase();

  const rawMonto = getCell(row, mapping, 'monto');
  if (rawMonto) {
    const isArgentine = rawMonto.indexOf(',') > rawMonto.indexOf('.');
    const normalized = isArgentine
      ? rawMonto.replace(/\./g, '').replace(',', '.')
      : rawMonto.replace(/,/g, '');
    const parsed = parseFloat(normalized.replace(/[$\s]/g, ''));
    if (!isNaN(parsed)) result.monto = parsed;
  }

  const rawFecha = getCell(row, mapping, 'fecha');
  if (rawFecha) result.fecha = parseFullDate(rawFecha) ?? rawFecha;

  const rawFechaScore = getCell(row, mapping, 'fecha_score');
  if (rawFechaScore) result.fecha_score = parseFullDate(rawFechaScore) ?? rawFechaScore;

  const rawPuntaje = getCell(row, mapping, 'puntaje');
  if (rawPuntaje) {
    const parsed = parseInt(rawPuntaje.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed)) result.puntaje = parsed;
  }

  const rawTipoCliente = getCell(row, mapping, 'tipo_cliente');
  if (rawTipoCliente) result.tipo_cliente = rawTipoCliente;

  const rawEsRe = getCell(row, mapping, 'es_re');
  if (rawEsRe !== undefined) {
    result.es_re = ['si', 'sí', '1', 'true', 'yes'].includes(rawEsRe.toLowerCase());
  }

  const rawAcuerdo = getCell(row, mapping, 'acuerdo_precios');
  if (rawAcuerdo) result.acuerdo_precios = rawAcuerdo;

  const rawCuotas = getCell(row, mapping, 'cuotas');
  if (rawCuotas) result.cuotas = rawCuotas;

  const rawRango = getCell(row, mapping, 'rango_etario');
  if (rawRango) result.rango_etario = rawRango;

  const rawSexo = getCell(row, mapping, 'sexo');
  if (rawSexo) result.sexo = rawSexo;

  const rawEmpleador = getCell(row, mapping, 'empleador');
  if (rawEmpleador) result.empleador = rawEmpleador;

  const rawLocalidad = getCell(row, mapping, 'localidad');
  if (rawLocalidad) result.localidad = rawLocalidad;

  const rawComentarios = getCell(row, mapping, 'comentarios');
  if (rawComentarios) result.comentarios = rawComentarios;

  return result;
}

export function procesarFilas(
  rows: ParsedRow[],
  mapping: CargaColumnMapping,
  dbRecords: Registro[],
): CargaRapidaResult[] {
  const byCuil = new Map<string, Registro>();
  const byNombre = new Map<string, Registro>();

  dbRecords.forEach(r => {
    if (r.cuil) byCuil.set(normalizeCuil(r.cuil), r);
    if (r.nombre) byNombre.set(normalizarNombre(r.nombre), r);
  });

  const hasCuil = Object.values(mapping).includes('cuil');
  const hasNombre = Object.values(mapping).includes('apellido_nombre');

  return rows.map(row => {
    const parsed = parseCargaRow(row, mapping);

    let existing: Registro | undefined;
    if (hasCuil && parsed.cuil) existing = byCuil.get(parsed.cuil);
    if (!existing && hasNombre && parsed.nombre) {
      existing = byNombre.get(normalizarNombre(parsed.nombre));
    }

    if (!existing) {
      return { row, status: 'new', parsedData: parsed };
    }

    return {
      row,
      status: 'skip',
      parsedData: parsed,
      existingRecord: existing,
      diffs: [],
    };
  });
}
