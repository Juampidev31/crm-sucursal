'use client';

import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { useObjetivos } from '@/features/objetivos/ObjetivosProvider';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { filterByMonth, isVenta } from '@/lib/registro-stats';
import { formatCurrency } from '@/lib/utils';
import { CONFIG } from '@/types';
import styles from './ComparativaAnalistasTab.module.css';

const now = new Date();

type ComparisonRow = {
  analista: string;
  capital: number;
  metaCapital: number;
  operaciones: number;
  metaOperaciones: number;
  cumplimientoCapital: number | null;
  cumplimientoOperaciones: number | null;
};

const calculateCompliance = (value: number, goal: number) => goal > 0 ? (value / goal) * 100 : null;

const complianceClass = (value: number | null) => {
  if (value === null || value < 75) return styles.complianceLow;
  if (value < 100) return styles.complianceMid;
  return styles.complianceHigh;
};

function ComparisonTable({
  title,
  rows,
  goalAccessor,
  valueAccessor,
  complianceAccessor,
  format,
}: {
  title: string;
  rows: ComparisonRow[];
  goalAccessor: (row: ComparisonRow) => number;
  valueAccessor: (row: ComparisonRow) => number;
  complianceAccessor: (row: ComparisonRow) => number | null;
  format: (value: number) => string;
}) {
  return (
    <article className={styles.tableCard}>
      <div className={styles.tableSummary}>
        <div>
          <span className={styles.tableLabel}>{title}</span>
        </div>
        <span className={styles.analystCount}>{rows.length} analistas</span>
      </div>

      <div className={styles.tableViewport}>
        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th>Analista</th>
              <th>Objetivo</th>
              <th>Alcance</th>
              <th>Cumpl.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const compliance = complianceAccessor(row);
              return (
                <tr key={row.analista}>
                  <td><span className={styles.analystDot} />{row.analista}</td>
                  <td>{goalAccessor(row) > 0 ? format(goalAccessor(row)) : '—'}</td>
                  <td className={styles.reachedValue}>{format(valueAccessor(row))}</td>
                  <td>
                    <span className={`${styles.complianceBadge} ${complianceClass(compliance)}`}>
                      {compliance === null ? '—' : `${compliance.toFixed(2)}%`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default function ComparativaAnalistasTab() {
  const { registros, loading } = useRegistros();
  const { objetivos } = useObjetivos();
  const { nombres } = useAnalistas();
  const [selectedAnio, setSelectedAnio] = useState<number | 'TODOS'>(now.getFullYear());
  const [selectedMes, setSelectedMes] = useState<number | 'TODOS'>(now.getMonth() + 1);

  const aniosDisponibles = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);
    registros.forEach(registro => {
      const year = Number(registro.fecha?.slice(0, 4));
      if (Number.isFinite(year)) years.add(year);
    });
    objetivos.forEach(objetivo => years.add(objetivo.anio));
    return Array.from(years).sort((a, b) => b - a);
  }, [registros, objetivos]);

  const registrosPeriodo = useMemo(() => {
    if (selectedAnio === 'TODOS') return registros;
    if (selectedMes === 'TODOS') return registros.filter(registro => registro.fecha?.startsWith(`${selectedAnio}-`));
    return filterByMonth(registros, selectedMes, selectedAnio);
  }, [registros, selectedAnio, selectedMes]);

  const analistas = useMemo(() => nombres.length > 0 ? nombres : ['Luciana', 'Victoria'], [nombres]);

  const rows = useMemo(() => {
    const rowsByAnalyst: ComparisonRow[] = analistas.map(analista => {
      const sales = registrosPeriodo.filter(registro => registro.analista === analista && isVenta(registro));
      const capital = sales.reduce((sum, registro) => sum + (Number(registro.monto) || 0), 0);
      const operaciones = sales.length;
      const analystGoals = objetivos.filter(objetivo => {
        if (objetivo.analista !== analista) return false;
        if (selectedAnio !== 'TODOS' && objetivo.anio !== selectedAnio) return false;
        if (selectedMes !== 'TODOS' && objetivo.mes !== selectedMes - 1) return false;
        return true;
      });
      const metaCapital = analystGoals.reduce((sum, objetivo) => sum + (objetivo.meta_ventas || 0), 0);
      const metaOperaciones = analystGoals.reduce((sum, objetivo) => sum + (objetivo.meta_operaciones || 0), 0);

      return {
        analista,
        capital,
        metaCapital,
        operaciones,
        metaOperaciones,
        cumplimientoCapital: calculateCompliance(capital, metaCapital),
        cumplimientoOperaciones: calculateCompliance(operaciones, metaOperaciones),
      };
    });

    return rowsByAnalyst;
  }, [analistas, registrosPeriodo, objetivos, selectedAnio, selectedMes]);

  const periodLabel = selectedAnio === 'TODOS'
    ? 'Histórico completo'
    : selectedMes === 'TODOS'
      ? `Año ${selectedAnio}`
      : `${CONFIG.MESES_NOMBRES[selectedMes - 1]} ${selectedAnio}`;

  if (loading) {
    return (
      <div className={`loading-container ${styles.loading}`}>
        <div className="spinner" />
        <span>Cargando comparativa...</span>
      </div>
    );
  }

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.icon}><BarChart3 size={18} /></span>
          <div>
            <p>Análisis consolidado</p>
            <h2>Comparativa de analistas</h2>
            <span>{periodLabel}</span>
          </div>
        </div>
        <div className={styles.filters}>
          <div className={styles.selectWrap}>
            <CustomSelect
              value={selectedMes}
              onChange={value => setSelectedMes(value === 'TODOS' ? 'TODOS' : Number(value))}
              options={[{ label: 'Todo el año', value: 'TODOS' }, ...CONFIG.MESES_NOMBRES.map((month, index) => ({ label: month, value: index + 1 }))]}
              width="150px"
              menuMaxHeight="520px"
            />
          </div>
          <div className={styles.selectWrap}>
            <CustomSelect
              value={selectedAnio}
              onChange={value => {
                const nextYear = value === 'TODOS' ? 'TODOS' : Number(value);
                setSelectedAnio(nextYear);
                if (nextYear === 'TODOS') setSelectedMes('TODOS');
              }}
              options={[{ label: 'Histórico', value: 'TODOS' }, ...aniosDisponibles.map(year => ({ label: String(year), value: year }))]}
              width="120px"
            />
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.tablesGrid}>
          <ComparisonTable
            title="Cumplimiento K"
            rows={rows}
            goalAccessor={row => row.metaCapital}
            valueAccessor={row => row.capital}
            complianceAccessor={row => row.cumplimientoCapital}
            format={formatCurrency}
          />
          <ComparisonTable
            title="Cumplimiento OP"
            rows={rows}
            goalAccessor={row => row.metaOperaciones}
            valueAccessor={row => row.operaciones}
            complianceAccessor={row => row.cumplimientoOperaciones}
            format={value => String(value)}
          />
        </div>
      </div>
    </section>
  );
}
