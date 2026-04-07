export interface Registro {
  id: string;
  cuil: string;
  nombre: string;
  puntaje: number;
  es_re: boolean;
  analista: string;
  fecha: string | null;
  fecha_score: string | null;
  monto: number;
  estado: string;
  comentarios: string;
  tipo_cliente?: string;
  acuerdo_precios?: string;
  cuotas?: string;
  rango_etario?: string;
  sexo?: string;
  empleador?: string;
  localidad?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Objetivo {
  id?: string;
  analista: string;
  mes: number;
  anio: number;
  meta_ventas: number;
  meta_operaciones: number;
}

export interface AlertaConfig {
  id?: string;
  nombre: string;
  estado: string;
  dias: number;
  mensaje: string;
  color: string;
}

export interface DiasConfig {
  analista: string;
  dias_habiles: number;
  dias_transcurridos: number;
}

export interface Recordatorio {
  id: string;
  registro_id: string;
  nombre: string;
  cuil: string;
  analista: string;
  estado: string;
  nota: string;
  fecha_hora: string;
  creado_por: string;
  creado_en: string;
  mostrado: boolean;
  comentario_registro: string;
}

export interface HistoricoVenta {
  id?: string;
  analista: string;
  anio: number;
  mes: number; // 0-11
  capital_real: number;
  ops_real: number;
}

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
