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
  const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
  const [selectedAnalistas, setSelectedAnalistas] = useState<string[]>([]);

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

  const allEstados = useMemo(() => 
    Array.from(new Set(registros.map(r => r.estado?.toLowerCase()).filter(Boolean)))
      .filter(e => !e?.toLowerCase().includes('column') && !e?.toLowerCase().includes('estado'))
      .sort() as string[], 
    [registros]
  );
  const allAnalistas = useMemo(() => 
    Array.from(new Set(registros.map(r => r.analista?.trim()).filter(Boolean)))
      .filter(a => !a?.toLowerCase().includes('column') && !a?.toLowerCase().includes('analista'))
      .sort() as string[], 
    [registros]
  );

  const toggleFilter = (list: string[], set: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    if (list.includes(val)) set(list.filter(v => v !== val));
    else set([...list, val]);
  };

  const duplicados = useMemo((): GrupoDuplicado[] => {
    const grupos: GrupoDuplicado[] = [];

    // Filtramos los registros BASE antes de buscar duplicados
    const pool = registros.filter(r => {
      const matchEstado = selectedEstados.length === 0 || selectedEstados.includes(r.estado?.toLowerCase() || '');
      const matchAnalista = selectedAnalistas.length === 0 || selectedAnalistas.includes(r.analista || '');
      return matchEstado && matchAnalista;
    });

    if (tipoBusqueda === 'cuil' || tipoBusqueda === 'ambos') {
      const byCuil = new Map<string, Registro[]>();
      for (const r of pool) {
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
      for (const r of pool) {
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
  }, [registros, tipoBusqueda, busqueda, selectedEstados, selectedAnalistas]);

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
        </div>
      </header>

      {/* Filtros */}
      <div className="data-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          
          <div style={{ flex: '1 1 300px' }}>
            <label style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Buscar por Texto</label>
            <input style={{ ...inputStyle, width: '100%' }} placeholder="CUIL o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>

          <div style={{ flex: '0 0 180px' }}>
            <label style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Método de Detección</label>
            <select style={{ ...inputStyle, width: '100%' }} value={tipoBusqueda} onChange={e => setTipoBusqueda(e.target.value as typeof tipoBusqueda)}>
              <option value="ambos">CUIL y Nombre</option>
              <option value="cuil">Solo CUIL</option>
              <option value="nombre">Solo Nombre</option>
            </select>
          </div>

          <div style={{ flex: '1 1 100%' }}>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              
              <div style={{ flex: 1, minWidth: '200px', overflow: 'hidden' }}>
                <label style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Estados (Filtrar pool)</label>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }} className="flex-no-wrap-scroll">
                  {allEstados.map(e => (
                    <button
                      key={e}
                      onClick={() => toggleFilter(selectedEstados, setSelectedEstados, e)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '11px', border: '1px solid',
                        whiteSpace: 'nowrap',
                        background: selectedEstados.includes(e) ? 'rgba(247,228,121,0.15)' : 'transparent',
                        borderColor: selectedEstados.includes(e) ? '#f7e479' : 'rgba(255,255,255,0.1)',
                        color: selectedEstados.includes(e) ? '#f7e479' : '#555',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                  {allEstados.length === 0 && <span style={{ color: '#333', fontSize: '11px' }}>Cargando estados...</span>}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: '200px', overflow: 'hidden' }}>
                <label style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Analistas (Filtrar pool)</label>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }} className="flex-no-wrap-scroll">
                  {allAnalistas.map(a => (
                    <button
                      key={a}
                      onClick={() => toggleFilter(selectedAnalistas, setSelectedAnalistas, a)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '11px', border: '1px solid',
                        whiteSpace: 'nowrap',
                        background: selectedAnalistas.includes(a) ? 'rgba(74,222,128,0.1)' : 'transparent',
                        borderColor: selectedAnalistas.includes(a) ? '#4ade80' : 'rgba(255,255,255,0.1)',
                        color: selectedAnalistas.includes(a) ? '#4ade80' : '#555',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      {displayAnalista(a)}
                    </button>
                  ))}
                  {allAnalistas.length === 0 && <span style={{ color: '#333', fontSize: '11px' }}>Cargando analistas...</span>}
                </div>
              </div>

            </div>
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
