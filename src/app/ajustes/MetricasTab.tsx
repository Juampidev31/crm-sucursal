'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatCurrency, getStatusLabel } from '@/lib/utils';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { CONFIG } from '@/types';
import { ESTADOS } from '@/context/FilterContext';
import ModernDoughnut from '@/components/charts/ModernDoughnut';
import CustomSelect from '@/components/CustomSelect';

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

interface Props {
  selectedMes?: number;
  selectedAnio?: number;
  registros?: any[];
  analista?: string;
  /** Si es true, MetricasTab no dibuja su propio selector Mes/Año; lo controla el padre vía mesStr/anioNum. */
  hideSelector?: boolean;
  mesStr?: string;
  anioNum?: number;
  analistas?: string[];
}

export default function MetricasTab({ selectedMes: propMes, selectedAnio: propAnio, registros: manualRegs, analista: propAnalista, hideSelector, mesStr, anioNum, analistas: propAnalistas }: Props) {
  const [internalMes, setInternalMes] = useState(propMes ? String(propMes).padStart(2, '0') : mesActual);
  const [internalAnio, setInternalAnio] = useState(propAnio || new Date().getFullYear());

  // Sincronizar con props cuando cambian en el dashboard principal
  useEffect(() => {
    if (propMes) setInternalMes(String(propMes).padStart(2, '0'));
    if (propAnio) setInternalAnio(propAnio);
  }, [propMes, propAnio]);

  // Modo controlado: el selector vive en el padre (header de la sección).
  useEffect(() => {
    if (!hideSelector) return;
    if (mesStr !== undefined) setInternalMes(mesStr);
    if (anioNum !== undefined) setInternalAnio(anioNum);
  }, [hideSelector, mesStr, anioNum]);

  // Intentar usar el provider si no nos pasan los registros por prop
  let ctxRegs: any[] = [];
  let ctxLoading = false;
  try {
    const ctx = useRegistros();
    ctxRegs = ctx.registros;
    ctxLoading = ctx.loading;
  } catch { }
  
  const regs = manualRegs || ctxRegs;
  const loading = manualRegs ? false : ctxLoading;

  const getStatsForAnalista = (analista: string) => {
    let filtered = regs || [];
    // Filtrar por analista (tanto con registros del provider como manuales)
    if (analista) filtered = filtered.filter(r => r.analista === analista);

    if (internalMes) filtered = filtered.filter(r => r.fecha && r.fecha.slice(5, 7) === internalMes);
    if (internalAnio) filtered = filtered.filter(r => r.fecha && r.fecha.slice(0, 4) === String(internalAnio));

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
    if (propAnalista && propAnalista !== 'PDV') {
      return [{ 
        id: propAnalista.toLowerCase(), 
        label: propAnalista.toUpperCase(), 
        analista: propAnalista,
        data: getStatsForAnalista(propAnalista)
      }];
    }

    if (propAnalista === 'PDV') {
      return [{ 
        id: 'todos', 
        label: 'TOTAL GENERAL', 
        analista: '',
        data: getStatsForAnalista('')
      }];
    }

    const base = [{ id: 'todos', label: 'General (Todos)', analista: '' }];
    const analistas = (propAnalistas ?? CONFIG.ANALISTAS_DEFAULT).map(a => ({
      id: a.toLowerCase(),
      label: a,
      analista: a
    }));
    
    return [...base, ...analistas].map(v => ({ 
      ...v, 
      data: getStatsForAnalista(v.analista) 
    }));
  }, [regs, internalMes, internalAnio, propAnalista]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div style={{ width: '100%' }}>
      {!hideSelector && (
        <div className="data-card-header" style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '-52px', marginBottom: '16px' }}>
          <CustomSelect
            value={internalMes}
            onChange={val => setInternalMes(String(val))}
            options={[{ label: 'Todos', value: '' }, ...MESES.map(m => ({ label: m.label, value: m.value }))]}
            width="140px"
          />
          <CustomSelect
            value={internalAnio}
            onChange={val => setInternalAnio(Number(val))}
            options={[2024, 2025, 2026].map(y => ({ label: String(y), value: y }))}
            width="100px"
          />
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: views.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '32px',
        justifyContent: 'center'
      }}>
        {views.map(view => {
          const isSingle = views.length === 1;

          return (
            <div key={view.id} style={{ 
              background: 'rgba(255,255,255,0.01)', 
              borderRadius: '28px', 
              border: '1px solid rgba(255,255,255,0.03)',
              padding: isSingle ? '24px' : '32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: isSingle ? '24px' : '32px',
              transition: 'transform 0.3s ease, border-color 0.3s ease',
              width: '100%'
            }}
            >
              <div style={{ textAlign: 'center', width: '100%' }}>
                <ModernDoughnut
                  data={view.data.doughnutData}
                  label="VENTAS"
                  value={formatCurrency(view.data.totalMonto)}
                  tooltipLabel={(ctx) => ` ${ctx.label}: ${formatCurrency(Number(ctx.raw))}`}
                  padding={70}
                  clip={false}
                  height="280px"
                  width="280px"
                />
                <div style={{ marginTop: '20px', fontSize: '11px', color: '#555', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  {view.data.totalOps} OPERACIONES TOTALES
                </div>
              </div>



              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
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

