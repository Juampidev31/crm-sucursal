'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
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
          <MultiSelect
            values={filters.analistas.length > 0 ? filters.analistas : filters.analista ? [filters.analista] : []}
            onChange={values => {
              setFilter('analistas', values);
              setFilter('analista', values.length === 1 ? values[0] : '');
            }}
            options={analistas}
            placeholder="Todos los analistas"
            clearLabel="Todos los analistas"
            searchable
          />
        </div>

        <div className={styles.field}>
          <span>Estado</span>
          <MultiSelect
            values={filters.estados}
            onChange={values => setFilter('estados', values)}
            options={ESTADOS.map(estado => ({ value: estado, label: capitalizarTexto(estado) }))}
            placeholder="Todos los estados"
            clearLabel="Todos los estados"
          />
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
