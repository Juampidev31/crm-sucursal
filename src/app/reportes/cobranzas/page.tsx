'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, displayAnalista } from '@/lib/utils';
import { Registro } from '@/types';
import { DollarSign, Download, AlertCircle, Clock } from 'lucide-react';

// Estados considerados "en cobranza" (pendientes de cobro)
const ESTADOS_COBRANZA = ['en seguimiento', 'score bajo', 'afectaciones', 'derivado / aprobado cc', 'derivado / rechazado cc', 'proyeccion'];

export default function ReporteCobranzasPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [analistas, setAnalistas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAnalista, setFiltroAnalista] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 50;

  useEffect(() => {
    supabase
      .from('registros')
      .select('*')
      .in('estado', ESTADOS_COBRANZA)
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        const regs = data || [];
        setRegistros(regs);
        const set = new Set(regs.map((r: Registro) => r.analista).filter(Boolean));
        setAnalistas(Array.from(set) as string[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    setPagina(1);
    return registros.filter(r => {
      if (filtroAnalista && r.analista !== filtroAnalista) return false;
      if (filtroEstado && r.estado !== filtroEstado) return false;
      return true;
    });
  }, [registros, filtroAnalista, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filteredPagina = filtered.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const totales = useMemo(() => ({
    count: filtered.length,
    monto: filtered.reduce((s, r) => s + (Number(r.monto) || 0), 0),
    vencidos: filtered.filter(r => {
      if (!r.fecha) return false;
      return new Date(r.fecha) < new Date();
    }).length,
  }), [filtered]);

  const porEstado = useMemo(() => {
    const map = new Map<string, { count: number; monto: number }>();
    for (const r of filtered) {
      const e = r.estado || 'sin estado';
      if (!map.has(e)) map.set(e, { count: 0, monto: 0 });
      const s = map.get(e)!;
      s.count++;
      s.monto += Number(r.monto) || 0;
    }
    return Array.from(map.entries()).map(([estado, s]) => ({ estado, ...s })).sort((a, b) => b.monto - a.monto);
  }, [filtered]);

  const exportarCSV = useCallback(() => {
    const headers = ['Nombre', 'CUIL', 'Analista', 'Estado', 'Monto', 'Fecha', 'Comentarios'];
    const rows = filtered.map(r => [r.nombre, r.cuil, r.analista, r.estado, r.monto, r.fecha || '', r.comentarios || '']);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cobranzas.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const inputStyle: React.CSSProperties = {
    background: '#111', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', color: '#fff', fontSize: '13px', padding: '8px 12px',
    outline: 'none', fontFamily: "'Outfit', sans-serif",
  };

  const estadoColor: Record<string, string> = {
    'en seguimiento': '#fbbf24',
    'score bajo': '#f87171',
    'afectaciones': '#c084fc',
    'derivado / aprobado cc': '#34d399',
    'derivado / rechazado cc': '#f97316',
    'proyeccion': '#60a5fa',
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Reporte de Cobranzas</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>{loading ? 'Cargando...' : `${filtered.length} registros pendientes`}</p>
        </div>
        <button onClick={exportarCSV} disabled={filtered.length === 0} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          background: filtered.length > 0 ? '#f7e479' : 'rgba(255,255,255,0.04)',
          border: 'none', color: filtered.length > 0 ? '#000' : '#444', cursor: filtered.length > 0 ? 'pointer' : 'default',
        }}>
          <Download size={14} /> Exportar CSV
        </button>
      </header>

      {/* Filtros */}
      <div className="data-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Analista</label>
            <select style={inputStyle} value={filtroAnalista} onChange={e => setFiltroAnalista(e.target.value)}>
              <option value="">Todos</option>
              {analistas.map(a => <option key={a} value={a}>{displayAnalista(a)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Estado</label>
            <select style={inputStyle} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS_COBRANZA.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-title"><span><DollarSign size={14} style={{ display: 'inline', marginRight: 6 }} />Total en cartera</span></div>
          <div className="kpi-val">{formatCurrency(totales.monto)}</div>
          <div className="kpi-sub">{totales.count} registros</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title"><span><AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />Con fecha vencida</span></div>
          <div className="kpi-val" style={{ color: totales.vencidos > 0 ? '#f87171' : '#fff' }}>{totales.vencidos}</div>
          <div className="kpi-sub">requieren atención</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title"><span><Clock size={14} style={{ display: 'inline', marginRight: 6 }} />Sin fecha</span></div>
          <div className="kpi-val">{filtered.filter(r => !r.fecha).length}</div>
          <div className="kpi-sub">sin fecha asignada</div>
        </div>
      </div>

      {/* Resumen por estado */}
      {porEstado.length > 0 && (
        <div className="data-card" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Por Estado</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {porEstado.map(e => (
              <div key={e.estado} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px 16px', minWidth: '140px' }}>
                <div style={{ fontWeight: 600, color: estadoColor[e.estado] || '#aaa', fontSize: '12px', marginBottom: '4px' }}>{e.estado}</div>
                <div style={{ color: '#fff', fontSize: '16px', fontWeight: 800 }}>{formatCurrency(e.monto)}</div>
                <div style={{ color: '#555', fontSize: '12px' }}>{e.count} regs.</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="data-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>Sin registros pendientes</p>
            <p>Todos los registros están al día.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Nombre', 'CUIL', 'Analista', 'Estado', 'Monto', 'Fecha', 'Comentarios'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPagina.map((r, i) => {
                  const isVencido = r.fecha && new Date(r.fecha) < new Date();
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isVencido ? 'rgba(248,113,113,0.04)' : (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)') }}>
                      <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 500 }}>{r.nombre}</td>
                      <td style={{ padding: '10px 14px', color: '#666', fontFamily: 'monospace', fontSize: '12px' }}>{r.cuil}</td>
                      <td style={{ padding: '10px 14px', color: '#888' }}>{displayAnalista(r.analista)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: `${estadoColor[r.estado] || '#aaa'}20`, color: estadoColor[r.estado] || '#aaa' }}>
                          {r.estado}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#f7e479', fontWeight: 600 }}>{formatCurrency(r.monto)}</td>
                      <td style={{ padding: '10px 14px', color: isVencido ? '#f87171' : '#888' }}>
                        {r.fecha ? formatDate(r.fecha) : '—'}
                        {isVencido && <span style={{ marginLeft: 6, fontSize: '10px', color: '#f87171' }}>VENCIDA</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#555', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.comentarios || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > POR_PAGINA && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '12px', color: '#444' }}>
              {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtered.length)} de {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1}
                style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: paginaActual === 1 ? '#333' : '#aaa', cursor: paginaActual === 1 ? 'default' : 'pointer', fontSize: '13px' }}>
                ‹
              </button>
              <span style={{ padding: '5px 10px', fontSize: '12px', color: '#666' }}>{paginaActual} / {totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas}
                style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: paginaActual === totalPaginas ? '#333' : '#aaa', cursor: paginaActual === totalPaginas ? 'default' : 'pointer', fontSize: '13px' }}>
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
