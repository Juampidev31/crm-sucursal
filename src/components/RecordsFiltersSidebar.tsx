'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { CorporateDateRangePicker } from '@/components/CorporateDateRangePicker';
import { ESTADOS, useFilter } from '@/context/FilterContext';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { capitalizarTexto } from '@/lib/utils';
import styles from './RecordsFiltersSidebar.module.css';

export default function RecordsFiltersSidebar() {
  const { nombres: analistas } = useAnalistas();
  const {
    filters,
    setFilter,
    limpiarFiltros,
    hayFiltros,
    setShowFilters,
  } = useFilter();
  const selectedAnalistas = filters.analistas.length > 0
    ? filters.analistas
    : filters.analista
      ? [filters.analista]
      : [];

  const setAnalistas = (values: string[]) => {
    setFilter('analistas', values);
    setFilter('analista', values.length === 1 ? values[0] : '');
  };

  return (
    <aside id="records-filters-sidebar" className={styles.sidebar} aria-label="Filtros de registros">
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <SlidersHorizontal size={18} />
        </span>
        <div>
          <strong>Filtros</strong>
          <small>Registros</small>
        </div>
        <button type="button" className={styles.close} onClick={() => setShowFilters(false)} aria-label="Cerrar filtros">
          <X size={18} />
        </button>
      </header>

      <div className={styles.body}>
        <div className={styles.field}>
          <span>Analista</span>
          <div className={styles.stateGrid} role="group" aria-label="Filtrar por analista">
            <button
              type="button"
              className={`${styles.stateCard} ${selectedAnalistas.length === 0 ? styles.stateCardActive : ''}`}
              aria-pressed={selectedAnalistas.length === 0}
              onClick={() => setAnalistas([])}
            >
              Todos
            </button>
            {analistas.map((analista, index) => {
              const selected = selectedAnalistas.includes(analista);
              return (
                <button
                  key={analista}
                  type="button"
                  className={`${styles.stateCard} ${styles[`tone${(index % 6) + 1}`]} ${selected ? styles.stateCardActive : ''}`}
                  aria-pressed={selected}
                  onClick={() => setAnalistas(
                    selected
                      ? selectedAnalistas.filter(value => value !== analista)
                      : [...selectedAnalistas, analista],
                  )}
                >
                  {analista}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.field}>
          <span>Estado</span>
          <div className={styles.stateGrid} role="group" aria-label="Filtrar por estado">
            <button
              type="button"
              className={`${styles.stateCard} ${filters.estados.length === 0 ? styles.stateCardActive : ''}`}
              aria-pressed={filters.estados.length === 0}
              onClick={() => setFilter('estados', [])}
            >
              Todos
            </button>
            {ESTADOS.map((estado, index) => {
              const selected = filters.estados.includes(estado);
              return (
                <button
                  key={estado}
                  type="button"
                  className={`${styles.stateCard} ${styles[`tone${(index % 7) + 1}`]} ${selected ? styles.stateCardActive : ''}`}
                  aria-pressed={selected}
                  onClick={() => setFilter(
                    'estados',
                    selected
                      ? filters.estados.filter(value => value !== estado)
                      : [...filters.estados, estado],
                  )}
                >
                  {capitalizarTexto(estado)}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.field}>
          <span>Período</span>
          <CorporateDateRangePicker
            fromValue={filters.fechaDesde}
            toValue={filters.fechaHasta}
            onChange={({ from, to }) => {
              setFilter('fechaDesde', from);
              setFilter('fechaHasta', to);
            }}
          />
        </div>

        <div className={styles.scoreGroup}>
          <label className={styles.field}>
            <span>Score mínimo</span>
            <input type="number" min="0" value={filters.scoreMin} onChange={event => setFilter('scoreMin', event.target.value)} placeholder="0" />
          </label>
          <label className={styles.field}>
            <span>Score máximo</span>
            <input type="number" min="0" value={filters.scoreMax} onChange={event => setFilter('scoreMax', event.target.value)} placeholder="999" />
          </label>
        </div>
      </div>

      <footer className={styles.footer}>
        <button type="button" className={styles.clear} onClick={limpiarFiltros} disabled={!hayFiltros}>
          <X size={15} /> Limpiar
        </button>
      </footer>
    </aside>
  );
}
