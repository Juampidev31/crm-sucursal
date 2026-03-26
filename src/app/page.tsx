'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { CONFIG } from '@/types';
import { displayAnalista } from '@/lib/utils';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const numFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const ESTADOS_CONFIG = [
  { key: 'venta', label: 'Venta', color: '#4CAF50' },
  { key: 'proyeccion', label: 'Proyección', color: '#17a2b8' },
  { key: 'en seguimiento', label: 'En seguimiento', color: '#ffc107' },
  { key: 'score bajo', label: 'Score bajo', color: '#ff7675' },
  { key: 'afectaciones', label: 'Afectaciones', color: '#dc3545' },
  { key: 'derivado / aprobado cc', label: 'Derivado / Aprobado CC', color: '#00b894' },
  { key: 'derivado / rechazado cc', label: 'Derivado / Rechazado CC', color: '#e17055' },
];

interface Reg { analista: string; estado: string; monto: number; fecha: string | null; }

export default function MetricasPage() {
  const [registros, setRegistros] = useState<Reg[]>([]);
  const [analistas, setAnalistas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMes, setFiltroMes] = useState('todos');
  const [filtroAnalista, setFiltroAnalista] = useState('todos');

  const mesesDisponibles = useMemo(() => {
    const now = new Date();
    const meses = [];
    for (let i = 0; i < 18; i++) {
      let m = now.getMonth() - i;
      let a = now.getFullYear();
      while (m < 0) { m += 12; a--; }
      const key = `${a}-${String(m + 1).padStart(2, '0')}`;
      meses.push({ key, label: `${CONFIG.MESES_NOMBRES[m]} ${a}` });
    }
    return meses;
  }, []);

  useEffect(() => {
    supabase.from('registros').select('analista, estado, monto, fecha').then(({ data }) => {
      const regs = (data || []) as Reg[];
      setRegistros(regs);
      const set = new Set(regs.map(r => r.analista).filter(Boolean));
      setAnalistas(Array.from(set) as string[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return registros.filter(r => {
      if (filtroAnalista !== 'todos' && r.analista !== filtroAnalista) return false;
      if (filtroMes !== 'todos') {
        if (!r.fecha || r.fecha.slice(0, 7) !== filtroMes) return false;
      }
      return true;
    });
  }, [registros, filtroAnalista, filtroMes]);

  const estadosData = useMemo(() => {
    return ESTADOS_CONFIG.map(e => {
      const regs = filtered.filter(r => (r.estado || '').toLowerCase() === e.key);
      return { ...e, ops: regs.length, monto: regs.reduce((s, r) => s + (Number(r.monto) || 0), 0) };
    });
  }, [filtered]);

  const conMonto = estadosData.filter(e => e.monto > 0);

  const chartData = {
    labels: conMonto.map(e => e.label),
    datasets: [{
      data: conMonto.map(e => e.monto),
      backgroundColor: conMonto.map(e => e.color),
      borderColor: '#000',
      borderWidth: 2,
      hoverOffset: 10,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#888', font: { family: 'Outfit', size: 11 },
          boxWidth: 12, padding: 14,
        },
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => ` ${numFmt.format(ctx.parsed)}`,
        },
      },
    },
    cutout: '60%',
  };

  const selectStyle: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#fff', fontSize: '13px',
    padding: '8px 36px 8px 14px', outline: 'none',
    fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
    WebkitAppearance: 'none', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: '24px', paddingBottom: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>Métricas por estado</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>MES</div>
            <select style={selectStyle} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
              <option value="todos">Todos los meses</option>
              {mesesDisponibles.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>ANALISTA</div>
            <select style={selectStyle} value={filtroAnalista} onChange={e => setFiltroAnalista(e.target.value)}>
              <option value="todos">Total (todos)</option>
              {analistas.map(a => <option key={a} value={a}>{displayAnalista(a)}</option>)}
            </select>
          </div>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '16px', alignItems: 'start' }}>
          {/* Lista de estados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {estadosData.map(e => (
              <div key={e.key} style={{
                background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '12px', padding: '10px 18px',
                display: 'flex', alignItems: 'center', gap: '14px',
                transition: 'border-color 0.2s',
              }}>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>{e.label}</div>
                  <div style={{ fontSize: '11px', color: '#444', marginTop: '1px' }}>{e.ops} ops</div>
                </div>
                <div style={{
                  fontSize: '17px', fontWeight: 800, color: '#fff',
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px',
                }}>
                  {numFmt.format(e.monto)}
                </div>
              </div>
            ))}
          </div>

          {/* Donut chart */}
          <div style={{
            background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '16px', padding: '28px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'sticky', top: '24px',
          }}>
            <div style={{ height: '380px', width: '100%' }}>
              <Doughnut data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
