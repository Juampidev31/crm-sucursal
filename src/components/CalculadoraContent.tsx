'use client';

import { useMemo, useState } from 'react';
import { CircleDollarSign, RotateCcw, TrendingUp, Wallet } from 'lucide-react';
import styles from './CalculadoraContent.module.css';

const DEFAULT_FIXED_SALARY = '1641799.18';

const INCENTIVES = {
  capital: { c1: 62055, c2: 93703, c3: 141492 },
  operacion: { c1: 42836, c2: 64682, c3: 97671 },
  recupero90: { c1: 40801, c2: 52633, c3: 67897 },
  recupero120: { c1: 40801, c2: 52633, c3: 67897 },
  refi: { c1: 20400, c2: 26521, c3: 37129 },
} as const;

type PactKey = keyof typeof INCENTIVES;
type Pacts = Record<PactKey, string>;

const EMPTY_PACTS: Pacts = { capital: '', operacion: '', recupero90: '', recupero120: '', refi: '' };
const money = (value: number, decimals = false) => `$ ${value.toLocaleString('es-AR', decimals ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined)}`;

function calculate(type: PactKey, value: string): number {
  const percentage = Number(value);
  if (!Number.isFinite(percentage) || percentage < 80) return 0;
  const incentive = INCENTIVES[type];
  if (percentage < 100) return incentive.c1;
  if (percentage < 110) return incentive.c2;
  return incentive.c3;
}

function tierLabel(value: string): string {
  const percentage = Number(value);
  if (!value || !Number.isFinite(percentage)) return 'Ingresá el cumplimiento';
  if (percentage < 80) return 'Activa desde 80%';
  if (percentage < 100) return 'Tramo 80–99%';
  if (percentage < 110) return 'Tramo 100–109%';
  return 'Tramo 110% o más';
}

export default function CalculadoraContent() {
  const [pacts, setPacts] = useState<Pacts>(EMPTY_PACTS);
  const [fixedSalary, setFixedSalary] = useState(DEFAULT_FIXED_SALARY);

  const results = useMemo(() => ({
    capital: calculate('capital', pacts.capital),
    operacion: calculate('operacion', pacts.operacion),
    recupero90: calculate('recupero90', pacts.recupero90),
    recupero120: calculate('recupero120', pacts.recupero120),
    refi: calculate('refi', pacts.refi),
  }), [pacts]);

  const comisiones = Object.values(results).reduce((sum, value) => sum + value, 0);
  const fixedSalaryValue = Math.max(0, Number(fixedSalary) || 0);
  const totalGeneral = comisiones + fixedSalaryValue;
  const hasChanges = Object.values(pacts).some(Boolean) || fixedSalary !== DEFAULT_FIXED_SALARY;

  const resetCalculator = () => {
    setPacts(EMPTY_PACTS);
    setFixedSalary(DEFAULT_FIXED_SALARY);
  };

  const inputCard = (label: string, key: PactKey) => {
    const active = results[key] > 0;
    return (
      <article className={`${styles.metricCard}${active ? ` ${styles.metricCardActive}` : ''}`} key={key}>
        <div className={styles.metricHeader}>
          <label htmlFor={`calculator-${key}`}>{label}</label>
          <span>{tierLabel(pacts[key])}</span>
        </div>
        <div className={styles.metricBody}>
          <div className={styles.percentageField}>
            <input
              id={`calculator-${key}`}
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              placeholder="0"
              value={pacts[key]}
              onChange={event => setPacts(current => ({ ...current, [key]: event.target.value }))}
            />
            <span>%</span>
          </div>
          <output className={active ? styles.incentiveActive : undefined}>
            <small>Incentivo</small>
            <strong>{active ? money(results[key]) : '—'}</strong>
          </output>
        </div>
      </article>
    );
  };

  return (
    <div className={styles.calculatorContent}>
      <div className={styles.toolbar}>
        <div><strong>Simulá tu liquidación</strong><span>Ingresá el porcentaje alcanzado en cada indicador.</span></div>
        <button type="button" onClick={resetCalculator} disabled={!hasChanges}><RotateCcw size={14} /> Reiniciar</button>
      </div>

      <div className={styles.workspace}>
        <div className={styles.groups}>
          <section className={styles.group}>
            <header className={styles.groupHeader}>
              <span className={styles.groupIcon}><TrendingUp size={16} /></span>
              <div><h3>Venta</h3><p>Capital colocado y operaciones concretadas</p></div>
            </header>
            <div className={styles.fields}>{inputCard('Capital', 'capital')}{inputCard('Operación', 'operacion')}</div>
          </section>

          <section className={styles.group}>
            <header className={styles.groupHeader}>
              <span className={`${styles.groupIcon} ${styles.collectionsIcon}`}><CircleDollarSign size={16} /></span>
              <div><h3>Cobranzas</h3><p>Recuperos y refinanciaciones del período</p></div>
            </header>
            <div className={`${styles.fields} ${styles.collectionFields}`}>
              {inputCard('Recupero 90–119', 'recupero90')}
              {inputCard('Recupero 120–209', 'recupero120')}
              {inputCard('REFI', 'refi')}
            </div>
          </section>
        </div>

        <aside className={styles.summaryCard}>
          <div className={styles.summaryHeading}>
            <span><Wallet size={18} /></span>
            <div><small>Resultado estimado</small><strong>Sucursal B</strong></div>
          </div>
          <div className={styles.summaryRows}>
            <div className={styles.salaryRow}>
              <label htmlFor="calculator-fixed-salary">Sueldo fijo</label>
              <div className={styles.salaryField}>
                <span>$</span>
                <input
                  id="calculator-fixed-salary"
                  type="number"
                  min="0"
                  step="1000"
                  inputMode="decimal"
                  value={fixedSalary}
                  onChange={event => setFixedSalary(event.target.value)}
                  aria-label="Modificar sueldo fijo"
                />
              </div>
            </div>
            <div><span>Comisiones</span><strong className={styles.commissionValue}>+ {money(comisiones)}</strong></div>
          </div>
          <div className={styles.totalBlock}>
            <small>Total a cobrar</small>
            <strong>{money(totalGeneral, true)}</strong>
            {comisiones > 0 && <span>{money(comisiones)} en incentivos</span>}
          </div>
        </aside>
      </div>
    </div>
  );
}
