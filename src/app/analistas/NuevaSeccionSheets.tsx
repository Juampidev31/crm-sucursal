'use client';
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { FileText, ChevronDown, Tag } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  Tooltip, Legend, ArcElement,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { calloutPlugin, bgTrackPlugin, glowPlugin } from '@/lib/chartPlugins';

ChartJS.register(CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

const hexToRgba = (hex: string, alpha: number) => {
  if (hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ModernDoughnut = ({ data, totalOps, label }: { data: any, totalOps: number, label: string }) => {
  const options = {
    layout: { padding: 30 },
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
          label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} ops`
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
    <div style={{ position: 'relative', height: '180px', width: '180px', margin: '0 auto 16px auto' }}>
      <Doughnut data={data} options={options} plugins={[calloutPlugin, bgTrackPlugin, glowPlugin]} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', textAlign: 'center',
        width: '100%', pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '10px', color: '#555', fontWeight: 800, letterSpacing: '1px', marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
          {totalOps}
        </div>
      </div>
    </div>
  );
};

export default function NuevaSeccionSheets({ analista }: { analista: string }) {
  const [dataSources, setDataSources] = useState<Record<string, string[][]>>({});
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [viewMode, setViewMode] = useState<'mensual' | 'total'>('total');
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(new Date().getFullYear());

  const fetchData = useCallback(() => {
    fetch('/api/nueva-seccion?t=' + Date.now(), { cache: 'no-store' })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setDataSources(res.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

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

  const stats = useMemo(() => {
    if (!filteredData || filteredData.length <= 1) return [];

    const counts: Record<string, number> = {};
    for (let i = 1; i < filteredData.length; i++) {
      const val = filteredData[i][0]?.trim() || 'No especificado';
      counts[val] = (counts[val] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([label, cantidad]) => ({ label, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [filteredData]);

  const statsColF = useMemo(() => {
    if (!filteredData || filteredData.length <= 1) return [];

    const counts: Record<string, number> = {};
    for (let i = 1; i < filteredData.length; i++) {
      const val = filteredData[i][5]?.trim() || 'No especificado';
      counts[val] = (counts[val] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([label, cantidad]) => ({ label, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [filteredData]);

  if (!loading && (!data || data.length === 0)) {
    return null;
  }

  const MESES = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  return (
    <div className="data-card relative z-10 w-full" style={{
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 400,
      height: '100%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)',
      boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
      padding: 24,
      borderRadius: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag size={15} color="#34d399" />
          <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#fff', margin: 0, whiteSpace: 'normal', lineHeight: 1.2 }}>
            CATEGORÍAS
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {viewMode === 'mensual' && (
            <>
              <select 
                value={selectedMes} 
                onChange={e => setSelectedMes(Number(e.target.value))}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, outline: 'none', cursor: 'pointer' }}
              >
                {MESES.map(m => <option key={m.value} value={m.value} style={{ background: '#111' }}>{m.label}</option>)}
              </select>
              <select 
                value={selectedAnio} 
                onChange={e => setSelectedAnio(Number(e.target.value))}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, outline: 'none', cursor: 'pointer' }}
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} style={{ background: '#111' }}>{y}</option>)}
              </select>
            </>
          )}

          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 3 }}>
            {(['mensual', 'total'] as const).map(p => (
              <button
                key={p}
                onClick={() => setViewMode(p)}
                style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                  background: viewMode === p ? '#fb923c' : 'transparent',
                  color: viewMode === p ? '#000' : '#555',
                  transition: 'all 0.2s ease',
                }}
              >
                {p === 'mensual' ? 'Mes' : 'Total'}
              </button>
            ))}
          </div>

          <span style={{ fontSize: 11, color: '#444', minWidth: 40, textAlign: 'right' }}>{filteredData ? filteredData.length - 1 : 0} ops</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', flex: 1, minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center w-full text-zinc-500 text-sm" style={{ height: '100%' }}>Cargando datos...</div>
        ) : (
          <>
            <DistBlockSheets titulo={data?.[0]?.[0] || 'TIPO DE CLIENTE'} icon={<FileText size={12} color="#34d399" />} datos={stats} color="#34d399" />
            <DistBlockSheets titulo={data?.[0]?.[5] || 'MEDIO DE CONTACTO'} icon={<Tag size={12} color="#60a5fa" />} datos={statsColF} color="#60a5fa" />
          </>
        )}
      </div>
    </div>
  );
}

function DistBlockSheets({ 
  titulo, icon, datos, color
}: { 
  titulo: string; icon: React.ReactNode; 
  datos: { label: string; cantidad: number }[]; 
  color: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const validData = datos.filter(d => {
    const l = d.label?.trim()?.toLowerCase();
    return l !== 'no especificado' && l !== 'sin dato' && l !== '';
  });
  
  const noEspData = datos.find(d => {
    const l = d.label?.trim()?.toLowerCase();
    return l === 'no especificado' || l === 'sin dato' || l === '';
  });

  const totalCant = validData.reduce((s, d) => s + d.cantidad, 0);
  const displayData = validData;

  return (
    <div style={{ 
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
          <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>{titulo}</span>
        </div>
      )}
      <div style={{ 
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%), var(--bg-elev-1)', 
        borderRadius: 10, 
        border: '1px solid rgba(255,255,255,0.04)', 
        boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        overflowX: 'hidden', 
        overflowY: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: 1, 
        minHeight: 0,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{ padding: '24px 0 8px 0', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <ModernDoughnut 
            label="Total Ops" 
            totalOps={totalCant} 
            data={{
              labels: validData.map(d => d.label?.trim()),
              datasets: [{
                data: validData.map(d => d.cantidad),
                backgroundColor: validData.map((_, i) => {
                  const alpha = Math.max(0.15, 1 - (i * (0.85 / Math.max(1, validData.length - 1))));
                  return hexToRgba(color, alpha);
                }),
                hoverOffset: 15,
                borderRadius: 6,
                spacing: 4
              }]
            }} 
          />
        </div>
        <div style={{ flex: 1, overflowX: 'hidden', overflowY: 'auto' }}>
          {displayData.map((d, i) => {
            const pct = totalCant > 0 ? (d.cantidad / totalCant) * 100 : 0;
            return (
              <div key={i} style={{ padding: '9px 14px', borderBottom: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#8f929d', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label?.trim()}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 4 }}>{d.cantidad}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, opacity: 0.6, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
        
        {noEspData && (
          <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            <span style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>* {noEspData.cantidad} sin especificar</span>
          </div>
        )}
      </div>
    </div>
  );
}
