import { supabase } from '@/lib/supabase';
import { calcularComisiones } from '@/lib/utils';
import { CONFIG, ESTADOS_MAP } from '@/types';
import ProyeccionClient, { type ProyeccionData } from './ProyeccionClient';

export const dynamic = 'force-dynamic';

// "Hoy" en timezone Argentina para evitar drift cuando el server corre en UTC.
function getTodayBA() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [y, m, d] = fmt.format(new Date()).split('-').map(Number);
  return { anio: y, mes: m - 1, dia: d };
}

async function buildProyeccion() {
  const { anio: anioActual, mes: mesActual, dia: diaActual } = getTodayBA();
  const ultimoDiaMes = new Date(anioActual, mesActual + 1, 0).getDate();
  const maxDiaCalculo = Math.min(diaActual, ultimoDiaMes);

  const [{ data: registros }, { data: objetivos }] = await Promise.all([
    supabase.from('registros').select('*'),
    supabase.from('objetivos').select('*').eq('anio', anioActual).eq('mes', mesActual),
  ]);

  const regs = registros || [];
  const estadosActivos = ['proyeccion', 'en seguimiento', 'score bajo', 'afectaciones', 'derivado / rechazado cc'];

  const mkEntry = (metaV: number, metaO: number): ProyeccionData => ({
    ventasCerradas: 0, opCerradas: 0, metaMensual: metaV, metaMensualOps: metaO,
    carteraTotal: 0, totalProyecciones: 0, totalProyeccionesOp: 0,
    enSeguimientoMonto: 0, enSeguimientoOp: 0, scoreBajoMonto: 0, scoreBajoOp: 0,
    afectacionesMonto: 0, afectacionesOp: 0, derivadoAprobadoMonto: 0, derivadoAprobadoOp: 0,
    derivadoRechazadoMonto: 0, derivadoRechazadoOp: 0,
    comisionCapital: 0, comisionOperaciones: 0, comisionTotal: 0,
    ventasAcumuladas: Array(ultimoDiaMes).fill(null),
    opsAcumuladas: Array(ultimoDiaMes).fill(null),
    diasDelMes: ultimoDiaMes, diasTranscurridos: maxDiaCalculo, alcanceActual: 0,
  });

  const objPDV = (objetivos || []).find(o => o.analista === 'PDV');
  const metaVPDV = Number(objPDV?.meta_ventas) || 0;
  const metaOPDV = Number(objPDV?.meta_operaciones) || 0;
  const result: Record<string, ProyeccionData> = { 'PDV': mkEntry(metaVPDV, metaOPDV) };
  const datosDiariosMonto: Record<string, number[]> = { 'PDV': Array(ultimoDiaMes).fill(0) };
  const datosDiariosOps: Record<string, number[]> = { 'PDV': Array(ultimoDiaMes).fill(0) };

  CONFIG.ANALISTAS_DEFAULT.forEach(a => {
    const obj = (objetivos || []).find(o => o.analista === a);
    const metaV = Number(obj?.meta_ventas) || 0;
    const metaO = Number(obj?.meta_operaciones) || 0;
    result[a] = mkEntry(metaV, metaO);
    datosDiariosMonto[a] = Array(ultimoDiaMes).fill(0);
    datosDiariosOps[a] = Array(ultimoDiaMes).fill(0);
  });

  regs.forEach(fila => {
    const monto = Number(fila.monto) || 0;
    const analista = (fila.analista || '').trim();
    const estadoNorm = (fila.estado || '').toLowerCase().trim();
    if (!fila.fecha) return;
    const fechaReg = new Date(fila.fecha);
    const mesReg = fechaReg.getMonth();
    const anioReg = fechaReg.getFullYear();
    const diaReg = fechaReg.getDate();
    const esMesObjetivo = mesReg === mesActual && anioReg === anioActual;
    const esVenta = estadoNorm === 'venta' || estadoNorm.includes('aprobado cc');
    const analistaValido = CONFIG.ANALISTAS_DEFAULT.includes(analista) ? analista : null;

    if (!analistaValido || !esMesObjetivo) return;

    if (esVenta) {
      result[analistaValido].ventasCerradas += monto;
      result[analistaValido].opCerradas += 1;
      result[analistaValido].carteraTotal += monto;
      result['PDV'].ventasCerradas += monto;
      result['PDV'].opCerradas += 1;
      result['PDV'].carteraTotal += monto;
      if (diaReg >= 1 && diaReg <= ultimoDiaMes) {
        datosDiariosMonto[analistaValido][diaReg - 1] += monto;
        datosDiariosOps[analistaValido][diaReg - 1] += 1;
        datosDiariosMonto['PDV'][diaReg - 1] += monto;
        datosDiariosOps['PDV'][diaReg - 1] += 1;
      }
      if (estadoNorm.includes('aprobado cc')) {
        result[analistaValido].derivadoAprobadoMonto += monto;
        result[analistaValido].derivadoAprobadoOp += 1;
        result['PDV'].derivadoAprobadoMonto += monto;
        result['PDV'].derivadoAprobadoOp += 1;
      }
    } else if (estadosActivos.includes(estadoNorm)) {
      result[analistaValido].carteraTotal += monto;
      result['PDV'].carteraTotal += monto;
      const mapEntry = ESTADOS_MAP[estadoNorm];
      if (mapEntry) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rAnalista = result[analistaValido] as any;
        const rPDV = result['PDV'] as any;
        rAnalista[mapEntry.monto] += monto;
        rAnalista[mapEntry.op] += 1;
        rPDV[mapEntry.monto] += monto;
        rPDV[mapEntry.op] += 1;
      }
    }
  });

  Object.keys(result).forEach(key => {
    if (key !== 'PDV') {
      const c = calcularComisiones(result[key].ventasCerradas, result[key].opCerradas, result[key].metaMensual, result[key].metaMensualOps);
      result[key].comisionCapital = c.comisionCapital;
      result[key].comisionOperaciones = c.comisionOperaciones;
      result[key].comisionTotal = c.comisionTotal;
    }
    let acumMonto = 0, acumOps = 0;
    const daily = datosDiariosMonto[key] || Array(ultimoDiaMes).fill(0);
    const dailyOps = datosDiariosOps[key] || Array(ultimoDiaMes).fill(0);
    for (let i = 0; i < ultimoDiaMes; i++) {
      if (i < maxDiaCalculo) {
        acumMonto += daily[i];
        acumOps += dailyOps[i];
        result[key].ventasAcumuladas[i] = acumMonto;
        result[key].opsAcumuladas[i] = acumOps;
      }
    }
    result[key].alcanceActual = result[key].metaMensual > 0
      ? (result[key].ventasCerradas / result[key].metaMensual) * 100 : 0;
  });

  return { data: result, mesActual, anioActual, diaActual };
}

export default async function ProyeccionPage() {
  const { data, mesActual, anioActual, diaActual } = await buildProyeccion();
  return (
    <ProyeccionClient
      data={data}
      mesActual={mesActual}
      anioActual={anioActual}
      diaActual={diaActual}
    />
  );
}
