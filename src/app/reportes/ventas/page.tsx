'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { formatCurrency, formatDate, displayAnalista } from '@/lib/utils';
import { CONFIG } from '@/types';
import { useData } from '@/context/DataContext';
import { Download, TrendingUp, Users, DollarSign, Hash } from 'lucide-react';
import { SeccionEstacionalidad } from '@/components/SeccionEstacionalidad';

export default function ReporteVentasPage() {
  const { registros: todosRegistros, loading } = useData();

  const registros = useMemo(() =>
    todosRegistros.filter(r =>
      r.estado?.toLowerCase() === 'venta' || r.estado?.toLowerCase().includes('aprobado cc')
    ), [todosRegistros]);

  const analistas = useMemo(() => {
    const set = new Set(registros.map(r => r.analista).filter(Boolean));
    return Array.from(set) as string[];
  }, [registros]);

  const [filtroAnalista, setFiltroAnalista] = useState('');
  const [filtroMes, setFiltroMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const mesesDisponibles = useMemo(() => {
    const now = new Date();
    const meses = [];
    for (let i = 0; i < 24; i++) {
      let m = now.getMonth() - i;
      let a = now.getFullYear();
      while (m < 0) { m += 12; a--; }
      const key = `${a}-${String(m + 1).padStart(2, '0')}`;
      meses.push({ key, label: `${CONFIG.MESES_NOMBRES[m]} ${a}` });
    }
    return meses;
  }, []);

  const filtered = useMemo(() => {
    return registros.filter(r => {
      if (filtroAnalista && r.analista !== filtroAnalista) return false;
      if (filtroMes && r.fecha) {
        if (r.fecha.slice(0, 7) !== filtroMes) return false;
      }
      return true;
    });
  }, [registros, filtroAnalista, filtroMes]);

  const totales = useMemo(() => ({
    operaciones: filtered.length,
    monto: filtered.reduce((s, r) => s + (Number(r.monto) || 0), 0),
    ticketProm: filtered.length > 0
      ? filtered.reduce((s, r) => s + (Number(r.monto) || 0), 0) / filtered.length
      : 0,
  }), [filtered]);

  const porAnalista = useMemo(() => {
    const map = new Map<string, { ops: number; monto: number }>();
    for (const r of filtered) {
      const a = r.analista || 'Sin asignar';
      if (!map.has(a)) map.set(a, { ops: 0, monto: 0 });
      const s = map.get(a)!;
      s.ops++;
      s.monto += Number(r.monto) || 0;
    }
    return Array.from(map.entries())
      .map(([nombre, s]) => ({ nombre, ...s }))
      .sort((a, b) => b.monto - a.monto);
  }, [filtered]);

  const exportarCSV = useCallback(() => {
    const headers = ['Nombre', 'CUIL', 'Analista', 'Estado', 'Monto', 'Fecha', 'Puntaje', 'Es RE', 'Comentarios'];
    const rows = filtered.map(r => [r.nombre, r.cuil, r.analista, r.estado, r.monto, r.fecha || '', r.puntaje || '', r.es_re ? 'Sí' : 'No', r.comentarios || '']);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ventas-${filtroMes}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [filtered, filtroMes]);

  const maxMonto = porAnalista[0]?.monto || 1;

  const sel: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)',
    borderRadius: '10px', color: '#fff', fontSize: '12px',
    padding: '8px 32px 8px 14px', outline: 'none',
    fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
    WebkitAppearance: 'none', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    colorScheme: 'dark', // Ensures native dropdown follows dark theme
  };

  return (
    <div className="dashboard-container">

      {/* ── Action Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          onClick={exportarCSV}
          disabled={filtered.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
            background: filtered.length > 0 ? '#fff' : 'rgba(255,255,255,0.02)',
            border: 'none', color: filtered.length > 0 ? '#000' : '#333',
            cursor: filtered.length > 0 ? 'pointer' : 'default',
            transition: 'all 0.2s ease'
          }}
        >
          <Download size={14} /> EXPORTAR
        </button>
      </div>

      {/* ── Filtros + KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '16px', marginBottom: '24px', alignItems: 'stretch' }}>

        {/* Filtros */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', color: '#333', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>CRITERIOS</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            
            {/* Custom Selective: Periodo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
              <label style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase' }}>Periodo</label>
              <CustomSelector 
                value={filtroMes} 
                options={mesesDisponibles.map(m => ({ value: m.key, label: m.label }))}
                onChange={setFiltroMes}
                width="160px"
              />
            </div>

            {/* Custom Selective: Analista */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase' }}>Analista</label>
              <CustomSelector 
                value={filtroAnalista} 
                options={[{ value: '', label: 'TODOS' }, ...analistas.map(a => ({ value: a, label: displayAnalista(a) }))]}
                onChange={setFiltroAnalista}
                width="160px"
              />
            </div>

          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { icon: <Hash size={14} />, label: 'OPERACIONES', value: totales.operaciones.toString(), sub: 'ventas cerradas' },
            { icon: <DollarSign size={14} />, label: 'TOTAL VENDIDO', value: formatCurrency(totales.monto), sub: 'monto acumulado' },
            { icon: <TrendingUp size={14} />, label: 'TICKET PROM.', value: totales.ticketProm > 0 ? formatCurrency(totales.ticketProm) : '—', sub: 'por operation' },
          ].map(k => (
            <div key={k.label} style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#333', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                {k.icon}{k.label}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: '10px', color: '#222', marginTop: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Estacionalidad ── */}
      <SeccionEstacionalidad filtroMes={filtroMes} filtroAnalista={filtroAnalista} />

      {/* ── Por Analista ── */}
      {porAnalista.length > 0 && (
        <div className="data-card" style={{ padding: '24px 32px', marginBottom: '24px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#333', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '24px' }}>
            <Users size={14} /> DESGLOSE POR ANALISTA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {porAnalista.map(a => (
              <div key={a.nombre}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#888' }}>{displayAnalista(a.nombre)}</span>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#333', fontWeight: 900 }}>{a.ops} OPS</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff' }}>{formatCurrency(a.monto)}</span>
                  </div>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.01)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(a.monto / maxMonto) * 100}%`, background: 'rgba(255,255,255,0.2)', borderRadius: '4px', transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabla detalle ── */}
      <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center', color: '#222', fontSize: '14px', fontWeight: 600 }}>
            No se encontraron registros financieros para este periodo
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Firma', 'CUIL', 'Gestión', 'Calificación', 'Inversión', 'Fecha', 'Score'].map(h => (
                    <th key={h} style={{ padding: '16px', textAlign: 'center', color: '#333', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.005)' }}>
                    <td style={{ padding: '14px 16px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>{r.nombre}</td>
                    <td style={{ padding: '14px 16px', color: '#444', fontFamily: 'monospace', fontSize: '11px', textAlign: 'center', letterSpacing: '0.5px' }}>{r.cuil}</td>
                    <td style={{ padding: '14px 16px', color: '#666', textAlign: 'center', fontWeight: 700, fontSize: '12px' }}>{displayAnalista(r.analista)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
                        background: r.estado?.toLowerCase().includes('venta') ? 'rgba(74,222,128,0.08)' : 'rgba(167,139,250,0.08)',
                        color: r.estado?.toLowerCase().includes('venta') ? '#4ade80cc' : '#a78bfacc',
                        border: '1px solid rgba(255,255,255,0.02)'
                      }}>
                        {r.estado}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#fff', fontWeight: 800, textAlign: 'center' }}>{formatCurrency(r.monto)}</td>
                    <td style={{ padding: '14px 16px', color: '#444', textAlign: 'center', fontSize: '13px' }}>{r.fecha ? formatDate(r.fecha) : '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#fff', textAlign: 'center', fontWeight: 800 }}>
                      {r.puntaje ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: 5, height: 5, borderRadius: '50%', 
                            background: r.puntaje >= 700 ? '#60a5facc' : r.puntaje >= 500 ? '#fbbf24cc' : '#ef4444cc',
                            boxShadow: `0 0 8px ${r.puntaje >= 700 ? '#60a5fa22' : r.puntaje >= 500 ? '#fbbf2422' : '#ef444422'}`
                          }} />
                          {r.puntaje}
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

function CustomSelector({ value, options, onChange, width }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; width: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;
    const handle = () => setIsOpen(false);
    window.addEventListener('click', handle);
    return () => window.removeEventListener('click', handle);
  }, [isOpen]);

  return (
    <div style={{ position: 'relative', width }} onClick={e => e.stopPropagation()}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px',
          padding: '8px 12px', color: '#fff', fontSize: '12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '34px'
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.label}</span>
        <div style={{ color: '#444', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '4px',
          background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
          zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
        }}>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {options.map(opt => (
              <div 
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                style={{
                  padding: '10px 12px', fontSize: '12px', color: value === opt.value ? '#fff' : '#666',
                  background: value === opt.value ? 'rgba(255,255,255,0.05)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.1s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseOut={e => e.currentTarget.style.background = value === opt.value ? 'rgba(255,255,255,0.05)' : 'transparent'}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
