'use client';

import React, { useState } from 'react';
import { formatCurrency, calcularDiasHabilesAutomaticos } from '@/lib/utils';
import { CONFIG } from '@/types';
import {
  Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, Target, Users, DollarSign } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler);

export interface ProyeccionData {
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

interface Props {
  data: Record<string, ProyeccionData>;
  mesActual: number;
  anioActual: number;
  diaActual: number;
}

export default function ProyeccionClient({ data, mesActual, anioActual, diaActual }: Props) {
  const [analistaSeleccionado, setAnalistaSeleccionado] = useState('PDV');
  const analistas = ['PDV', ...CONFIG.ANALISTAS_DEFAULT];
  const d = data[analistaSeleccionado];

  if (!d) return <div className="dashboard-container"><p>Sin datos</p></div>;

  const diasHabiles = calcularDiasHabilesAutomaticos(mesActual, anioActual);
  const ritmoActual = diasHabiles.diasTranscurridos > 0 ? d.ventasCerradas / diasHabiles.diasTranscurridos : 0;
  const proyeccionFin = ritmoActual * diasHabiles.diasHabiles;
  const ticketPromedio = d.opCerradas > 0 ? d.ventasCerradas / d.opCerradas : 0;

  const labels = Array.from({ length: d.diasDelMes }, (_, i) => String(i + 1));
  const metaLineal = labels.map((_, i) => (d.metaMensual / d.diasDelMes) * (i + 1));

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
        data: d.ventasAcumuladas,
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
        data: labels.map((_, i) => (i < d.diasTranscurridos) ? null : ritmoActual * (i + 1)),
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
            {CONFIG.MESES_NOMBRES[mesActual]} {anioActual} — Día {diaActual} de {d.diasDelMes}
          </p>
        </div>
        <select className="form-select" style={{ minWidth: '180px' }}
          value={analistaSeleccionado} onChange={e => setAnalistaSeleccionado(e.target.value)}>
          {analistas.map(a => <option key={a} value={a}>{a === 'PDV' ? 'Punto de Venta (Todos)' : a}</option>)}
        </select>
      </header>

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

      <div className="chart-card">
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Curva Acumulada — Ventas vs Meta
        </h3>
        <div style={{ height: '380px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

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

      {analistaSeleccionado !== 'PDV' && d.comisionTotal > 0 && (
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
    </div>
  );
}
