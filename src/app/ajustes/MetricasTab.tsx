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
import { calloutPlugin, bgTrackPlugin, glowPlugin } from '@/lib/chartPlugins';

ChartJS.register(CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

const CHART_COLORS = {
  venta: 'rgba(74, 222, 128, 0.8)',
  proyeccion: 'rgba(255, 255, 255, 0.7)',
  'en seguimiento': 'rgba(255, 255, 255, 0.4)',
  'score bajo': 'rgba(248, 113, 113, 0.8)',
  afectaciones: 'rgba(251, 146, 60, 0.8)',
  'derivado / aprobado cc': 'rgba(96, 165, 250, 0.8)',
  'derivado / rechazado cc': 'rgba(244, 63, 94, 0.8)'
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
    layout: { padding: 40 },
    cutout: '88%',
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
        borderRadius: 30,
      }
    }
  };

  return (
    <div style={{ position: 'relative', height: '220px', width: '220px', margin: '0 auto' }}>
      <Doughnut data={data} options={options} plugins={[calloutPlugin, bgTrackPlugin, glowPlugin]} />
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
  analista?: string;
}

export default function MetricasTab({ selectedMes: propMes, selectedAnio: propAnio, registros: manualRegs, analista: propAnalista }: Props) {
  const [internalMes, setInternalMes] = useState(propMes ? String(propMes).padStart(2, '0') : mesActual);
  const [internalAnio, setInternalAnio] = useState(propAnio || new Date().getFullYear());
  
  // Sincronizar con props cuando cambian en el dashboard principal
  useEffect(() => {
    if (propMes) setInternalMes(String(propMes).padStart(2, '0'));
    if (propAnio) setInternalAnio(propAnio);
  }, [propMes, propAnio]);

  const mes = internalMes;
  const anio = internalAnio;

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
    // OJO: Si ya nos pasan registros manuales (ya filtrados en el padre), no volvemos a filtrar por analista
    // a menos que analista sea un nombre específico y estemos en modo "General"
    if (analista && !manualRegs) filtered = filtered.filter(r => r.analista === analista);
    
    // Si estamos en PDV y filtramos por Luciana en un sub-gráfico, filtramos sobre el total
    if (analista && manualRegs) filtered = filtered.filter(r => r.analista === analista);

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
    // Si se fuerza un analista específico (que no sea PDV), mostrar solo ese
    if (propAnalista && propAnalista !== 'PDV') {
      return [{ 
        id: propAnalista.toLowerCase(), 
        label: propAnalista.toUpperCase(), 
        analista: propAnalista,
        data: getStatsForAnalista(propAnalista)
      }];
    }

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
  }, [regs, mes, anio, propAnalista]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div style={{ width: '100%' }}>
      <div className="data-card-header" style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '-52px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '9px', color: '#666', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>MES</label>
            <select 
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, outline: 'none', cursor: 'pointer' }} 
              value={internalMes} 
              onChange={e => setInternalMes(e.target.value)}
            >
              <option value="" style={{ background: '#111' }}>Todos</option>
              {MESES.map(m => <option key={m.value} value={m.value} style={{ background: '#111' }}>{m.label}</option>)}
            </select>
          </div>
          
          <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.05)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '9px', color: '#666', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>AÑO</label>
            <select 
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, outline: 'none', cursor: 'pointer' }} 
              value={internalAnio} 
              onChange={e => setInternalAnio(Number(e.target.value))}
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y} style={{ background: '#111' }}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: views.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '32px',
        justifyContent: 'center'
      }}>
        {views.map(view => {
          const isSingle = views.length === 1;
          const topState = [...view.data.stats].sort((a, b) => b.monto - a.monto)[0];
          const avgTicket = view.data.totalOps > 0 ? view.data.totalMonto / view.data.totalOps : 0;

          return (
            <div key={view.id} style={{ 
              background: 'rgba(255,255,255,0.01)', 
              borderRadius: '28px', 
              border: '1px solid rgba(255,255,255,0.03)',
              padding: isSingle ? '24px' : '32px',
              display: 'flex',
              flexDirection: isSingle ? 'row' : 'column',
              alignItems: isSingle ? 'center' : 'stretch',
              flexWrap: isSingle ? 'wrap' : 'nowrap',
              gap: isSingle ? '24px' : '32px',
              transition: 'transform 0.3s ease, border-color 0.3s ease',
              width: '100%'
            }}
            >
              <div style={{ textAlign: 'center', flex: isSingle ? '0 0 280px' : 'auto' }}>
                <ModernDoughnut 
                  data={view.data.doughnutData} 
                  totalMonto={view.data.totalMonto} 
                  label="VENTAS"
                />
                <div style={{ marginTop: '20px', fontSize: '11px', color: '#555', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  {view.data.totalOps} OPERACIONES TOTALES
                </div>
              </div>

              {isSingle && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: '1 1 280px' }}>
                  <div style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(74,222,128,0) 100%)', borderRadius: '20px', border: '1px solid rgba(74,222,128,0.1)' }}>
                    <div style={{ fontSize: '10px', color: '#34d399', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Mejor Desempeño</div>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{topState.label}</div>
                    <div style={{ fontSize: '13px', color: '#34d399', fontWeight: 700, marginTop: '2px' }}>{formatCurrency(topState.monto)}</div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1, padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '9px', color: '#666', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Cierre del Mes</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>{view.data.totalOps} Ops</div>
                      <div style={{ fontSize: '11px', color: '#888', fontWeight: 700, marginTop: '2px' }}>Finalizadas</div>
                    </div>
                    <div style={{ flex: 1, padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '9px', color: '#666', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Ticket Promedio</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>{formatCurrency(avgTicket)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: isSingle ? '1.5 1 400px' : '1' }}>
                {view.data.stats.filter(s => s.ops > 0).map(s => {
                  const pct = view.data.totalMonto > 0 ? (s.monto / view.data.totalMonto * 100).toFixed(0) : '0';
                  const tick = s.ops > 0 ? s.monto / s.ops : 0;
                  
                  return (
                    <div key={s.key} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.01)',
                    }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: '4px', height: '24px', background: s.color, borderRadius: '4px' }} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: '#eee' }}>{s.label}</div>
                          <div style={{ fontSize: '10px', color: '#555', fontWeight: 700 }}>{s.ops} OPERACIONES · {pct}%</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontSize: '15px', color: '#fff' }}>{formatCurrency(s.monto)}</div>
                        {isSingle && <div style={{ fontSize: '9px', color: '#444', fontWeight: 800 }}>TICKET: {formatCurrency(tick)}</div>}
                      </div>
                    </div>
                  );
                })}
                
                {view.data.totalOps === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#333', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '24px', fontSize: '13px' }}>
                    No se encontraron registros para este periodo.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

