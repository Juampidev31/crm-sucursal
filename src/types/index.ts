import { z } from 'zod';

// Schema runtime-validado (fuente de verdad del tipo Registro)
// - NUMERIC de Postgres puede llegar como string → usamos z.coerce.number()
// - Campos opcionales usan .nullish() porque Supabase devuelve null (no undefined) para NULL
export const registroSchema = z.object({
  id: z.string(),
  cuil: z.string(),
  nombre: z.string(),
  puntaje: z.coerce.number(),
  es_re: z.boolean().nullish().transform(v => v ?? false),
  analista: z.string(),
  fecha: z.string().nullable(),
  fecha_score: z.string().nullable(),
  monto: z.coerce.number(),
  estado: z.string(),
  comentarios: z.string().nullable().transform(v => v ?? ''),
  tipo_cliente: z.string().nullish().transform(v => v ?? undefined),
  acuerdo_precios: z.string().nullish().transform(v => v ?? undefined),
  cuotas: z.string().nullish().transform(v => v ?? undefined),
  rango_etario: z.string().nullish().transform(v => v ?? undefined),
  sexo: z.string().nullish().transform(v => v ?? undefined),
  empleador: z.string().nullish().transform(v => v ?? undefined),
  localidad: z.string().nullish().transform(v => v ?? undefined),
  created_at: z.string().nullish().transform(v => v ?? undefined),
  updated_at: z.string().nullish().transform(v => v ?? undefined),
});

export type Registro = z.infer<typeof registroSchema>;

// Helper genérico: valida un array de filas contra un schema, descarta inválidas.
export function parseRows<T>(
  schema: z.ZodType<T>,
  rows: unknown,
  onInvalid?: (index: number, error: z.ZodError, row: unknown) => void,
): T[] {
  if (!Array.isArray(rows)) return [];
  const valid: T[] = [];
  rows.forEach((row, i) => {
    const result = schema.safeParse(row);
    if (result.success) valid.push(result.data);
    else if (onInvalid) onInvalid(i, result.error, row);
  });
  return valid;
}

// Mantenido como alias por retrocompatibilidad con callers existentes.
export function parseRegistros(
  rows: unknown,
  onInvalid?: (index: number, error: z.ZodError, row: unknown) => void,
): Registro[] {
  return parseRows(registroSchema, rows, onInvalid);
}

// ── Objetivos ─────────────────────────────────────────────────────────────────
export const objetivoSchema = z.object({
  id: z.string().optional(),
  analista: z.string(),
  mes: z.coerce.number().int(),
  anio: z.coerce.number().int(),
  meta_ventas: z.coerce.number(),
  meta_operaciones: z.coerce.number(),
});
export type Objetivo = z.infer<typeof objetivoSchema>;

// ── AlertaConfig ──────────────────────────────────────────────────────────────
export const alertaConfigSchema = z.object({
  id: z.string().optional(),
  nombre: z.string(),
  estado: z.string(),
  dias: z.coerce.number().int(),
  mensaje: z.string(),
  color: z.string(),
});
export type AlertaConfig = z.infer<typeof alertaConfigSchema>;

// ── DiasConfig ────────────────────────────────────────────────────────────────
export const diasConfigSchema = z.object({
  analista: z.string(),
  dias_habiles: z.coerce.number(),
  dias_transcurridos: z.coerce.number(),
});
export type DiasConfig = z.infer<typeof diasConfigSchema>;

// ── Recordatorio ──────────────────────────────────────────────────────────────
// Campos de texto con .nullish + transform a '' para tolerar NULLs de Postgres
// sin romper consumidores que esperan string.
export const recordatorioSchema = z.object({
  id: z.string(),
  registro_id: z.string(),
  nombre: z.string(),
  cuil: z.string(),
  analista: z.string(),
  estado: z.string(),
  nota: z.string().nullish().transform(v => v ?? ''),
  fecha_hora: z.string(),
  creado_por: z.string().nullish().transform(v => v ?? ''),
  creado_en: z.string().nullish().transform(v => v ?? ''),
  mostrado: z.boolean(),
  comentario_registro: z.string().nullish().transform(v => v ?? ''),
});
export type Recordatorio = z.infer<typeof recordatorioSchema>;

