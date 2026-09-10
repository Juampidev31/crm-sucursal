import { SupabaseClient } from '@supabase/supabase-js';

export interface Feriado {
  id?: string;
  fecha: string; // Formato YYYY-MM-DD
  motivo: string;
}

/**
 * Convierte un objeto Date o string a formato YYYY-MM-DD respetando la zona horaria local.
 */
export function formatFechaISO(date: Date | string): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Feriados nacionales oficiales de Argentina para referencia y auto-carga rápida.
 */
export const FERIADOS_OFICIALES_ARGENTINA: Omit<Feriado, 'id'>[] = [
  // 2025
  { fecha: '2025-01-01', motivo: 'Año Nuevo' },
  { fecha: '2025-03-03', motivo: 'Carnaval' },
  { fecha: '2025-03-04', motivo: 'Carnaval' },
  { fecha: '2025-03-24', motivo: 'Día Nacional de la Memoria por la Verdad y la Justicia' },
  { fecha: '2025-04-02', motivo: 'Día del Veterano y de los Caídos en la Guerra de Malvinas' },
  { fecha: '2025-04-18', motivo: 'Viernes Santo' },
  { fecha: '2025-05-01', motivo: 'Día del Trabajador' },
  { fecha: '2025-05-25', motivo: 'Día de la Revolución de Mayo' },
  { fecha: '2025-06-20', motivo: 'Paso a la Inmortalidad del Gral. Manuel Belgrano' },
  { fecha: '2025-07-09', motivo: 'Día de la Independencia' },
  { fecha: '2025-08-17', motivo: 'Paso a la Inmortalidad del Gral. José de San Martín' },
  { fecha: '2025-10-12', motivo: 'Día del Respeto a la Diversidad Cultural' },
  { fecha: '2025-11-20', motivo: 'Día de la Soberanía Nacional' },
  { fecha: '2025-12-08', motivo: 'Inmaculada Concepción de María' },
  { fecha: '2025-12-25', motivo: 'Navidad' },

  // 2026
  { fecha: '2026-01-01', motivo: 'Año Nuevo' },
  { fecha: '2026-02-16', motivo: 'Carnaval' },
  { fecha: '2026-02-17', motivo: 'Carnaval' },
  { fecha: '2026-03-24', motivo: 'Día Nacional de la Memoria por la Verdad y la Justicia' },
  { fecha: '2026-04-02', motivo: 'Día del Veterano y de los Caídos en la Guerra de Malvinas' },
  { fecha: '2026-04-03', motivo: 'Viernes Santo' },
  { fecha: '2026-05-01', motivo: 'Día del Trabajador' },
  { fecha: '2026-05-25', motivo: 'Día de la Revolución de Mayo' },
  { fecha: '2026-06-20', motivo: 'Paso a la Inmortalidad del Gral. Manuel Belgrano' },
  { fecha: '2026-07-09', motivo: 'Día de la Independencia' },
  { fecha: '2026-08-17', motivo: 'Paso a la Inmortalidad del Gral. José de San Martín' },
  { fecha: '2026-10-12', motivo: 'Día del Respeto a la Diversidad Cultural' },
  { fecha: '2026-11-20', motivo: 'Día de la Soberanía Nacional' },
  { fecha: '2026-12-08', motivo: 'Inmaculada Concepción de María' },
  { fecha: '2026-12-25', motivo: 'Navidad' },
];

/**
 * Determina si una fecha dada es un feriado nacional registrado.
 */
export function esFeriado(date: Date, feriados: Feriado[] = []): { esFeriado: boolean; feriado?: Feriado } {
  const fechaIso = formatFechaISO(date);
  const feriado = feriados.find(f => f.fecha === fechaIso);
  return { esFeriado: !!feriado, feriado };
}

/**
 * Calcula el peso en días hábiles de una fecha dada:
 * - Feriado: 0
 * - Domingo (0): 0
 * - Sábado (6): 0.5
 * - Lunes a Viernes (1..5): 1.0
 */
export function calcularPesoDia(date: Date, feriados: Feriado[] = []): number {
  if (esFeriado(date, feriados).esFeriado) {
    return 0;
  }
  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0) return 0;
  if (dayOfWeek === 6) return 0.5;
  return 1.0;
}

/**
 * Extrae los componentes de fecha y hora en la zona horaria oficial de Argentina
 * ('America/Argentina/Buenos_Aires', UTC-3).
 */
