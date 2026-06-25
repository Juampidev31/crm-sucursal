'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import { ArrowRight, Search, History } from 'lucide-react';

interface ReasignacionRow {
  id?: string;
  fecha_hora: string;
  nombre: string;
  cuil: string;
  valor_anterior: string; // analista origen
  valor_nuevo: string;    // analista destino
  id_analista: string;    // quién reasignó
}

const PAGE_SIZE = 50;

export default function ReasignadosTab() {
  const [rows, setRows] = useState<ReasignacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [page, setPage] = useState(1);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const acc: ReasignacionRow[] = [];
    const PAGE = 1000;
    let from = 0;
    // Paginar para superar el límite de 1000 filas de Supabase
    while (true) {
      const { data, error } = await supabase
        .from('auditoria')
        .select('id, fecha_hora, nombre, cuil, valor_anterior, valor_nuevo, id_analista')
        .eq('accion', 'Reasignación')
        .order('fecha_hora', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) { console.error('[Reasignados] Error:', error.message); break; }
      if (!data || data.length === 0) break;
      acc.push(...(data as ReasignacionRow[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setRows(acc);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const desde = fechaDesde ? new Date(fechaDesde + 'T00:00:00').getTime() : null;
    const hasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59').getTime() : null;
    return rows.filter(r => {
      const t = r.fecha_hora ? new Date(r.fecha_hora).getTime() : 0;
      if (desde !== null && t < desde) return false;
      if (hasta !== null && t > hasta) return false;
      if (q) {
        const hay = [r.nombre, r.cuil, r.valor_anterior, r.valor_nuevo, r.id_analista]
          .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
        if (!hay) return false;
      }
      return true;
    });
  }, [rows, search, fechaDesde, fechaHasta]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
    color: '#ccc', fontSize: '12px', padding: '8px 12px', outline: 'none', colorScheme: 'dark',
  };
  const thStyle: React.CSSProperties = {
    textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '12px 16px',
  };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: '12.5px', color: '#ccc', verticalAlign: 'middle' };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 4, height: 28, borderRadius: 2, background: '#34d399' }} />
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Reasignados</h1>
            <p style={{ fontSize: '12px', color: '#555', marginTop: 2 }}>Historial de registros reasignados entre analistas</p>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 700 }}>
          {filtered.length} reasignación(es)
        </div>
      </header>

      {/* FILTERS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar cliente, CUIL o analista..."
            style={{ ...inputStyle, width: '100%', padding: '8px 12px 8px 36px', background: 'rgba(255,255,255,0.02)', color: '#eaeaea' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }} title="Fecha desde" style={{ ...inputStyle, cursor: 'pointer' }} />
          <span style={{ color: '#555', fontSize: 12 }}>→</span>
          <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(1); }} title="Fecha hasta" style={{ ...inputStyle, cursor: 'pointer' }} />
          {(fechaDesde || fechaHasta) && (
            <button onClick={() => { setFechaDesde(''); setFechaHasta(''); setPage(1); }} title="Limpiar fechas" style={{ ...inputStyle, color: '#888', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-container" style={{ minHeight: 200 }}><div className="spinner" /><span>Cargando reasignaciones...</span></div>
        ) : !filtered.length ? (
          <div className="empty-state" style={{ minHeight: 200 }}>
            <History size={36} color="#333" style={{ marginBottom: 8 }} />
            <p style={{ fontWeight: 800, fontSize: '13px', color: '#444' }}>
              {search || fechaDesde || fechaHasta ? 'Sin resultados para los filtros aplicados' : 'No hay reasignaciones registradas'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ marginBottom: 0, minWidth: 760 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ ...thStyle, width: 170 }}>Fecha / Hora</th>
                    <th style={thStyle}>Cliente</th>
                    <th style={{ ...thStyle, width: 280 }}>De → A</th>
                    <th style={{ ...thStyle, width: 160 }}>Reasignado por</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r, i) => (
                    <tr key={r.id ?? `${r.fecha_hora}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ ...tdStyle, color: '#888', whiteSpace: 'nowrap' }}>{r.fecha_hora ? formatDateTime(r.fecha_hora) : '—'}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700, color: '#eaeaea' }}>{r.nombre || '—'}</div>
                        {r.cuil && <div style={{ fontSize: 11, color: '#666' }}>{r.cuil}</div>}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#888' }}>{r.valor_anterior || '—'}</span>
                          <ArrowRight size={13} color="#34d399" />
                          <span style={{ color: '#34d399', fontWeight: 700 }}>{r.valor_nuevo || '—'}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: '#aaa' }}>{r.id_analista || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} style={{ ...inputStyle, cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.4 : 1 }}>← Anterior</button>
                <span style={{ fontSize: 12, color: '#888', fontWeight: 700 }}>Página {safePage} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{ ...inputStyle, cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? 0.4 : 1 }}>Siguiente →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
