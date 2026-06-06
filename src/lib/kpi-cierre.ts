import { Registro } from '@/types';

// ── Clasificadores de estado (fuente única de verdad) ──────────────────────
const low = (s?: string | null) => (s ?? '').toLowerCase().trim();

/** Venta efectiva: "Venta" o "Aprobado CC". */
export const esVentaOAprob = (r: Registro) => {
  const e = low(r.estado);
  return e === 'venta' || e.includes('aprobado cc');
};
export const esRechazoCC    = (r: Registro) => low(r.estado).includes('rechazado');
export const esProyeccion   = (r: Registro) => low(r.estado) === 'proyeccion';
export const esEnSeguimiento = (r: Registro) => low(r.estado) === 'en seguimiento';
export const esScoreBajo    = (r: Registro) => low(r.estado) === 'score bajo';
export const esAfectaciones = (r: Registro) => low(r.estado) === 'afectaciones';

/**
 * Tasa de cierre (efectividad comercial):
 *   (Venta + Aprob. CC) / (Venta + Aprob. CC + Rechaz. CC) × 100
 * Devuelve null si no hay casos pasados por comité (denominador 0).
 */
export function tasaCierrePct(regs: Registro[]): number | null {
  const ventas = regs.filter(esVentaOAprob).length;
  const base = ventas + regs.filter(esRechazoCC).length;
  return base > 0 ? (ventas / base) * 100 : null;
}

/**
 * Conversión total del embudo (avance del pipeline):
 *   (Venta + Aprob. CC) /
 *   (Venta + Aprob. CC + Proyección + En seguimiento + Score bajo + Afectaciones + Rechaz. CC) × 100
 * Devuelve null si el embudo está vacío (denominador 0).
 */
export function conversionTotalPct(regs: Registro[]): number | null {
  const ventas = regs.filter(esVentaOAprob).length;
  const base = ventas
    + regs.filter(esProyeccion).length
    + regs.filter(esEnSeguimiento).length
    + regs.filter(esScoreBajo).length
    + regs.filter(esAfectaciones).length
    + regs.filter(esRechazoCC).length;
  return base > 0 ? (ventas / base) * 100 : null;
}
