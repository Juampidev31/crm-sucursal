'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatCurrency, getStatusLabel } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { ESTADOS, ANALISTAS } from '@/context/FilterContext';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  Tooltip, Legend, ArcElement,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

// Estilos de colores específicos para este dashboard (según imagen)
const CHART_COLORS = {
  venta: '#fff',
  proyeccion: 'rgba(255,255,255,0.4)',
  'en seguimiento': 'rgba(255,255,255,0.25)',
  'score bajo': 'rgba(255,100,100,0.3)',
  afectaciones: 'rgba(255,100,100,0.5)',
  'derivado / aprobado cc': 'rgba(255,255,255,0.6)',
  'derivado / rechazado cc': 'rgba(255,100,100,0.4)'
};

const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const mesActual = String(new Date().getMonth() + 1).padStart(2, '0');

export default function DashboardPage() {
  const [analista, setAnalista] = useState('');
  const [mes, setMes] = useState(mesActual);
  const { registros: regs, loading, setRegistrosWindowMonths } = useData();

  // Métricas agrupa por mes y permite ver meses pasados → necesita 24m
  useEffect(() => { setRegistrosWindowMonths(24); }, [setRegistrosWindowMonths]);

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
    <div className="dashboard-container" style={{ padding: '24px 32px', maxWidth: '100%', margin: 0 }}>
      <header className="dashboard-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#444', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Dashboard principal</p>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>Métricas de Gestión</h1>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ background: '#0a0a0a', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <label style={{ fontSize: '8px', color: '#444', fontWeight: 800, display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>FILTRAR PERÍODO</label>
            <select style={{ background: '#0a0a0a', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, outline: 'none', cursor: 'pointer' }} value={mes} onChange={e => setMes(e.target.value)}>
              <option value="" style={{ background: '#0a0a0a' }}>Todos los meses</option>
              {MESES.map(m => <option key={m.value} value={m.value} style={{ background: '#0a0a0a' }}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ background: '#0a0a0a', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <label style={{ fontSize: '8px', color: '#444', fontWeight: 800, display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>SELECCIONAR ANALISTA</label>
            <select style={{ background: '#0a0a0a', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, outline: 'none', cursor: 'pointer' }} value={analista} onChange={e => setAnalista(e.target.value)}>
              <option value="" style={{ background: '#0a0a0a' }}>Total (Todos)</option>
              {ANALISTAS.map(a => <option key={a} value={a} style={{ background: '#0a0a0a' }}>{a}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(450px, 1fr) 480px', gap: '24px', alignItems: 'start' }}>
        {/* Lado Izquierdo: Lista de Estados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {stats.filter(s => s.ops > 0).map(s => (
            <div key={s.key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.02)',
              transition: 'all 0.2s ease'
            }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '3px', height: '14px', background: s.color, borderRadius: '4px', opacity: 0.8 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.2px' }}>{s.label}</div>
                  <div style={{ fontSize: '9px', color: '#444', fontWeight: 700 }}>{s.ops} OPERACIONES</div>
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#fff', letterSpacing: '-0.5px' }}>{formatCurrency(s.monto)}</div>
            </div>
          ))}
          {stats.every(s => s.ops === 0) && (
            <div style={{ textAlign: 'center', padding: '60px', color: '#333', border: '1px dashed #222', borderRadius: '20px' }}>
              No hay datos para el filtro seleccionado.
            </div>
          )}
        </div>

        {/* Lado Derecho: Doughnut Minimalista */}
        <div style={{
          background: '#040404', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.02)',
          padding: '40px', position: 'relative', overflow: 'hidden', minHeight: '500px'
        }}>
          <div style={{ position: 'relative', height: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#444', fontWeight: 800, letterSpacing: '2px', marginBottom: '4px' }}>TOTAL BRUTO</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>
                {formatCurrency(stats.reduce((acc, s) => acc + s.monto, 0))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
