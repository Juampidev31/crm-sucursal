'use client';

import React, { useState, useMemo } from 'react';
import { formatCurrency, formatDate, displayAnalista } from '@/lib/utils';
import { Registro } from '@/types';
import { AlertTriangle, CheckCircle, ShieldCheck, User } from 'lucide-react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { normalizarNombreKey } from '@/lib/registro-stats';

interface GrupoDuplicado {
  key: string;
  tipo: 'cuil' | 'nombre';
  registros: Registro[];
}

export default function DuplicadosPage() {
  const { registros, loading } = useRegistros();

  const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
  const [selectedAnalistas, setSelectedAnalistas] = useState<string[]>([]);

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

    // Nombres ya cubiertos por un grupo de CUIL. Se precalcula una sola vez:
    // antes se re-escaneaba `grupos` (y se re-normalizaba cada nombre) dentro
    // del bucle de nombres, lo que era O(grupos × registros) y congelaba la
    // pestaña con pocos miles de registros.
    const nombresEnGruposCuil = new Set<string>();
    for (const g of grupos) {
      for (const r of g.registros) {
        const n = normalizarNombreKey(r.nombre);
        if (n) nombresEnGruposCuil.add(n);
      }
    }

    const byNombre = new Map<string, Registro[]>();
    for (const r of pool) {
      const nombre = normalizarNombreKey(r.nombre);
      if (!nombre || nombre.length < 3) continue;
      if (!byNombre.has(nombre)) byNombre.set(nombre, []);
      byNombre.get(nombre)!.push(r);
    }
    for (const [nombre, regs] of byNombre) {
      if (regs.length > 1 && !nombresEnGruposCuil.has(nombre)) {
        grupos.push({ key: nombre, tipo: 'nombre', registros: regs });
      }
    }

    return grupos.sort((a, b) => b.registros.length - a.registros.length);
  }, [registros, selectedEstados, selectedAnalistas]);

  return (
    <div className="dashboard-container duplicate-audit">
      <header className="dashboard-header">
        <div className="duplicate-audit__heading">
          <div className="duplicate-audit__heading-mark" />
          <h2>Detección de Duplicados</h2>
        </div>
        {duplicados.length > 0 && (
          <div className="duplicate-audit__case-count">
            {duplicados.length} CASOS
          </div>
        )}
      </header>

      {/* Filtros de Pool - TODO EN UNA LINEA POR COLUMNA */}
      <div className="toolbar-container duplicate-audit__toolbar">
        <div className="duplicate-audit__filters">
          
          <div className="duplicate-audit__filter-group is-wide">
            <div className="duplicate-audit__filter-label">
              <ShieldCheck size={13} color="var(--action-primary)" />
              <label>Estados</label>
            </div>
            <div className="duplicate-audit__chips is-scrollable">
              {allEstados.map(e => (
                <button key={e} onClick={() => toggleFilter(selectedEstados, setSelectedEstados, e)} className={`duplicate-audit__chip${selectedEstados.includes(e) ? ' is-active' : ''}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="duplicate-audit__filter-group">
            <div className="duplicate-audit__filter-label">
              <User size={13} color="var(--action-primary)" />
              <label>Analistas</label>
            </div>
            <div className="duplicate-audit__chips">
              {allAnalistas.map(a => (
                <button key={a} onClick={() => toggleFilter(selectedAnalistas, setSelectedAnalistas, a)} className={`duplicate-audit__chip${selectedAnalistas.includes(a) ? ' is-active' : ''}`}>
                  {displayAnalista(a)}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><span>Buscando registros...</span></div>
      ) : duplicados.length === 0 ? (
        <div className="empty-state duplicate-audit__empty">
          <CheckCircle size={40} className="duplicate-audit__empty-icon" />
          <p>SISTEMA LIMPIO</p>
        </div>
      ) : (
        <div className="duplicate-audit__groups">
          {duplicados.map(grupo => (
            <div key={grupo.key} className="data-card duplicate-audit__group">
              <div className="duplicate-audit__group-header">
                <div className="duplicate-audit__warning-icon">
                  <AlertTriangle size={16} color="var(--state-danger)" />
                </div>
                <div className="duplicate-audit__group-title-wrap">
                  <div className="duplicate-audit__group-title">
                    {grupo.tipo === 'cuil' ? grupo.key : grupo.registros[0].nombre.toUpperCase()}
                  </div>
                  <div className="duplicate-audit__group-meta">
                    {grupo.registros.length} duplicados detectados • {grupo.tipo}
                  </div>
                </div>
              </div>

              <div className="duplicate-audit__table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente / Identificación</th>
                      <th>Analista</th>
                      <th>Estado</th>
                      <th className="is-right">Monto</th>
                      <th className="is-center">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.registros.map((r, i) => (
                      <tr key={r.id}>
                        <td className="duplicate-audit__identity">
                          <div className={`duplicate-audit__name${i === 0 ? ' is-primary' : ''}`}>{r.nombre}</div>
                          <div className="duplicate-audit__cuil">{r.cuil}</div>
                        </td>
                        <td className="duplicate-audit__analyst">{displayAnalista(r.analista)}</td>
                        <td>
                          <span className="status-badge duplicate-audit__status">{r.estado}</span>
                        </td>
                        <td className="duplicate-audit__amount">{formatCurrency(r.monto ?? 0)}</td>
                        <td className="duplicate-audit__date">{r.fecha ? formatDate(r.fecha) : '—'}</td>
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