// ── HistoricoVenta ────────────────────────────────────────────────────────────
export const historicoVentaSchema = z.object({
  id: z.string().optional(),
  analista: z.string(),
  anio: z.coerce.number().int(),
  mes: z.coerce.number().int(), // 0-11
  capital_real: z.coerce.number(),
  ops_real: z.coerce.number(),
});
export type HistoricoVenta = z.infer<typeof historicoVentaSchema>;

export interface DiasHabilesConfig {
  id: string;
  analista: string;
  dias_habiles: number;
  dias_transcurridos: number;
  manual: boolean;
}

export interface ResumenAnalista {
  sucursal: string;
  ventasCerradas: number;
  totalProyecciones: number;
  opCerradas: number;
  totalProyeccionesOp: number;
  enSeguimientoMonto: number;
  enSeguimientoOp: number;
  scoreBajoMonto: number;
  scoreBajoOp: number;
  afectacionesMonto: number;
  afectacionesOp: number;
  derivadoAprobadoMonto: number;
  derivadoAprobadoOp: number;
  derivadoRechazadoMonto: number;
  derivadoRechazadoOp: number;
  cvsp: number;
  ticketPromedio: number;
  totalOperaciones: number;
  ventasMensualesTotal: number;
  cantidadVentasMensuales: number;
  tendenciaVentas: number;
  tendenciaOps: number;
  comisionCapital: number;
  comisionOperaciones: number;
  comisionTotal: number;
  objetivoVentasMesActual: number;
  objetivoOperacionesMesActual: number;
}

export const ESTADOS_MAP: Record<string, { monto: string; op: string }> = {
  'derivado / rechazado cc': { monto: 'derivadoRechazadoMonto', op: 'derivadoRechazadoOp' },
  'proyeccion': { monto: 'totalProyecciones', op: 'totalProyeccionesOp' },
  'en seguimiento': { monto: 'enSeguimientoMonto', op: 'enSeguimientoOp' },
  'score bajo': { monto: 'scoreBajoMonto', op: 'scoreBajoOp' },
  'afectaciones': { monto: 'afectacionesMonto', op: 'afectacionesOp' },
};

export const CONFIG = {
  APP_VERSION: "2.0.0",
  ANALISTAS_DEFAULT: ["Luciana", "Victoria"],
  OBJETIVO_VENTAS_DEFAULT: 23500000,
  OBJETIVO_OPERACIONES_DEFAULT: 33,
  UMBRAL_VENTAS_MINIMO_COMISION: 0.75,
  MESES_NOMBRES: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  COEFICIENTES_COMISION: {
    NIVEL_1: { umbral: 1.20, coeficiente: 0.0045 },
    NIVEL_2: { umbral: 1.10, coeficiente: 0.0037 },
    NIVEL_3: { umbral: 0.90, coeficiente: 0.0030 },
    NIVEL_4: { umbral: 0.75, coeficiente: 0.0020 },
  },
  PORCENTAJES_ADICIONALES_OP: {
    NIVEL_1: { umbral: 1.00, porcentaje: 0.30 },
    NIVEL_2: { umbral: 0.80, porcentaje: 0.20 },
  },
  ALERTAS_DEFAULT: [
    { nombre: "Proyecciones", dias: 10, estado: "proyeccion", mensaje: "Tiene proyecciones con más de {dias} días sin actualización.", color: "#17a2b8" },
    { nombre: "En seguimiento", dias: 3, estado: "en seguimiento", mensaje: "Tiene registros en seguimiento con más de {dias} días sin contacto.", color: "#ffc107" },
    { nombre: "Score bajo", dias: 30, estado: "score bajo", mensaje: "Tiene clientes con score bajo que no reciben seguimiento desde hace {dias} días.", color: "#dc3545" },
    { nombre: "Afectaciones", dias: 5, estado: "afectaciones", mensaje: "Tiene afectaciones con más de {dias} días sin resolver.", color: "#9c27b0" },
    { nombre: "Derivado Aprobado CC", dias: 7, estado: "derivado / aprobado cc", mensaje: "Tiene derivaciones aprobadas por CC sin resolver en {dias} días.", color: "#9B59B6" },
    { nombre: "Derivado Rechazado CC", dias: 7, estado: "derivado / rechazado cc", mensaje: "Tiene derivaciones rechazadas por CC sin seguimiento en {dias} días.", color: "#E67E22" },
  ],
};
