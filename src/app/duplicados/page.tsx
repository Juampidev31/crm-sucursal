'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, displayAnalista } from '@/lib/utils';
import { Registro } from '@/types';
import { Copy, AlertTriangle, CheckCircle } from 'lucide-react';

interface GrupoDuplicado {
  key: string;
  tipo: 'cuil' | 'nombre';
  registros: Registro[];
}

export default function DuplicadosPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [tipoBusqueda, setTipoBusqueda] = useState<'cuil' | 'nombre' | 'ambos'>('ambos');

  useEffect(() => {
    supabase
      .from('registros')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRegistros(data || []);
        setLoading(false);
      });
  }, []);

  const duplicados = useMemo((): GrupoDuplicado[] => {
    const grupos: GrupoDuplicado[] = [];

    if (tipoBusqueda === 'cuil' || tipoBusqueda === 'ambos') {
      const byCuil = new Map<string, Registro[]>();
      for (const r of registros) {
        const cuil = r.cuil?.trim();
        if (!cuil || cuil.length < 11) continue;
        if (!byCuil.has(cuil)) byCuil.set(cuil, []);
        byCuil.get(cuil)!.push(r);
      }
      for (const [cuil, regs] of byCuil) {
        if (regs.length > 1) {
          if (!busqueda || cuil.includes(busqueda)) {
            grupos.push({ key: cuil, tipo: 'cuil', registros: regs });
          }
        }
      }
    }

    if (tipoBusqueda === 'nombre' || tipoBusqueda === 'ambos') {
      const byNombre = new Map<string, Registro[]>();
      for (const r of registros) {
        const nombre = r.nombre?.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');
        if (!nombre || nombre.length < 3) continue;
        if (!byNombre.has(nombre)) byNombre.set(nombre, []);
        byNombre.get(nombre)!.push(r);
      }
      for (const [nombre, regs] of byNombre) {
        if (regs.length > 1) {
          const existsInCuil = grupos.some(g => g.tipo === 'cuil' && g.registros.some(r => r.nombre?.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ') === nombre));
          if (!existsInCuil) {
            if (!busqueda || nombre.includes(busqueda.toLowerCase())) {
              grupos.push({ key: nombre, tipo: 'nombre', registros: regs });
            }
          }
        }
      }
    }

    return grupos.sort((a, b) => b.registros.length - a.registros.length);
  }, [registros, tipoBusqueda, busqueda]);

  const totalDuplicados = duplicados.reduce((s, g) => s + g.registros.length, 0);

  const inputStyle: React.CSSProperties = {
    background: '#111', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', color: '#fff', fontSize: '13px', padding: '8px 12px',
    outline: 'none', fontFamily: "'Outfit', sans-serif",
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Detectar Duplicados</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>
            {loading ? 'Analizando...' : `${duplicados.length} grupos duplicados — ${totalDuplicados} registros afectados`}
          </p>
        </div>
      </header>

      {/* Filtros */}
      <div className="data-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Buscar</label>
            <input style={{ ...inputStyle, width: '100%' }} placeholder="CUIL o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Detectar por</label>
            <select style={inputStyle} value={tipoBusqueda} onChange={e => setTipoBusqueda(e.target.value as typeof tipoBusqueda)}>
              <option value="ambos">CUIL y Nombre</option>
              <option value="cuil">Solo CUIL</option>
              <option value="nombre">Solo Nombre</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : duplicados.length === 0 ? (
        <div className="data-card">
          <div className="empty-state">
            <CheckCircle size={48} color="#4ade80" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: '#4ade80' }}>Sin duplicados detectados</p>
            <p>No se encontraron registros duplicados con los criterios seleccionados.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {duplicados.map(grupo => (
            <div key={grupo.key} className="data-card">
              {/* Header del grupo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(248,113,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={16} color="#f87171" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px' }}>
                    {grupo.tipo === 'cuil' ? `CUIL: ${grupo.key}` : `Nombre: ${grupo.registros[0].nombre}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#f87171' }}>
                    {grupo.registros.length} registros duplicados
                    <span style={{ marginLeft: '8px', padding: '1px 6px', background: 'rgba(248,113,113,0.12)', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                      {grupo.tipo === 'cuil' ? 'CUIL DUPLICADO' : 'NOMBRE DUPLICADO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Registros del grupo */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Nombre', 'CUIL', 'Analista', 'Estado', 'Monto', 'Fecha', 'Creado'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#555', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.registros.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(248,113,113,0.04)' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', color: '#fff', fontWeight: 500 }}>{r.nombre}</td>
                        <td style={{ padding: '8px 12px', color: '#666', fontFamily: 'monospace' }}>{r.cuil}</td>
                        <td style={{ padding: '8px 12px', color: '#888' }}>{displayAnalista(r.analista)}</td>
                        <td style={{ padding: '8px 12px', color: '#aaa' }}>{r.estado}</td>
                        <td style={{ padding: '8px 12px', color: '#f7e479', fontWeight: 600 }}>{formatCurrency(r.monto)}</td>
                        <td style={{ padding: '8px 12px', color: '#888' }}>{r.fecha ? formatDate(r.fecha) : '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#555', fontSize: '11px' }}>{r.created_at ? formatDate(r.created_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
