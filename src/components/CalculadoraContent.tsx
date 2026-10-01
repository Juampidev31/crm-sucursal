'use client';

import { useState } from 'react';
import styles from './Sidebar.module.css';

/**
 * Simulador de sueldo e incentivos (ventas y cobranzas).
 *
 * Vivía dentro de `Sidebar.tsx`. Se extrae sin cambios para poder reutilizarlo
 * desde el nuevo shell (`RecordsSidebar`), donde el Sidebar grande ya no se
 * monta. Conserva su import de `Sidebar.module.css` para no alterar estilos.
 */
export default function CalculadoraContent() {
  const SUELDO_FIJO = 1641799.18;
  const [pacts, setPacts] = useState({
    capital: '',
    operacion: '',
    recupero90: '',
    recupero120: '',
    refi: ''
  });

  const calculate = (type: string, val: string) => {
    const pct = parseFloat(val);
    if (isNaN(pct) || pct < 80) return 0;

    const values: Record<string, { c1: number; c2: number; c3: number }> = {
      capital: { c1: 62055, c2: 93703, c3: 141492 },
      operacion: { c1: 42836, c2: 64682, c3: 97671 },
      recupero90: { c1: 40801, c2: 52633, c3: 67897 },
      recupero120: { c1: 40801, c2: 52633, c3: 67897 },
      refi: { c1: 20400, c2: 26521, c3: 37129 }
    };

    const v = values[type];
    if (pct < 100) return v.c1;
    if (pct < 110) return v.c2;
    return v.c3;
  };

  const results = {
    capital: calculate('capital', pacts.capital),
    operacion: calculate('operacion', pacts.operacion),
    recupero90: calculate('recupero90', pacts.recupero90),
    recupero120: calculate('recupero120', pacts.recupero120),
    refi: calculate('refi', pacts.refi)
  };

  const comisiones = Object.values(results).reduce((s, v) => s + v, 0);
  const totalGeneral = comisiones + SUELDO_FIJO;

  const inputRow = (label: string, key: keyof typeof pacts) => (
    <div className={[styles["uBackgroundmeuzme"], styles["uPaddingz0ygds"], styles["uBorderRadius1ezp5a"], styles["uBordersgejmv"], styles["uTransition1ril1h"], styles.calculatorInputRow].join(' ')}>
      <label className={[styles["uDisplay16x7ac"], styles["uFontSizehdm4oq"], styles["uColorea0on8"], styles["uFontWeight1j2n9f"], styles["uTextTransform1juf4j"], styles["uLetterSpacing1648kt"], styles["uMarginBottom1x3vyu"]].join(' ')}>{label} (%)</label>
      <div className={styles.calculatorInputLine}>
        <input
          type="number"
          placeholder="0"
          value={pacts[key]}
          onChange={e => setPacts(p => ({ ...p, [key]: e.target.value }))}
          className={styles.calculatorInput}
        />
        <output className={styles.calculatorResultValue} style={{ color: results[key] > 0 ? '#059669' : '#8b98ad' }}>
          {results[key] > 0 ? `$ ${results[key].toLocaleString('es-AR')}` : '—'}
        </output>
      </div>
    </div>
  );

  return (
    <div className={[styles["uDisplaym92pvu"], styles["uFlexDirectionaexooi"], styles["uGapqginuq"], styles["uPaddingBottomlow5pc"], styles.calculatorContent].join(' ')}>
      <section className={styles.calculatorGroup}>
        <label className={`${styles.sectionLabel} ${styles.calculatorVentaLabel}`}>VENTA</label>
        <div className={styles.calculatorFields}>
          {inputRow('Capital', 'capital')}
          {inputRow('Operación', 'operacion')}
        </div>
      </section>

      <section className={styles.calculatorGroup}>
        <label className={`${styles.sectionLabel} ${styles.calculatorCobranzasLabel}`}>COBRANZAS</label>
        <div className={styles.calculatorFields}>
          {inputRow('Recupero 90-119', 'recupero90')}
          {inputRow('Recupero 120-209', 'recupero120')}
          {inputRow('REFI', 'refi')}
        </div>
      </section>

      <div className={[styles["uMarginTopc70xzi"], styles["uPadding4nbzj0"], styles["uBorderRadiusvo4hkt"], styles["uDisplaym92pvu"], styles["uFlexDirectionaexooi"], styles["uGap196dx6"], styles.calculatorResultCard].join(' ')}>
        <div className={styles.calculatorSummaryRow}>
          <span className={[styles["uFontSizesxidx0"], styles["uFontWeight1j2n9f"], styles["uColorea0on8"], styles["uTextTransform1juf4j"], styles["uLetterSpacing1llh9a"]].join(' ')}>Sueldo Fijo</span>
          <span className={`${styles.calculatorPrimaryValue} ${styles.calculatorSummaryValue}`}>$ {SUELDO_FIJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>

        <div className={styles.calculatorSummaryRow}>
          <span className={[styles["uFontSizesxidx0"], styles["uFontWeight1j2n9f"], styles["uColorea0on8"], styles["uTextTransform1juf4j"], styles["uLetterSpacing1llh9a"]].join(' ')}>Comisiones</span>
          <span className={`${styles.calculatorSummaryValue} ${styles.calculatorCommissionValue}`}>$ {comisiones.toLocaleString('es-AR')}</span>
        </div>

        <div className={[styles["uHeightrx01wr"], styles["uMargin9ymgzx"], styles.calculatorDivider].join(' ')} />

        <div className={`${styles.calculatorSummaryRow} ${styles.calculatorTotalRow}`}>
          <span className={[styles["uFontSize130r3e"], styles["uFontWeightjy5r9y"], styles["uTextTransform1juf4j"], styles["uLetterSpacing1llh9a"], styles.calculatorTotalLabel].join(' ')}>Total Cobrar</span>
          <span className={styles.calculatorTotalValue}>$ {totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className={[styles["uFontSizehdm4oq"], styles["uTextAlign106slq"], styles["uFontWeighty9mhin"], styles["uMarginTopyasalp"], styles["uLetterSpacing1llh9a"], styles.calculatorBranch].join(' ')}>SUCURSAL B</div>
      </div>
    </div>
  );
}
