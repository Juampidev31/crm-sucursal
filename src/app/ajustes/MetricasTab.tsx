'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatCurrency, getStatusLabel } from '@/lib/utils';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { CONFIG } from '@/types';
import { ESTADOS } from '@/context/FilterContext';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  Tooltip, Legend, ArcElement,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

const CHART_COLORS = {
  venta: '#4ade80',
  proyeccion: 'rgba(255, 255, 255, 0.8)',
  'en seguimiento': 'rgba(255, 255, 255, 0.4)',
  'score bajo': '#f87171',
  afectaciones: '#fb923c',
  'derivado / aprobado cc': '#60a5fa',
  'derivado / rechazado cc': '#f43f5e'
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

const ModernDoughnut = ({ data, totalMonto, label }: { data: any, totalMonto: number, label: string }) => {
  const options = {
    cutout: '82%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111',
        titleColor: '#fff',
        bodyColor: '#ccc',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${formatCurrency(Number(ctx.raw))}`
        }
      }
    },
    maintainAspectRatio: false,
    elements: {
      arc: {
        borderWidth: 0,
        borderRadius: 4,
      }
    }
  };

  return (
    <div style={{ position: 'relative', height: '220px', width: '220px', margin: '0 auto' }}>
      <Doughnut data={data} options={options} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', textAlign: 'center',
        width: '100%', pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '10px', color: '#555', fontWeight: 800, letterSpacing: '1px', marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
          {formatCurrency(totalMonto)}
        </div>
      </div>
    </div>
  );
};

interface Props {
  selectedMes?: number;
  selectedAnio?: number;
  registros?: any[];
}

export default function MetricasTab({ selectedMes: propMes, selectedAnio: propAnio, registros: manualRegs }: Props) {
  const [internalMes, setInternalMes] = useState(mesActual);
  const [internalAnio, setInternalAnio] = useState(new Date().getFullYear());
  
  const mes = propMes ? String(propMes).padStart(2, '0') : internalMes;
  const anio = propAnio || internalAnio;

  // Intentar usar el provider si no nos pasan los registros por prop
  let ctxRegs: any[] = [];
  let ctxLoading = false;
  try {
    const ctx = useRegistros();
    ctxRegs = ctx.registros;
    ctxLoading = ctx.loading;
  } catch (e) { }
  
  const regs = manualRegs || ctxRegs;
  const loading = manualRegs ? false : ctxLoading;

  const getStatsForAnalista = (analista: string) => {
    let filtered = regs || [];
    if (analista) filtered = filtered.filter(r => r.analista === analista);
    if (mes) filtered = filtered.filter(r => r.fecha && r.fecha.slice(5, 7) === mes);
    if (anio) filtered = filtered.filter(r => r.fecha && r.fecha.slice(0, 4) === String(anio));

    const stats = ESTADOS.map(st => {
      const match = filtered.filter(r => r.estado?.toLowerCase() === st);
      return {
        key: st,
        label: getStatusLabel(st),
        monto: match.reduce((acc, r) => acc + Number(r.monto || 0), 0),
        ops: match.length,
        color: (CHART_COLORS as Record<string, string>)[st] || '#444'
      };
    });

    const totalMonto = stats.reduce((acc, s) => acc + s.monto, 0);
    const totalOps = stats.reduce((acc, s) => acc + s.ops, 0);

    const doughnutData = {
      labels: stats.map(s => s.label),
      datasets: [{
        data: stats.map(s => s.monto),
        backgroundColor: stats.map(s => s.color),
        hoverOffset: 15,
        borderRadius: 6,
        spacing: 4
      }]
    };

    return { stats, totalMonto, totalOps, doughnutData };
  };

  const views = useMemo(() => {
    const base = [{ id: 'todos', label: 'General (Todos)', analista: '' }];
    const analistas = (CONFIG.ANALISTAS_DEFAULT || []).map(a => ({
      id: a.toLowerCase(),
      label: a,
      analista: a
    }));
    
    return [...base, ...analistas].map(v => ({ 
      ...v, 
      data: getStatsForAnalista(v.analista) 
    }));
  }, [regs, mes, anio]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div style={{ width: '100%', padding: '8px' }}>
      <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#fff', letterSpacing: '-0.8px' }}>Métricas Comparativas</h3>
          <p style={{ fontSize: '13px', color: 'var(--gris)', marginTop: '4px' }}>Rendimiento distribuido por analista y total general</p>
        </div>

        {!propMes && (
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label style={{ fontSize: '9px', color: '#666', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>PERÍODO ANALIZADO</label>
            <select 
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, outline: 'none', cursor: 'pointer' }} 
              value={internalMes} 
              onChange={e => setInternalMes(e.target.value)}
            >
              <option value="" style={{ background: '#111' }}>Todos los meses</option>
              {MESES.map(m => <option key={m.value} value={m.value} style={{ background: '#111' }}>{m.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
        {views.map(view => (
          <div key={view.id} style={{ 
            background: 'rgba(255,255,255,0.01)', 
            borderRadius: '28px', 
            border: '1px solid rgba(255,255,255,0.03)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            transition: 'transform 0.3s ease, border-color 0.3s ease',
          }}
          className="metric-card-hover"
          >
            <div style={{ textAlign: 'center' }}>
              <ModernDoughnut 
                data={view.data.doughnutData} 
                totalMonto={view.data.totalMonto} 
                label={view.label}
              />
              <div style={{ marginTop: '16px', fontSize: '11px', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>
                {view.data.totalOps} OPERACIONES TOTALES
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {view.data.stats.filter(s => s.ops > 0).map(s => (
                <div key={s.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.01)',
                }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '4px', height: '14px', background: s.color, borderRadius: '4px' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{s.label}</div>
                      <div style={{ fontSize: '9px', color: '#444', fontWeight: 800 }}>{s.ops} OPS</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#fff' }}>{formatCurrency(s.monto)}</div>
                </div>
              ))}
              {view.data.totalOps === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#333', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '12px' }}>
                  Sin datos en este período
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .metric-card-hover:hover {
          transform: translateY(-5px);
          border-color: rgba(255,255,255,0.08) !important;
          background: rgba(255,255,255,0.015) !important;
        }
      `}</style>
    </div>
  );
}
