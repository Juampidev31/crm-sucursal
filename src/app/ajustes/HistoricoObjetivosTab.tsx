'use client';

import type { Dispatch, SetStateAction } from 'react';
import { BarChart3, History, Save, Target } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { CONFIG } from '@/types';
import { formatCurrency } from '@/lib/utils';
import styles from './HistoricoObjetivosTab.module.css';

export type HistoricoObjetivosRow = {
  capital_real: string;
  ops_real: string;
  meta_ventas: string;
  meta_operaciones: string;
};

type EditableField = 'meta_ventas' | 'meta_operaciones';

const integerFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

const complianceClass = (value: number | null) => {
  if (value === null || value < 75) return styles.complianceLow;
  if (value < 100) return styles.complianceMid;
  return styles.complianceHigh;
};

const parsePastedValue = (raw: string) => {
  const parsed = Number.parseFloat(raw.replace(/\./g, '').replace(/,/g, '.').trim());
  return Number.isFinite(parsed) ? String(parsed) : null;
};

function AnnualMetric({
  icon,
  label,
  result,
  goal,
  compliance,
}: {
  icon: React.ReactNode;
  label: string;
  result: string;
  goal: string;
  compliance: number | null;
}) {
  return (
    <article className={styles.annualCard}>
      <span className={styles.annualIcon}>{icon}</span>
      <div className={styles.annualContent}>
        <span className={styles.annualLabel}>{label}</span>
        <strong className={styles.annualResult}>{result}</strong>
        <small>Objetivo anual: {goal}</small>
      </div>
      <div className={styles.annualStatus}>
        <span>Cumplimiento</span>
        <strong className={`${styles.complianceBadge} ${complianceClass(compliance)}`}>
          {compliance === null ? '—' : `${compliance.toFixed(2)}%`}
        </strong>
      </div>
    </article>
  );
}

