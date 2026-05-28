'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { displayAnalista, formatCurrency, formatDate } from '@/lib/utils';
import { CONFIG } from '@/types';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { Download, TrendingUp, Users, DollarSign, Hash } from 'lucide-react';
import { SeccionEstacionalidad } from '@/components/SeccionEstacionalidad';
import { SeccionComparativaAnalistas } from '@/components/SeccionComparativaAnalistas';
import { corregirTildes } from '@/lib/correccion-tildes';
import SelectReporte from '@/components/SelectReporte';

export default function ReporteVentasPage() {
  const { registros: todosRegistros, loading } = useRegistros();

  const registros = useMemo(() =>
    todosRegistros.filter(r =>
      r.estado?.toLowerCase() === 'venta' || r.estado?.toLowerCase().includes('aprobado cc')
    ), [todosRegistros]);

  const analistas = CONFIG.ANALISTAS_DEFAULT;

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
    const rows = filtered.map(r => [
      corregirTildes(r.nombre),
      r.cuil,
      corregirTildes(r.analista),
      r.estado,
      r.monto,
      r.fecha || '',
      r.puntaje || '',
      r.es_re ? 'Sí' : 'No',
      corregirTildes(r.comentarios || '')
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ventas-${filtroMes}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [filtered, filtroMes]);

  const maxMonto = porAnalista[0]?.monto || 1;

  return (
    <div className="dashboard-container">

      {/* ── Action Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          onClick={exportarCSV}
          disabled={filtered.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 800,
            background: filtered.length > 0 ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.02)',
            border: 'none', color: filtered.length > 0 ? '#050505' : '#9a9aa3',
            cursor: filtered.length > 0 ? 'pointer' : 'default',
            boxShadow: filtered.length > 0 ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={(e) => {
            if (filtered.length > 0) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.25)';
            }
          }}
          onMouseLeave={(e) => {
            if (filtered.length > 0) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)';
            }
          }}
        >
          <Download size={14} /> EXPORTAR
        </button>
      </div>

      {/* ── Filtros + KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '16px', marginBottom: '24px', alignItems: 'stretch' }}>

        {/* Filtros */}
        <div style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', color: '#9a9aa3', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>CRITERIOS</div>
          <div style={{ display: 'flex', gap: '12px' }}>

            {/* Período */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
              <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Período</label>
              <SelectReporte
                icon="calendar"
                value={filtroMes}
                options={mesesDisponibles.map(m => ({ value: m.key, label: m.label }))}
                onChange={(v) => setFiltroMes(String(v))}
                width="180px"
              />
            </div>

            {/* Analista */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Analista</label>
              <SelectReporte
                icon="user"
                value={filtroAnalista}
                options={[{ value: '', label: 'VISTA GLOBAL' }, ...analistas.map(a => ({ value: a, label: displayAnalista(a) }))]}
                onChange={(v) => setFiltroAnalista(String(v))}
                width="180px"
              />
            </div>

          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { icon: <Hash size={14} />, label: 'OPERACIONES', value: totales.operaciones.toString(), sub: 'ventas cerradas' },
            { icon: <DollarSign size={14} />, label: 'TOTAL VENDIDO', value: formatCurrency(totales.monto), sub: 'monto acumulado' },
            { icon: <TrendingUp size={14} />, label: 'TICKET PROM.', value: totales.ticketProm > 0 ? formatCurrency(totales.ticketProm) : '—', sub: 'por operación' },
          ].map(k => (
            <div key={k.label} style={{
              background: '#0c0c0c',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9a9aa3', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                {k.icon}{k.label}
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 900,
                color: k.label === 'TOTAL VENDIDO' ? '#10b981' : '#fff',
                lineHeight: 1
              }}>{k.value}</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Estacionalidad ── */}
      <SeccionEstacionalidad filtroMes={filtroMes} filtroAnalista={filtroAnalista} />

      {/* ── Comparativa Luciana vs Victoria ── */}
      <SeccionComparativaAnalistas filtroMes={filtroMes} />

      {/* ── Por Analista ── */}
      {porAnalista.length > 0 && (
        <div style={{
          padding: '24px 32px',
          marginBottom: '24px',
          background: '#0c0c0c',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a9aa3', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '24px' }}>
            <Users size={14} /> DESGLOSE POR ANALISTA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {porAnalista.map(a => (
              <div key={a.nombre}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#eaeaea' }}>{displayAnalista(a.nombre)}</span>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#9a9aa3', fontWeight: 800 }}>{a.ops} OPS</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#10b981' }}>{formatCurrency(a.monto)}</span>
                  </div>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(a.monto / maxMonto) * 100}%`,
                    background: 'linear-gradient(90deg, #10b981, #34d399)',
                    borderRadius: '4px',
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabla detalle ── */}
      <div style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
            No se encontraron registros financieros para este período
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.005)' }}>
                  {['Firma', 'CUIL', 'Gestión', 'Calificación', 'Inversión', 'Fecha', 'Score'].map(h => (
                    <th key={h} style={{ padding: '16px', textAlign: 'center', color: '#9a9aa3', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="hover-row"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'all 0.1s ease',
                      cursor: 'default',
                    }}
                  >
                    <td style={{ padding: '14px 16px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>{corregirTildes(r.nombre)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span className="cuil-text" style={{ color: '#9a9aa3', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.5px', opacity: 0.7 }}>
                        {r.cuil}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#eaeaea', textAlign: 'center', fontWeight: 600, fontSize: '13px' }}>{displayAnalista(corregirTildes(r.analista))}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
                        background: r.estado?.toLowerCase().includes('venta') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(96, 165, 250, 0.15)',
                        color: r.estado?.toLowerCase().includes('venta') ? '#10b981' : '#60a5fa',
                        border: '1px solid rgba(255,255,255,0.02)'
                      }}>
                        {r.estado}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#10b981', fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.monto ?? 0)}</td>
                    <td style={{ padding: '14px 16px', color: '#9a9aa3', textAlign: 'center', fontSize: '13px', fontWeight: 500 }}>{r.fecha ? formatDate(r.fecha) : '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#fff', textAlign: 'center', fontWeight: 600 }}>
                      {r.puntaje ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: r.puntaje >= 700 ? '#10b981' : r.puntaje >= 600 ? '#60a5fa' : r.puntaje >= 500 ? '#fbbf24' : '#ef4444',
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
