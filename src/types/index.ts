import { z } from 'zod';

// Schema runtime-validado (fuente de verdad del tipo Registro)
// - NUMERIC de Postgres puede llegar como string → usamos z.coerce.number()
// - Campos opcionales usan .nullish() porque Supabase devuelve null (no undefined) para NULL
export const registroSchema = z.object({
  id: z.string(),
  cuil: z.string().nullable().transform(v => v ?? ''),
  nombre: z.string().nullable().transform(v => v ?? ''),
  puntaje: z.coerce.number().nullable().transform(v => v ?? 0),
  es_re: z.boolean().nullish().transform(v => v ?? false),
  analista: z.string().nullable().transform(v => v ?? ''),
  fecha: z.string().nullable(),
  fecha_score: z.string().nullable(),
  monto: z.coerce.number().nullable(),
  interes: z.coerce.number().nullish().transform(v => v ?? null),
  estado: z.string().nullable().transform(v => v ?? ''),
  comentarios: z.string().nullable().transform(v => v ?? ''),
  telefono: z.string().nullish().transform(v => v ?? ''),
  fijado: z.boolean().nullish().transform(v => v ?? false),
  tipo_cliente: z.string().nullish().transform(v => v ?? undefined),
  acuerdo_precios: z.string().nullish().transform(v => v ?? undefined),
  cuotas: z.string().nullish().transform(v => v ?? undefined),
  rango_etario: z.string().nullish().transform(v => v ?? undefined),
  sexo: z.string().nullish().transform(v => v ?? undefined),
  empleador: z.string().nullish().transform(v => v ?? undefined),
  dependencia: z.string().nullish().transform(v => v ?? undefined),
  localidad: z.string().nullish().transform(v => v ?? undefined),
  etiquetas: z.array(z.string()).nullish().transform(v => v ?? []),
  created_at: z.string().nullish().transform(v => v ?? undefined),
  updated_at: z.string().nullish().transform(v => v ?? undefined),
});

export type Registro = z.infer<typeof registroSchema>;

// Schema y Tipo para Bitácora de Notas por Cliente
export const bitacoraNotaSchema = z.object({
  id: z.string(),
  registro_id: z.string(),
  cuil: z.string().nullish().transform(v => v ?? ''),
  analista: z.string().nullish().transform(v => v ?? ''),
  nota: z.string(),
  created_at: z.string().nullish().transform(v => v ?? ''),
});

export type BitacoraNota = z.infer<typeof bitacoraNotaSchema>;

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
  meta_ventas: z.number().nullable().optional(),
  meta_operaciones: z.number().nullable().optional(),
});

export const permisoRolSchema = z.object({
  id: z.string().uuid().optional(),
  rol: z.string(),
  permiso: z.string(),
  activo: z.boolean(),
});

export type Objetivo = z.infer<typeof objetivoSchema>;
export type PermisoRol = z.infer<typeof permisoRolSchema>;

export const LISTA_PERMISOS_ROLES = [
  { id: 'crear_registros', label: 'Crear Registros', desc: 'Permite agregar nuevos registros.' },
  { id: 'editar_registros', label: 'Editar Registros', desc: 'Permite modificar registros existentes.' },
  { id: 'eliminar_registros', label: 'Eliminar Registros', desc: 'Permite borrar registros desde la tabla.' },
  { id: 'exportar_excel', label: 'Exportar a Excel', desc: 'Permite descargar el listado de registros.' },
  { id: 'ver_bitacora', label: 'Ícono Recordatorio y Seguimiento', desc: 'Permite visualizar el ícono de recordatorio y seguimiento.' },
  { id: 'ver_recordatorios', label: 'Ícono Recordatorios', desc: 'Permite visualizar el ícono de recordatorios.' },
  { id: 'ver_comentarios', label: 'Ícono Comentarios', desc: 'Permite visualizar el ícono de comentarios.' },
] as const;

export type PermisoId = typeof LISTA_PERMISOS_ROLES[number]['id'];

export function getPermisoActivo(
  permisosConfig: PermisoRol[],
  permiso: string,
  analista?: string | null,
  defaultValue: boolean = true
): boolean {
  if (analista) {
    const formatted = analista.trim().toLowerCase();
    const specific = permisosConfig.find(
      p => (p.rol.toLowerCase() === `analista:${formatted}` || p.rol.toLowerCase() === formatted) && p.permiso === permiso
    );
    if (specific !== undefined) {
      return specific.activo;
    }
  }

  const general = permisosConfig.find(p => p.rol === 'analista' && p.permiso === permiso);
  if (general !== undefined) {
    return general.activo;
  }

  return defaultValue;
}

export function getPermisoOverride(
  permisosConfig: PermisoRol[],
  permiso: string,
  analista: string
): PermisoRol | undefined {
  const formatted = analista.trim().toLowerCase();
  return permisosConfig.find(
    p => (p.rol.toLowerCase() === `analista:${formatted}` || p.rol.toLowerCase() === formatted) && p.permiso === permiso
  );
}

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

// ── Analista ──────────────────────────────────────────────────────────────────
export const analistaSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1),
  color: z.string().min(1),
  oculto: z.boolean(),
  tiene_incentivo: z.boolean(),
  orden: z.number(),
});
export type Analista = z.infer<typeof analistaSchema>;

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
const recordatorioSchema = z.object({
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

export const ESTADOS_MAP: Record<string, { monto: string; op: string }> = {
  'derivado / rechazado cc': { monto: 'derivadoRechazadoMonto', op: 'derivadoRechazadoOp' },
  'proyeccion': { monto: 'totalProyecciones', op: 'totalProyeccionesOp' },
  'en seguimiento': { monto: 'enSeguimientoMonto', op: 'enSeguimientoOp' },
  'score bajo': { monto: 'scoreBajoMonto', op: 'scoreBajoOp' },
  'afectaciones': { monto: 'afectacionesMonto', op: 'afectacionesOp' },
};

export const CONFIG = {
  ANALISTAS_DEFAULT: ["Luciana", "Victoria", "Juan Pablo", "Yamil"],
  MESES_NOMBRES: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  ALERTAS_DEFAULT: [
    { nombre: "Proyecciones", dias: 10, estado: "proyeccion", mensaje: "Tiene proyecciones con más de {dias} días sin actualización.", color: "#17a2b8" },
    { nombre: "En seguimiento", dias: 3, estado: "en seguimiento", mensaje: "Tiene registros en seguimiento con más de {dias} días sin contacto.", color: "#ffc107" },
    { nombre: "Score bajo", dias: 30, estado: "score bajo", mensaje: "Tiene clientes con score bajo que no reciben seguimiento desde hace {dias} días.", color: "#dc3545" },
    { nombre: "Afectaciones", dias: 5, estado: "afectaciones", mensaje: "Tiene afectaciones con más de {dias} días sin resolver.", color: "#9c27b0" },
    { nombre: "Derivado Aprobado CC", dias: 7, estado: "derivado / aprobado cc", mensaje: "Tiene derivaciones aprobadas por CC sin resolver en {dias} días.", color: "#9B59B6" },
    { nombre: "Derivado Rechazado CC", dias: 7, estado: "derivado / rechazado cc", mensaje: "Tiene derivaciones rechazadas por CC sin seguimiento en {dias} días.", color: "#E67E22" },
  ],
};
