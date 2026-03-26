'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, displayAnalista } from '@/lib/utils';
import { Registro, CONFIG } from '@/types';
import { Download, TrendingUp, Users, DollarSign, Hash } from 'lucide-react';

export default function ReporteVentasPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [analistas, setAnalistas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    supabase
      .from('registros')
      .select('*')
      .or("estado.eq.venta,estado.ilike.%aprobado cc%")
      .order('fecha', { ascending: false })
      .then(({ data }) => {
        const regs = data || [];
        setRegistros(regs);
        const set = new Set(regs.map((r: Registro) => r.analista).filter(Boolean));
        setAnalistas(Array.from(set) as string[]);
        setLoading(false);
      });
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
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', color: '#fff', fontSize: '13px',
    padding: '8px 32px 8px 12px', outline: 'none',
    fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
    WebkitAppearance: 'none', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  };

  return (
    <div className="dashboard-container">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Reporte de Ventas</h1>
          <p style={{ color: '#444', fontSize: '13px', marginTop: '2px' }}>
            {loading ? 'Cargando...' : `${totales.operaciones} operaciones · ${formatCurrency(totales.monto)}`}
          </p>
        </div>
        <button
          onClick={exportarCSV}
          disabled={filtered.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            background: filtered.length > 0 ? '#f7e479' : 'rgba(255,255,255,0.04)',
            border: 'none', color: filtered.length > 0 ? '#000' : '#444',
            cursor: filtered.length > 0 ? 'pointer' : 'default',
          }}
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* ── Filtros + KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', marginBottom: '16px', alignItems: 'stretch' }}>

        {/* Filtros */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
          <div style={{ fontSize: '10px', color: '#333', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>FILTROS</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '10px', color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mes</label>
              <select style={sel} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                {mesesDisponibles.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '10px', color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Analista</label>
              <select style={sel} value={filtroAnalista} onChange={e => setFiltroAnalista(e.target.value)}>
                <option value="">Todos</option>
                {analistas.map(a => <option key={a} value={a}>{displayAnalista(a)}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 240px))', gap: '12px', justifyContent: 'center' }}>
          {[
            { icon: <Hash size={14} />, label: 'OPERACIONES', value: totales.operaciones.toString(), sub: 'ventas cerradas' },
            { icon: <DollarSign size={14} />, label: 'TOTAL VENDIDO', value: formatCurrency(totales.monto), sub: 'monto acumulado' },
            { icon: <TrendingUp size={14} />, label: 'TICKET PROMEDIO', value: totales.ticketProm > 0 ? formatCurrency(totales.ticketProm) : '—', sub: 'por operation' },
          ].map(k => (
            <div key={k.label} style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#444', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                {k.icon}{k.label}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: '11px', color: '#333', marginTop: '6px' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Por Analista ── */}
      {porAnalista.length > 0 && (
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#444', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
            <Users size={12} /> DESGLOSE POR ANALISTA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {porAnalista.map(a => (
              <div key={a.nombre}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#ccc' }}>{displayAnalista(a.nombre)}</span>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#444' }}>{a.ops} ops</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80' }}>{formatCurrency(a.monto)}</span>
                  </div>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(a.monto / maxMonto) * 100}%`, background: 'rgba(74,222,128,0.5)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabla detalle ── */}
      <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#333', fontSize: '14px' }}>
            Sin ventas para este período
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Nombre', 'CUIL', 'Analista', 'Estado', 'Monto', 'Fecha', 'Puntaje'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'center', color: '#333', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 16px', color: '#e0e0e0', fontWeight: 500, textAlign: 'center' }}>{r.nombre}</td>
                    <td style={{ padding: '10px 16px', color: '#444', fontFamily: 'monospace', fontSize: '12px', textAlign: 'center' }}>{r.cuil}</td>
                    <td style={{ padding: '10px 16px', color: '#888', textAlign: 'center' }}>{displayAnalista(r.analista)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: r.estado?.toLowerCase().includes('aprobado') ? 'rgba(147,112,219,0.15)' : 'rgba(74,222,128,0.1)',
                        color: r.estado?.toLowerCase().includes('aprobado') ? '#9b72db' : '#4ade80',
                      }}>
                        {r.estado}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.monto)}</td>
                    <td style={{ padding: '10px 16px', color: '#555', textAlign: 'center' }}>{r.fecha ? formatDate(r.fecha) : '—'}</td>
                    <td style={{ padding: '10px 16px', color: '#e0e0e0', textAlign: 'center' }}>
                      {r.puntaje ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <div style={{ 
                            width: 6, height: 6, borderRadius: '50%', 
                            background: r.puntaje >= 700 ? '#3b82f6' : r.puntaje >= 600 ? '#4ade80' : r.puntaje >= 500 ? '#fbbf24' : '#ef4444' 
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
