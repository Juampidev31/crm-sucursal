import { Registro } from '@/types';

// Helpers de estadísticas de registros compartidos por ResumenMensualTab,
// ResumenMensualView, analistas/page y SeccionGraficosResumen.
// Extraídos de copias verificadas idénticas (refactor cross-file de charts, fase 1).

export const filterByMonth = (regs: Registro[], mes: number, anio: number) => {
  const key = `${anio}-${String(mes).padStart(2, '0')}`;
  return regs.filter(r => r.fecha?.slice(0, 7) === key);
};

export const isVenta = (r: Registro) => {
  const e = (r.estado ?? '').toLowerCase();
  return e === 'venta' || e.includes('aprobado cc');
};

// Clasificador de acuerdo de precios (compartido por distribuciones)
export const TIPOS_ACUERDO = ['PREMIUM', 'Riesgo MEDIO', 'Riesgo BAJO', 'No califica/Excepcion', 'No califica'];

export const emptyTiposAcuerdo = (): Record<string, { monto: number; cantidad: number }> =>
  Object.fromEntries(TIPOS_ACUERDO.map(t => [t, { monto: 0, cantidad: 0 }]));

export const matchTipoAcuerdo = (acuerdo: string, estado: string, isV: boolean): string | null => {
  const ac = (acuerdo || '').toLowerCase().trim();
  const es = (estado || '').toLowerCase().trim();
  // Prioridad a estados de no calificación
  const esRechazo = ac.includes('no califica') || ac === 'n/c' ||
                    es.includes('no califica') || es.includes('bajo') || es.includes('afectaciones') || es.includes('rechazado');
  if (esRechazo) return isV ? 'No califica/Excepcion' : 'No califica';
  if (ac.includes('bajo')) return 'Riesgo BAJO';
  if (ac.includes('medio')) return 'Riesgo MEDIO';
  if (ac.includes('premium')) return 'PREMIUM';
  return null;
};

// ── Normalización de empleador para agrupar duplicados ────────────────────
export const normalizarEmpleador = (nombre: string): string => {
  if (!nombre) return 'No especificado';
  let n = nombre.toUpperCase().trim();
  // Quitar acentos
  n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Quitar sufijos legales comunes
  n = n.replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?|E\.?I\.?R\.?L\.?)\.?\b/gi, '').trim();
  // Quitar palabras vacías al final
  n = n.replace(/\b(EL|LA|LOS|LAS|DE|DEL|Y|E)\b\s*$/gi, '').trim();
  // Quitar múltiples espacios
  n = n.replace(/\s+/g, ' ').trim();
  return n || 'No especificado';
};

export const buildDistEmpleador = (fuente: Registro[]) => {
  const map = new Map<string, { monto: number; cantidad: number; variantes: Map<string, number>; displayLabel: string }>();
  for (const r of fuente) {
    const raw = (r.empleador ?? '').trim();
    const key = normalizarEmpleador(raw);
    const prev = map.get(key) ?? { monto: 0, cantidad: 0, variantes: new Map<string, number>(), displayLabel: raw };
    prev.monto += Number(r.monto) || 0;
    prev.cantidad += 1;
    if (raw) {
      prev.variantes.set(raw, (prev.variantes.get(raw) || 0) + 1);
      // Usar la variante más común como displayLabel
      let maxCount = 0;
      let maxVariant = raw;
      for (const [v, c] of prev.variantes) {
        if (c > maxCount) { maxCount = c; maxVariant = v; }
      }
      prev.displayLabel = maxVariant;
    }
    map.set(key, prev);
  }
  return Array.from(map.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .map(data => ({ label: data.displayLabel, monto: data.monto, cantidad: data.cantidad }));
};

// Color según % de cumplimiento (versión Tab/View; analistas y la vista pública
// usan paletas propias intencionalmente distintas)
export const cumplColor = (pct: number | null) =>
  pct === null ? '#555' : pct >= 100 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#ff3366';
