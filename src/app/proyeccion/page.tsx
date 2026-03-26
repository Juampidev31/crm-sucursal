'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, calcularComisiones, calcularDiasHabilesAutomaticos } from '@/lib/utils';
import { CONFIG, ESTADOS_MAP } from '@/types';
import {
  Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, Target, Users, DollarSign } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler);

interface ProyeccionData {
  ventasCerradas: number;
  opCerradas: number;
  metaMensual: number;
  metaMensualOps: number;
  carteraTotal: number;
  totalProyecciones: number;
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
  comisionCapital: number;
  comisionOperaciones: number;
  comisionTotal: number;
  ventasAcumuladas: (number | null)[];
  opsAcumuladas: (number | null)[];
  diasDelMes: number;
  diasTranscurridos: number;
  alcanceActual: number;
}

export default function ProyeccionPage() {
  const [data, setData] = useState<Record<string, ProyeccionData>>({});
  const [analistaSeleccionado, setAnalistaSeleccionado] = useState('PDV');
  const [loading, setLoading] = useState(true);

  const analistas = ['PDV', ...CONFIG.ANALISTAS_DEFAULT];
  const now = new Date();
  const mesActual = now.getMonth();
  const anioActual = now.getFullYear();
  const diaActual = now.getDate();

  const fetchProyeccion = useCallback(async () => {
    setLoading(true);
    const ultimoDiaMes = new Date(anioActual, mesActual + 1, 0).getDate();
    const maxDiaCalculo = Math.min(diaActual, ultimoDiaMes);

    const { data: registros } = await supabase.from('registros').select('*');
    const { data: objetivos } = await supabase.from('objetivos').select('*').eq('anio', anioActual).eq('mes', mesActual);

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

      if (analistaValido && esMesObjetivo) {
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
      }
    });

    // Calcular comisiones y acumulados
    Object.keys(result).forEach(key => {
      if (key !== 'PDV') {
        const c = calcularComisiones(result[key].ventasCerradas, result[key].opCerradas, result[key].metaMensual, result[key].metaMensualOps);
        result[key].comisionCapital = c.comisionCapital;
        result[key].comisionOperaciones = c.comisionOperaciones;
        result[key].comisionTotal = c.comisionTotal;
      }
      // Acumulados
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

    setData(result);
    setLoading(false);
  }, [mesActual, anioActual, diaActual]);

  useEffect(() => { fetchProyeccion(); }, [fetchProyeccion]);

  const d = data[analistaSeleccionado];
  if (!d && !loading) return <div className="dashboard-container"><p>Sin datos</p></div>;

  const diasHabiles = calcularDiasHabilesAutomaticos(mesActual, anioActual);
  const ritmoActual = diasHabiles.diasTranscurridos > 0 ? (d?.ventasCerradas || 0) / diasHabiles.diasTranscurridos : 0;
  const proyeccionFin = ritmoActual * diasHabiles.diasHabiles;
  const ticketPromedio = (d?.opCerradas || 0) > 0 ? (d?.ventasCerradas || 0) / d.opCerradas : 0;

  // Chart: Acumulado diario
  const labels = Array.from({ length: d?.diasDelMes || 30 }, (_, i) => String(i + 1));
  const metaLineal = d ? labels.map((_, i) => (d.metaMensual / d.diasDelMes) * (i + 1)) : [];

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Meta Lineal',
        data: metaLineal,
        borderColor: 'rgba(255,255,255,0.15)',
        borderDash: [5, 5],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Ventas Acumuladas',
        data: d?.ventasAcumuladas || [],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76,175,80,0.1)',
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: '#4CAF50',
        fill: true,
        tension: 0.3,
        spanGaps: false,
      },
      {
        label: `Proyección (${formatCurrency(proyeccionFin)})`,
        data: d ? labels.map((_, i) => (i < (d.diasTranscurridos || 0)) ? null : ritmoActual * (i + 1)) : [],
        borderColor: 'rgba(247,228,121,0.5)',
        borderDash: [3, 3],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        spanGaps: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#888', font: { family: 'Outfit' } } },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y || 0)}`,
        },
      },
    },
    scales: {
      x: { ticks: { color: '#555', maxTicksLimit: 15 }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y: {
        ticks: { color: '#555', callback: (v: string | number) => formatCurrency(Number(v)) },
        grid: { color: 'rgba(255,255,255,0.03)' },
      },
    },
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Proyección Predictiva</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>
            {CONFIG.MESES_NOMBRES[mesActual]} {anioActual} — Día {diaActual} de {d?.diasDelMes || '?'}
          </p>
        </div>
        <select className="form-select" style={{ minWidth: '180px' }}
          value={analistaSeleccionado} onChange={e => setAnalistaSeleccionado(e.target.value)}>
          {analistas.map(a => <option key={a} value={a}>{a === 'PDV' ? 'Punto de Venta (Todos)' : a}</option>)}
        </select>
      </header>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><span>Calculando proyección...</span></div>
      ) : d && (
        <>
          {/* KPIs de Proyección */}
          <div className="cards-container">
            <div className="kpi-card">
              <div className="kpi-title"><DollarSign size={14} /> Ventas Cerradas</div>
              <div className="kpi-val">{formatCurrency(d.ventasCerradas)}</div>
              <div className={`kpi-sub ${d.alcanceActual >= 75 ? 'up' : 'down'}`}>
                {d.alcanceActual.toFixed(1)}% del objetivo
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title"><Target size={14} /> Proyección Fin de Mes</div>
              <div className="kpi-val">{formatCurrency(proyeccionFin)}</div>
              <div className={`kpi-sub ${proyeccionFin >= d.metaMensual ? 'up' : 'down'}`}>
                {d.metaMensual > 0 ? ((proyeccionFin / d.metaMensual) * 100).toFixed(0) : 0}% estimado
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title"><Users size={14} /> Operaciones</div>
              <div className="kpi-val">{d.opCerradas}</div>
              <div className={`kpi-sub ${d.opCerradas >= d.metaMensualOps * 0.8 ? 'up' : 'down'}`}>
                {d.metaMensualOps > 0 ? ((d.opCerradas / d.metaMensualOps) * 100).toFixed(0) : 0}% de meta ({d.metaMensualOps})
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title"><TrendingUp size={14} /> Ticket Promedio</div>
              <div className="kpi-val">{formatCurrency(ticketPromedio)}</div>
              <div className="kpi-sub up">Ritmo: {formatCurrency(ritmoActual)}/día</div>
            </div>
          </div>

          {/* Gráfico de Acumulado */}
          <div className="chart-card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Curva Acumulada — Ventas vs Meta
            </h3>
            <div style={{ height: '380px' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Resumen de Gestión */}
          <div className="cards-container" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {[
              { label: 'Proyecciones', monto: d.totalProyecciones, ops: d.totalProyeccionesOp, color: 'var(--main-color)' },
              { label: 'En Seguimiento', monto: d.enSeguimientoMonto, ops: d.enSeguimientoOp, color: 'var(--azul)' },
              { label: 'Score Bajo', monto: d.scoreBajoMonto, ops: d.scoreBajoOp, color: 'var(--rojo)' },
              { label: 'Afectaciones', monto: d.afectacionesMonto, ops: d.afectacionesOp, color: 'var(--naranja)' },
              { label: 'Aprobado CC', monto: d.derivadoAprobadoMonto, ops: d.derivadoAprobadoOp, color: '#9B59B6' },
              { label: 'Rechazado CC', monto: d.derivadoRechazadoMonto, ops: d.derivadoRechazadoOp, color: '#E67E22' },
            ].map(item => (
              <div key={item.label} className="kpi-card" style={{ borderLeft: `3px solid ${item.color}` }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatCurrency(item.monto)}</div>
                <div style={{ fontSize: '12px', color: item.color, fontWeight: 700, marginTop: '4px' }}>{item.ops} ops</div>
              </div>
            ))}
          </div>

          {/* Comisiones */}
          {analistaSeleccionado !== 'PDV' && (
            <div className="chart-card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Comisiones — {analistaSeleccionado}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px', textTransform: 'uppercase' }}>Capital</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--verde)' }}>{formatCurrency(d.comisionCapital)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px', textTransform: 'uppercase' }}>Operaciones</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--azul)' }}>{formatCurrency(d.comisionOperaciones)}</div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px', textTransform: 'uppercase' }}>Total</div>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--verde)' }}>{formatCurrency(d.comisionTotal)}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
