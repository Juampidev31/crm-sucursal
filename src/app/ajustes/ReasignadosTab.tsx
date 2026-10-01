'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import { ArrowRight, Search, History } from 'lucide-react';
import styles from './ReasignadosTab.module.css';

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
        // `id.asc` sólo como desempate para que las páginas sean estables.
        .order('fecha_hora', { ascending: false })
        .order('id', { ascending: true })
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

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchRows(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchRows]);

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

  return (
    <div className={styles.root}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <div className={styles.accent} />
          <div>
            <h1 className={styles.title}>Reasignados</h1>
            <p className={styles.subtitle}>Historial de registros reasignados entre analistas</p>
          </div>
        </div>
        <div className={styles.count}>
          {filtered.length} reasignación(es)
        </div>
      </header>

      {/* FILTERS */}
      <div className={styles.filters}>
        <div className={styles.search}>
          <Search className={styles.searchIcon} size={14} />
          <input
            className={`${styles.input} ${styles.searchInput}`}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar cliente, CUIL o analista..."
          />
        </div>
        <div className={styles.dateRange}>
          <input className={`${styles.input} ${styles.dateInput}`} type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }} title="Fecha desde" />
          <span className={styles.dateArrow}>→</span>
          <input className={`${styles.input} ${styles.dateInput}`} type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(1); }} title="Fecha hasta" />
          {(fechaDesde || fechaHasta) && (
            <button className={`${styles.input} ${styles.clearDates}`} onClick={() => { setFechaDesde(''); setFechaHasta(''); setPage(1); }} title="Limpiar fechas" type="button">✕</button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className={styles.card}>
        {loading ? (
          <div className={`loading-container ${styles.loading}`}><div className="spinner" /><span>Cargando reasignaciones...</span></div>
        ) : !filtered.length ? (
          <div className={`empty-state ${styles.empty}`}>
            <History className={styles.emptyIcon} size={36} />
            <p className={styles.emptyText}>
              {search || fechaDesde || fechaHasta ? 'Sin resultados para los filtros aplicados' : 'No hay reasignaciones registradas'}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={`data-table ${styles.table}`}>
                <thead>
                  <tr className={styles.headRow}>
                    <th className={`${styles.headingCell} ${styles.dateHeading}`}>Fecha / Hora</th>
                    <th className={styles.headingCell}>Cliente</th>
                    <th className={`${styles.headingCell} ${styles.transferHeading}`}>De → A</th>
                    <th className={`${styles.headingCell} ${styles.authorHeading}`}>Reasignado por</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r, i) => (
                    <tr className={styles.row} key={r.id ?? `${r.fecha_hora}-${i}`}>
                      <td className={`${styles.cell} ${styles.dateCell}`}>{r.fecha_hora ? formatDateTime(r.fecha_hora) : '—'}</td>
                      <td className={styles.cell}>
                        <div className={styles.clientName}>{r.nombre || '—'}</div>
                        {r.cuil && <div className={styles.cuil}>{r.cuil}</div>}
                      </td>
                      <td className={styles.cell}>
                        <div className={styles.transfer}>
                          <span className={styles.origin}>{r.valor_anterior || '—'}</span>
                          <ArrowRight className={styles.transferIcon} size={13} />
                          <span className={styles.destination}>{r.valor_nuevo || '—'}</span>
                        </div>
                      </td>
                      <td className={`${styles.cell} ${styles.author}`}>{r.id_analista || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={`${styles.input} ${styles.paginationButton}`} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>← Anterior</button>
                <span className={styles.paginationInfo}>Página {safePage} / {totalPages}</span>
                <button className={`${styles.input} ${styles.paginationButton}`} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Siguiente →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
