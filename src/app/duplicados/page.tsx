'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, displayAnalista } from '@/lib/utils';
import { Registro } from '@/types';
import { AlertTriangle, CheckCircle, ShieldCheck, User } from 'lucide-react';

interface GrupoDuplicado {
  key: string;
  tipo: 'cuil' | 'nombre';
  registros: Registro[];
}

export default function DuplicadosPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  
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
    const pool = registros.filter(r => {
      const matchEstado = selectedEstados.length === 0 || selectedEstados.includes(r.estado?.toLowerCase() || '');
      const matchAnalista = selectedAnalistas.length === 0 || selectedAnalistas.includes(r.analista || '');
      return matchEstado && matchAnalista;
    });

    const byCuil = new Map<string, Registro[]>();
    for (const r of pool) {
      const cuil = r.cuil?.trim();
      if (!cuil || cuil.length < 11) continue;
      if (!byCuil.has(cuil)) byCuil.set(cuil, []);
      byCuil.get(cuil)!.push(r);
    }
    for (const [cuil, regs] of byCuil) {
      if (regs.length > 1) grupos.push({ key: cuil, tipo: 'cuil', registros: regs });
    }

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
        if (!existsInCuil) grupos.push({ key: nombre, tipo: 'nombre', registros: regs });
      }
    }

    return grupos.sort((a, b) => b.registros.length - a.registros.length);
  }, [registros, selectedEstados, selectedAnalistas]);

  const chipStyle = (isActive: boolean) => ({
    padding: '6px 12px', borderRadius: '4px', fontSize: '10px', border: '1px solid',
    whiteSpace: 'nowrap' as const, fontWeight: 700 as const, cursor: 'pointer', transition: 'all 0.1s',
    background: isActive ? 'rgba(0,120,212,0.1)' : 'rgba(255,255,255,0.02)',
    borderColor: isActive ? 'var(--azul)' : 'rgba(255,255,255,0.05)',
    color: isActive ? 'var(--azul)' : '#444',
    textTransform: 'uppercase' as const, letterSpacing: '0.8px'
  });

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 4, height: 18, borderRadius: 2, background: 'var(--azul)' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Detección de Duplicados</h2>
        </div>
        {duplicados.length > 0 && (
          <div style={{ fontSize: '12px', color: '#999', fontWeight: 700 }}>
             {duplicados.length} duplicados potenciales encontrados
          </div>
        )}
      </header>

      {/* Toolbar - TODO EN UNA SOLA LINEA */}
      <div className="toolbar-container" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '40px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <ShieldCheck size={13} color="var(--azul)" />
              <span style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase' }}>Estados</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0', scrollbarWidth: 'none', flex: 1 }}>
              {allEstados.map(e => (
                <button key={e} onClick={() => toggleFilter(selectedEstados, setSelectedEstados, e)} style={chipStyle(selectedEstados.includes(e))}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={13} color="var(--azul)" />
              <span style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase' }}>Analistas</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {allAnalistas.map(a => (
                <button key={a} onClick={() => toggleFilter(selectedAnalistas, setSelectedAnalistas, a)} style={chipStyle(selectedAnalistas.includes(a))}>
                  {displayAnalista(a)}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><span>Procesando...</span></div>
      ) : duplicados.length === 0 ? (
        <div className="empty-state">
          <CheckCircle size={40} color="var(--verde)" style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ color: 'var(--verde)', fontWeight: 800, fontSize: '14px' }}>POOL LIMPIO</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {duplicados.map(grupo => (
            <div key={grupo.key} className="data-card" style={{ borderLeft: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={15} color="#444" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>
                    {grupo.tipo === 'cuil' ? grupo.key : grupo.registros[0].nombre.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase' }}>
                    {grupo.registros.length} duplicados • filtrado por {grupo.tipo}
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Cliente / Identificación</th>
                      <th style={{ textAlign: 'left' }}>Analista</th>
                      <th style={{ textAlign: 'left' }}>Estado</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                      <th style={{ textAlign: 'center' }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.registros.map((r) => (
                      <tr key={r.id}>
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{r.nombre}</div>
                          <div style={{ fontSize: '10px', color: '#333', fontFamily: 'monospace' }}>{r.cuil}</div>
                        </td>
                        <td style={{ color: '#555', fontSize: '12px' }}>{displayAnalista(r.analista)}</td>
                        <td>
                          <span className="status-badge" style={{ fontSize: '9px', padding: '2px 8px' }}>{r.estado}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--dorado)' }}>{formatCurrency(r.monto)}</td>
                        <td style={{ textAlign: 'center', color: '#333', fontSize: '11px' }}>{r.fecha ? formatDate(r.fecha) : '—'}</td>
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
