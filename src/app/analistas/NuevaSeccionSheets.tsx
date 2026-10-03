'use client';
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { FileText, Tag } from 'lucide-react';
import ModernDoughnut from '@/components/charts/ModernDoughnut';
import CustomSelect from '@/components/CustomSelect';
import { contarColumna } from '@/lib/sheet-stats';

const MESES = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

const CHART_PALETTE = [
  '#315b7d', '#4f708c', '#4f8275', '#6d6f91', '#8a704b',
  '#607d8b', '#71849a', '#7b6e83', '#56786f', '#7f7568'
];


interface NuevaSeccionSheetsProps {
  analista: string;
  /** Si la vista que lo contiene esta inactiva (p. ej. sub-tab oculta con keep-alive),
   *  no se inician requests. Default true: consumidores existentes no cambian. */
  active?: boolean;
  reportAppearance?: boolean;
}

export default function NuevaSeccionSheets({ analista, active = true, reportAppearance = false }: NuevaSeccionSheetsProps) {
  const [dataSources, setDataSources] = useState<Record<string, string[][]>>({});
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const [viewMode, setViewMode] = useState<'mensual' | 'total'>('total');
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(new Date().getFullYear());

  const fetchData = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    fetch('/api/nueva-seccion?t=' + Date.now(), { cache: 'no-store' })
      .then(res => res.json())
      .then(res => {
        if (!mountedRef.current) return;
        if (res.success) {
          setDataSources(res.data);
        }
        setLoading(false);
      })
      .catch(() => {
        if (mountedRef.current) setLoading(false);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, []);

  // Unico punto de decision: solo refresca si la vista esta activa Y el documento visible.
  const refreshIfVisible = useCallback(() => {
    if (active && !document.hidden) fetchData();
  }, [active, fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    refreshIfVisible();
    intervalRef.current = setInterval(refreshIfVisible, 15_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [refreshIfVisible]);

  const data = useMemo(() => {
    const key = analista.toUpperCase();
    if (key === 'PDV' || key === 'GLOBAL') {
      const keys = Object.keys(dataSources);
      if (keys.length === 0) return [];
      
      const firstKey = keys[0];
      const headers = dataSources[firstKey][0];
      
      const combined = [headers];
      for (const k of keys) {
        combined.push(...dataSources[k].slice(1));
      }
      return combined;
    }
    
    const match = Object.keys(dataSources).find(k => k.includes(key) || key.includes(k));
    if (match) {
      return dataSources[match];
    }
    
    return [];
  }, [dataSources, analista]);

  const filteredData = useMemo(() => {
    if (!data || data.length <= 1) return data;
    if (viewMode === 'total') return data;

    const header = data[0];
    const rows = data.slice(1).filter(row => {
      const fecha = row[1];
      if (!fecha) return false;
      const parts = fecha.split('/');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        return m === selectedMes && y === selectedAnio;
      }
      return false;
    });
    return [header, ...rows];
  }, [data, viewMode, selectedMes, selectedAnio]);

  const stats = useMemo(
    () => (!filteredData || filteredData.length <= 1) ? [] : contarColumna(filteredData, 0),
    [filteredData]
  );

  const statsColF = useMemo(
    () => (!filteredData || filteredData.length <= 1) ? [] : contarColumna(filteredData, 5),
    [filteredData]
  );

  return (
    <div className="data-card analistas-categories-card" style={{
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      minHeight: reportAppearance ? 0 : 400,
      height: '100%',
      background: reportAppearance ? '#fff' : 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--surface-card)',
      boxShadow: reportAppearance ? 'none' : '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
      padding: reportAppearance ? 16 : 24,
      borderRadius: reportAppearance ? 12 : 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag size={15} color="#315b7d" />
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: reportAppearance ? '#263550' : '#fff', margin: 0, whiteSpace: 'normal', lineHeight: 1.2 }}>
            CATEGORÍAS
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {viewMode === 'mensual' && (
            <>
              <CustomSelect
                value={selectedMes}
                onChange={val => setSelectedMes(Number(val))}
                options={MESES.map(m => ({ label: m.label, value: m.value }))}
                width="130px"
              />
              <CustomSelect
                value={selectedAnio}
                onChange={val => setSelectedAnio(Number(val))}
                options={[2024, 2025, 2026, 2027].map(y => ({ label: String(y), value: y }))}
                width="100px"
              />
            </>
          )}

          <div className="report-period-toggle">
            {(['mensual', 'total'] as const).map(p => (
              <button
                key={p}
                onClick={() => setViewMode(p)}
                className={viewMode === p ? 'is-active' : undefined}
                style={reportAppearance ? { background: viewMode === p ? '#315b7d' : 'transparent', color: viewMode === p ? '#fff' : '#667085' } : {
                  padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px',
                  background: viewMode === p ? '#fb923c' : 'transparent',
                  color: viewMode === p ? '#000' : '#555', transition: 'all 0.2s ease',
                }}
              >
                {p === 'mensual' ? 'Mes' : 'Total'}
              </button>
            ))}
          </div>

          <span style={{ fontSize: 11, color: reportAppearance ? '#667085' : '#444', minWidth: 40, textAlign: 'right' }}>{filteredData ? Math.max(filteredData.length - 1, 0) : 0} ops</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', flex: 1, minHeight: 0 }}>
        {loading ? (
          <div style={{ height: '100%' }}>Cargando datos...</div>
        ) : (
          <>
            <DistBlockSheets reportAppearance={reportAppearance} titulo="TIPO DE CLIENTE" icon={<FileText size={12} color="#4f8275" />} datos={stats} color="#4f8275" />
            <DistBlockSheets reportAppearance={reportAppearance} titulo="POR DONDE NOS CONOCIO" icon={<Tag size={12} color="#4f708c" />} datos={statsColF} color="#4f708c" />
          </>
        )}
      </div>
    </div>
  );
}

function DistBlockSheets({ 
  titulo, icon, datos, color, reportAppearance = false
}: { 
  titulo: string; icon: React.ReactNode; 
  datos: { label: string; cantidad: number }[]; 
  color: string;
  reportAppearance?: boolean;
}) {
  const validData = datos.filter(d => {
    const l = d.label?.trim()?.toLowerCase();
    return l !== 'no especificado' && l !== 'sin dato' && l !== '';
  });
  
  const noEspData = datos.find(d => {
    const l = d.label?.trim()?.toLowerCase();
    return l === 'no especificado' || l === 'sin dato' || l === '';
  });

  const totalCant = validData.reduce((s, d) => s + d.cantidad, 0);

  return (
    <div className="category-sheet-block" style={{
      flex: 1, 
      minWidth: 240, 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: 0,
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {titulo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexShrink: 0 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>{titulo}</span>
        </div>
      )}
      <div className="category-sheet-panel" style={{
        ...(!reportAppearance ? { background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--surface-card)', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)', overflowX: 'hidden' as const, overflowY: 'hidden' as const } : {}),
        borderRadius: 10, 
        display: 'flex',
        flexDirection: 'column',
        flex: 1, 
        minHeight: 0,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div className="category-sheet-chart" style={{ ...(!reportAppearance ? { padding: '24px 0 8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' } : {}), flexShrink: 0 }}>
          <ModernDoughnut
            label="Total Ops"
            value={totalCant}
            tooltipLabel={(ctx) => ` ${ctx.raw} ops`}
            padding={reportAppearance ? 42 : 60}
            height={reportAppearance ? "180px" : "250px"}
            margin="0 auto 16px auto"
            data={{
              labels: validData.map(d => d.label?.trim()),
              datasets: [{
                data: validData.map(d => d.cantidad),
                backgroundColor: validData.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]),
                hoverOffset: 15,
                borderRadius: 6,
                spacing: 4
              }]
            }} 
          />
        </div>
        <div className="category-sheet-list" style={{ flex: 1, overflowX: 'hidden', overflowY: 'auto' }}>
          {validData.map((d, i) => {
            const pct = totalCant > 0 ? (d.cantidad / totalCant) * 100 : 0;
            const itemColor = CHART_PALETTE[i % CHART_PALETTE.length];
            return (
              <div key={i} className="category-sheet-row" style={reportAppearance ? undefined : { padding: '9px 14px', borderBottom: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: itemColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, ...(!reportAppearance ? { color: '#8f929d' } : {}), fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label?.trim()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span className="category-sheet-value" style={{ fontSize: 12, fontWeight: 700, ...(!reportAppearance ? { color: '#fff' } : {}), background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 4 }}>{d.cantidad}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: itemColor, minWidth: 34, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height: 2, background: reportAppearance ? '#e7edf2' : 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: itemColor, opacity: 0.8, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
        
        {noEspData && (
          <div className="category-sheet-footer" style={{ padding: '12px 14px', ...(!reportAppearance ? { background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.03)' } : {}) }}>
            <span style={{ fontSize: 10, ...(!reportAppearance ? { color: '#666' } : {}), fontStyle: 'italic' }}>* {noEspData.cantidad} sin especificar</span>
          </div>
        )}
      </div>
    </div>
  );
}