export function getFechaYHoraArgentina(date: Date = new Date()): {
  anio: number;
  mes: number; // 1..12
  dia: number; // 1..31
  horas: number; // 0..23
  minutos: number; // 0..59
  segundos: number; // 0..59
  dayOfWeek: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getVal = (type: string) => {
    const p = parts.find(x => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  const anio = getVal('year');
  const mes = getVal('month');
  const dia = getVal('day');
  let horas = getVal('hour');
  if (horas === 24) horas = 0;
  const minutos = getVal('minute');
  const segundos = getVal('second');

  const dayOfWeek = new Date(anio, mes - 1, dia).getDay();

  return { anio, mes, dia, horas, minutos, segundos, dayOfWeek };
}

/**
 * Determina si la jornada comercial de la fecha indicada ya ha concluido:
 * - Lunes a Viernes: corte a las 19:30 hs.
 * - Sábados: corte a las 12:00 pm (12:00 hs).
 * - Domingos: siempre cerrada (no laborable).
 */
export function esJornadaCerrada(date: Date = new Date()): boolean {
  const { dayOfWeek, horas, minutos } = getFechaYHoraArgentina(date);

  // Domingos: no laboral
  if (dayOfWeek === 0) return true;

  const minutosDelDia = horas * 60 + minutos;

  // Sábados: corte a las 12:00 pm (12:00 hs = 720 minutos)
  if (dayOfWeek === 6) {
    return minutosDelDia >= 12 * 60;
  }

  // Lunes a Viernes: corte a las 19:30 hs (19 * 60 + 30 = 1170 minutos)
  return minutosDelDia >= 19 * 60 + 30;
}

/**
 * Calcula los días transcurridos en el mes de `fechaRef` hasta la fecha indicada.
 * Regla de cierre de jornada:
 * - Lunes a Viernes: 1 día (se descuenta / computa al llegar a las 19:30 hs).
 * - Sábados: 0.5 día (se descuenta / computa al llegar a las 12:00 pm).
 * - Domingos: 0 días.
 * - Feriados: 0 días.
 * 
 * Los días previos del mes se computan completos.
 * El día de `fechaRef` solo se suma como transcurrido una vez alcanzado el horario de corte comercial.
 */
export function calcularDiasTranscurridos(fechaRef: Date = new Date(), feriados: Feriado[] = []): number {
  const { anio, mes, dia: diaRef } = getFechaYHoraArgentina(fechaRef);
  const mes0 = mes - 1;

  const ahoraBA = getFechaYHoraArgentina(new Date());
  const esMesPasado = anio < ahoraBA.anio || (anio === ahoraBA.anio && mes < ahoraBA.mes);
  const esDiaPasado = esMesPasado || (anio === ahoraBA.anio && mes === ahoraBA.mes && diaRef < ahoraBA.dia);

  let total = 0;

  // Días previos del mes (ya cerrados)
  for (let dia = 1; dia < diaRef; dia++) {
    const fecha = new Date(anio, mes0, dia);
    total += calcularPesoDia(fecha, feriados);
  }

  // Día en curso: si es un día ya pasado o si ya cerró la jornada comercial hoy
  const cerrada = esDiaPasado || esJornadaCerrada(fechaRef);
  if (cerrada) {
    const fechaHoy = new Date(anio, mes0, diaRef);
    total += calcularPesoDia(fechaHoy, feriados);
  }

  return total;
}

/**
 * Calcula el total teórico de días hábiles de un mes completo (mes 1..12).
 * Útil para sugerir los días hábiles al inicio de mes.
 */
export function calcularDiasHabilesMes(anio: number, mes: number, feriados: Feriado[] = []): number {
  // mes viene en base 1 (1 = Enero, 12 = Diciembre)
  const mes0 = mes - 1;
  const diasEnMes = new Date(anio, mes, 0).getDate();

  let total = 0;
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = new Date(anio, mes0, dia);
    total += calcularPesoDia(fecha, feriados);
  }
  return total;
}

/**
 * Carga los feriados nacionales guardados en la tabla `configuracion` (clave 'feriados_nacionales').
 */
export async function obtenerFeriadosDB(supabase: SupabaseClient): Promise<Feriado[]> {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('valor_json')
      .eq('clave', 'feriados_nacionales')
      .maybeSingle();

    if (error) {
      console.warn('[dias-habiles] Error cargando feriados:', error.message);
      return [];
    }

    if (data?.valor_json && Array.isArray(data.valor_json.feriados)) {
      return data.valor_json.feriados;
    }
    return [];
  } catch (err) {
    console.warn('[dias-habiles] Error inesperado cargando feriados:', err);
    return [];
  }
}

/**
 * Guarda la lista de feriados nacionales en la tabla `configuracion`.
 */
export async function guardarFeriadosDB(supabase: SupabaseClient, feriados: Feriado[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('configuracion')
      .upsert({
        clave: 'feriados_nacionales',
        valor_json: { feriados },
      }, { onConflict: 'clave' });

    if (error) {
      console.error('[dias-habiles] Error guardando feriados:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[dias-habiles] Error inesperado guardando feriados:', err);
    return false;
  }
}
