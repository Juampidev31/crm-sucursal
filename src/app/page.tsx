'use client';

import React, { useState, useMemo } from 'react';
import { formatCurrency, getStatusLabel, getStatusColor } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  Tooltip, Legend, ArcElement,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

// Estilos de colores específicos para este dashboard (según imagen)
const CHART_COLORS = {
  venta: '#4CAF50',
  proyeccion: '#17a2b8',
  'en seguimiento': '#ffc107',
  'score bajo': '#dc3545',
  afectaciones: '#c0392b',
  'derivado / aprobado cc': '#27ae60',
  'derivado / rechazado cc': '#e74c3c'
};

const ESTADOS = [
  'venta', 'proyeccion', 'en seguimiento', 'score bajo', 'afectaciones',
  'derivado / aprobado cc', 'derivado / rechazado cc'
];

const ANALISTAS = ['Luciana', 'Victoria'];

export default function DashboardPage() {
  const [analista, setAnalista] = useState('');
  const [mes, setMes] = useState(''); // '' = Todos
  const { registros: regs, loading } = useData();

  const stats = useMemo(() => {
    let filtered = regs;
    if (analista) filtered = filtered.filter(r => r.analista === analista);
    if (mes) filtered = filtered.filter(r => r.fecha && r.fecha.includes(`-${mes}-`));

    const result = ESTADOS.map(st => {
      const match = filtered.filter(r => r.estado?.toLowerCase() === st);
      return {
        key: st,
        label: getStatusLabel(st),
        monto: match.reduce((acc, r) => acc + Number(r.monto || 0), 0),
        ops: match.length,
        color: (CHART_COLORS as any)[st] || '#888'
      };
    });
    return result;
  }, [regs, analista, mes]);

  const doughnutData = {
    labels: stats.map(s => s.label),
    datasets: [{
      data: stats.map(s => s.monto),
      backgroundColor: stats.map(s => s.color),
      borderWidth: 0,
      hoverOffset: 10
    }]
  };

  const doughnutOptions = {
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#888', font: { size: 10 }, usePointStyle: true, padding: 20 }
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.label}: ${formatCurrency(ctx.raw)}`
        }
      }
    },
    maintainAspectRatio: false
  };

  if (loading) return <div className="dashboard-container"><div className="spinner" /></div>;

  return (
    <div className="dashboard-container" style={{ padding: '32px' }}>
      <header className="dashboard-header" style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Métricas por estado</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#555', fontWeight: 800, display: 'block', marginBottom: '4px' }}>MES</label>
            <select className="form-select" style={{ background: '#0a0a0a', border: '1px solid #222', minWidth: '140px' }} value={mes} onChange={e => setMes(e.target.value)}>
              <option value="">Todos los meses</option>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#555', fontWeight: 800, display: 'block', marginBottom: '4px' }}>ANALISTA</label>
            <select className="form-select" style={{ background: '#0a0a0a', border: '1px solid #222', minWidth: '140px' }} value={analista} onChange={e => setAnalista(e.target.value)}>
              <option value="">Total (Todos)</option>
              {ANALISTAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        {/* Lado Izquierdo: Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stats.map(s => (
            <div key={s.key} style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.03)'
            }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '4px', height: '24px', background: s.color, borderRadius: '2px' }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#eee' }}>{s.label}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>{s.ops} ops</div>
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#fff' }}>{formatCurrency(s.monto)}</div>
            </div>
          ))}
        </div>

        {/* Lado Derecho: Doughnut */}
        <div style={{ 
          background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)',
          padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ width: '100%', height: '360px' }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
