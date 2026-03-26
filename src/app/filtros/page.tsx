'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, displayAnalista } from '@/lib/utils';
import { Registro } from '@/types';
import { Filter, Download, X } from 'lucide-react';

const ESTADOS = ['proyeccion', 'venta', 'en seguimiento', 'score bajo', 'afectaciones', 'derivado / aprobado cc', 'derivado / rechazado cc'];

export default function FiltrosPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [analistas, setAnalistas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroAnalista, setFiltroAnalista] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroCuil, setFiltroCuil] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroMontoMin, setFiltroMontoMin] = useState('');
  const [filtroMontoMax, setFiltroMontoMax] = useState('');
  const [filtroEsRe, setFiltroEsRe] = useState('');

  useEffect(() => {
    supabase.from('registros').select('*').order('created_at', { ascending: false }).then(({ data }) => {
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
      if (filtroEstado && r.estado !== filtroEstado) return false;
      if (filtroNombre && !r.nombre?.toLowerCase().includes(filtroNombre.toLowerCase())) return false;
      if (filtroCuil && !r.cuil?.includes(filtroCuil)) return false;
      if (filtroEsRe === 'si' && !r.es_re) return false;
      if (filtroEsRe === 'no' && r.es_re) return false;
      if (filtroFechaDesde && r.fecha && r.fecha < filtroFechaDesde) return false;
      if (filtroFechaHasta && r.fecha && r.fecha > filtroFechaHasta) return false;
      if (filtroMontoMin && Number(r.monto) < Number(filtroMontoMin)) return false;
      if (filtroMontoMax && Number(r.monto) > Number(filtroMontoMax)) return false;
      return true;
    });
  }, [registros, filtroAnalista, filtroEstado, filtroNombre, filtroCuil, filtroEsRe, filtroFechaDesde, filtroFechaHasta, filtroMontoMin, filtroMontoMax]);

  const limpiarFiltros = useCallback(() => {
    setFiltroAnalista('');
    setFiltroEstado('');
    setFiltroNombre('');
    setFiltroCuil('');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setFiltroMontoMin('');
    setFiltroMontoMax('');
    setFiltroEsRe('');
  }, []);

  const exportarCSV = useCallback(() => {
    const headers = ['Nombre', 'CUIL', 'Analista', 'Estado', 'Monto', 'Fecha', 'Puntaje', 'Es RE'];
    const rows = filtered.map(r => [
      r.nombre, r.cuil, r.analista, r.estado,
      r.monto, r.fecha || '', r.puntaje || '', r.es_re ? 'Sí' : 'No',
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'filtros-export.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const hayFiltros = filtroAnalista || filtroEstado || filtroNombre || filtroCuil || filtroFechaDesde || filtroFechaHasta || filtroMontoMin || filtroMontoMax || filtroEsRe;

  const inputStyle: React.CSSProperties = {
    background: '#111', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', color: '#fff', fontSize: '13px', padding: '8px 12px',
    outline: 'none', width: '100%', fontFamily: "'Outfit', sans-serif",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px', color: '#555', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block',
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Filtros Avanzados</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>
            {loading ? 'Cargando...' : `${filtered.length} de ${registros.length} registros`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {hayFiltros && (
            <button onClick={limpiarFiltros} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer',
            }}>
              <X size={14} /> Limpiar
            </button>
          )}
          <button onClick={exportarCSV} disabled={filtered.length === 0} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            background: filtered.length > 0 ? '#f7e479' : 'rgba(255,255,255,0.04)',
            border: 'none', color: filtered.length > 0 ? '#000' : '#444', cursor: filtered.length > 0 ? 'pointer' : 'default',
          }}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </header>

      {/* Panel de filtros */}
      <div className="data-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Filter size={16} color="#888" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#888' }}>FILTROS</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%', flexWrap: 'nowrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Nombre</label>
            <input style={inputStyle} placeholder="Nombre..." value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>CUIL</label>
            <input style={inputStyle} placeholder="CUIL..." value={filtroCuil} onChange={e => setFiltroCuil(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Analista</label>
            <select style={inputStyle} value={filtroAnalista} onChange={e => setFiltroAnalista(e.target.value)}>
              <option value="">Todos</option>
              {analistas.map(a => <option key={a} value={a}>{displayAnalista(a)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Estado</label>
            <select style={inputStyle} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Desde</label>
            <input type="date" style={{ ...inputStyle, padding: '6px 8px' }} value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Hasta</label>
            <input type="date" style={{ ...inputStyle, padding: '6px 8px' }} value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Min ($)</label>
            <input type="number" style={inputStyle} placeholder="0" value={filtroMontoMin} onChange={e => setFiltroMontoMin(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Max ($)</label>
            <input type="number" style={inputStyle} placeholder="∞" value={filtroMontoMax} onChange={e => setFiltroMontoMax(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Es RE</label>
            <select style={inputStyle} value={filtroEsRe} onChange={e => setFiltroEsRe(e.target.value)}>
              <option value="">Todos</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resultados */}
      <div className="data-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>Sin resultados</p>
            <p>Ajustá los filtros para ver registros.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Nombre', 'CUIL', 'Analista', 'Estado', 'Monto', 'Fecha', 'Puntaje', 'RE'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'center', color: '#666', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 500, textAlign: 'center' }}>{r.nombre}</td>
                    <td style={{ padding: '10px 14px', color: '#666', fontFamily: 'monospace', fontSize: '12px', textAlign: 'center' }}>{r.cuil}</td>
                    <td style={{ padding: '10px 14px', color: '#888', textAlign: 'center' }}>{displayAnalista(r.analista)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: r.estado === 'venta' || r.estado?.includes('aprobado') ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
                        color: r.estado === 'venta' || r.estado?.includes('aprobado') ? '#4ade80' : '#aaa',
                      }}>
                        {r.estado}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.monto)}</td>
                    <td style={{ padding: '10px 14px', color: '#888', textAlign: 'center' }}>{r.fecha ? formatDate(r.fecha) : '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#e0e0e0', textAlign: 'center' }}>
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
                    <td style={{ padding: '10px 14px', color: r.es_re ? '#60a5fa' : '#444', textAlign: 'center' }}>{r.es_re ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <p style={{ padding: '12px 14px', color: '#555', fontSize: '12px' }}>
                Mostrando 500 de {filtered.length} resultados. Refiná los filtros para ver más.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