export default function HistoricoObjetivosTab({
  analysts,
  analyst,
  year,
  rows,
  saving,
  onAnalystChange,
  onYearChange,
  setRows,
  onSave,
}: {
  analysts: string[];
  analyst: string;
  year: number;
  rows: HistoricoObjetivosRow[];
  saving: boolean;
  onAnalystChange: (value: string) => void;
  onYearChange: (value: number) => void;
  setRows: Dispatch<SetStateAction<HistoricoObjetivosRow[]>>;
  onSave: () => void;
}) {
  const capitalGoal = rows.reduce((sum, row) => sum + (Number(row.meta_ventas) || 0), 0);
  const capitalResult = rows.reduce((sum, row) => sum + (Number(row.capital_real) || 0), 0);
  const operationsGoal = rows.reduce((sum, row) => sum + (Number(row.meta_operaciones) || 0), 0);
  const operationsResult = rows.reduce((sum, row) => sum + (Number(row.ops_real) || 0), 0);
  const capitalCompliance = capitalGoal > 0 ? (capitalResult / capitalGoal) * 100 : null;
  const operationsCompliance = operationsGoal > 0 ? (operationsResult / operationsGoal) * 100 : null;
  const years = Array.from({ length: new Date().getFullYear() - 2021 + 1 }, (_, index) => new Date().getFullYear() - index);

  const updateCell = (index: number, field: EditableField, value: string) => {
    setRows(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>, index: number, field: EditableField) => {
    event.preventDefault();
    const value = parsePastedValue(event.clipboardData.getData('text'));
    if (value !== null) updateCell(index, field, value);
  };

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.icon}><History size={18} /></span>
          <div>
            <p>Planificación y resultados</p>
            <h2>Histórico y objetivos</h2>
            <span>{analyst} · {year}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <div className={styles.selectWrap}>
            <CustomSelect
              value={analyst}
              onChange={value => onAnalystChange(String(value))}
              options={['PDV', ...analysts].map(value => ({ label: value, value }))}
              width="150px"
            />
          </div>
          <div className={styles.selectWrap}>
            <CustomSelect
              value={year}
              onChange={value => onYearChange(Number(value))}
              options={years.map(value => ({ label: String(value), value }))}
              width="110px"
            />
          </div>
          <button className={styles.saveButton} type="button" onClick={onSave} disabled={saving}>
            <Save size={14} />
            {saving ? 'Guardando…' : 'Guardar objetivos'}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.annualGrid}>
          <AnnualMetric
            icon={<Target size={17} />}
            label="Capital anual"
            result={formatCurrency(capitalResult)}
            goal={capitalGoal > 0 ? formatCurrency(capitalGoal) : '—'}
            compliance={capitalCompliance}
          />
          <AnnualMetric
            icon={<BarChart3 size={17} />}
            label="Operaciones anuales"
            result={`${operationsResult} operaciones`}
            goal={operationsGoal > 0 ? String(operationsGoal) : '—'}
            compliance={operationsCompliance}
          />
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableTitle}>
            <div>
              <span>Detalle mensual</span>
              <strong>Objetivos y resultados</strong>
            </div>
            <small>Resultados automáticos · guardá sólo los objetivos</small>
          </div>

          <div className={styles.tableViewport}>
            <table className={styles.historyTable}>
              <colgroup>
                <col className={styles.monthColumn} />
                <col className={styles.capitalColumn} />
                <col className={styles.capitalColumn} />
                <col className={styles.complianceColumn} />
                <col className={styles.operationsColumn} />
                <col className={styles.operationsColumn} />
                <col className={styles.complianceColumn} />
              </colgroup>
              <thead>
                <tr className={styles.groupHeader}>
                  <th rowSpan={2}>Mes</th>
                  <th colSpan={3}>Capital</th>
                  <th colSpan={3}>Operaciones</th>
                </tr>
                <tr>
                  <th>Objetivo</th>
                  <th>Resultado</th>
                  <th>Cumpl.</th>
                  <th>Objetivo</th>
                  <th>Resultado</th>
                  <th>Cumpl.</th>
                </tr>
              </thead>
              <tbody>
                {CONFIG.MESES_NOMBRES.map((month, index) => {
                  const capitalMonthGoal = Number(rows[index].meta_ventas) || 0;
                  const capitalMonthResult = Number(rows[index].capital_real) || 0;
                  const operationsMonthGoal = Number(rows[index].meta_operaciones) || 0;
                  const operationsMonthResult = Number(rows[index].ops_real) || 0;
                  const capitalMonthCompliance = capitalMonthGoal > 0 ? (capitalMonthResult / capitalMonthGoal) * 100 : null;
                  const operationsMonthCompliance = operationsMonthGoal > 0 ? (operationsMonthResult / operationsMonthGoal) * 100 : null;
                  return (
                    <tr key={month}>
                      <td>{month}</td>
                      <td>
                        <div className={styles.currencyInput}>
                          <span aria-hidden="true">$</span>
                          <input aria-label={`Capital: objetivo de ${month}`} type="number" placeholder="—" value={rows[index].meta_ventas} onChange={event => updateCell(index, 'meta_ventas', event.target.value)} onPaste={event => handlePaste(event, index, 'meta_ventas')} />
                        </div>
                      </td>
                      <td>
                        <div className={styles.autoValue} aria-label={`Capital: resultado automático de ${month}`} title="Calculado automáticamente desde los registros">
                          {capitalMonthResult > 0 ? `$ ${integerFormatter.format(capitalMonthResult)}` : '—'}
                        </div>
                      </td>
                      <td><span className={`${styles.complianceBadge} ${complianceClass(capitalMonthCompliance)}`}>{capitalMonthCompliance === null ? '—' : `${capitalMonthCompliance.toFixed(1)}%`}</span></td>
                      <td><input className={styles.compactInput} aria-label={`Operaciones: objetivo de ${month}`} type="number" placeholder="—" value={rows[index].meta_operaciones} onChange={event => updateCell(index, 'meta_operaciones', event.target.value)} /></td>
                      <td>
                        <div className={styles.autoValue} aria-label={`Operaciones: resultado automático de ${month}`} title="Calculado automáticamente desde los registros">
                          {operationsMonthResult > 0 ? integerFormatter.format(operationsMonthResult) : '—'}
                        </div>
                      </td>
                      <td><span className={`${styles.complianceBadge} ${complianceClass(operationsMonthCompliance)}`}>{operationsMonthCompliance === null ? '—' : `${operationsMonthCompliance.toFixed(1)}%`}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
