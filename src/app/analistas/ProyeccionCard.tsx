'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';
import styles from './ProyeccionCard.module.css';

export interface ProyeccionKpi {
  metaDiariaCapital: number | null;
  ventaPorDia: number | null;
  metaDiariaOps: number | null;
  opsPorDia: number | null;
  proyCapital: number | null;
  cumplProyCapital: number | null;
  proyOps: number | null;
  cumplProyOps: number | null;
  faltaCapital: number | null;
  faltaOps: number | null;
  ventaIdealFecha: number | null;
  capital: number;
  ops: number;
  metaCapital: number;
  metaOps: number;
  esMesActual: boolean;
  tieneDiasAdmin: boolean;
}

const toneClass = (positive: boolean) => positive ? styles.positive : styles.negative;

export default function ProyeccionCard({ kpi, titulo, showActual = true, showProy = true }: { kpi: ProyeccionKpi; titulo: string; showActual?: boolean; showProy?: boolean }) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>{titulo}</div>

      {kpi.esMesActual && !kpi.tieneDiasAdmin ? (
        <div className={`${styles.panel} ${styles.emptyPanel}`}>
          Cargá días hábiles en Ajustes para ver proyección
        </div>
      ) : (
        <>
          {showActual && (
            <div className={styles.panel}>
              <div className={`${styles.row} ${styles.rowCurrent}`}>
                <div className={styles.cell}>
                  <div className={styles.label}>Venta actual (K)</div>
                  <div className={styles.value}>{formatCurrency(kpi.capital)}</div>
                </div>
                <div className={styles.cell}>
                  <div className={styles.label}>Ops. actuales (Q)</div>
                  <div className={styles.value}>{Math.round(kpi.ops)}</div>
                </div>
              </div>

              {kpi.metaDiariaCapital !== null && (
                <>
                  <div className={styles.divider} />
                  <div className={`${styles.row} ${styles.rowCurrent}`}>
                    <div className={styles.cell}>
                      <div className={styles.label}>Venta / día ({kpi.esMesActual ? 'Necesario' : 'Meta'})</div>
                      <div className={styles.value}>{formatCurrency(kpi.metaDiariaCapital)}</div>
                      {kpi.ventaPorDia !== null && <div className={styles.ritmo}>PROMEDIO: {formatCurrency(kpi.ventaPorDia)}</div>}
                    </div>
                    <div className={styles.cell}>
                      {kpi.metaDiariaOps !== null && (
                        <>
                          <div className={styles.label}>Ops. / día ({kpi.esMesActual ? 'Necesario' : 'Meta'})</div>
                          <div className={styles.value}>{Math.round(kpi.metaDiariaOps)}</div>
                          {kpi.opsPorDia !== null && <div className={styles.ritmo}>PROMEDIO: {Math.round(kpi.opsPorDia)}</div>}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              {kpi.ventaIdealFecha !== null && (
                <>
                  <div className={styles.divider} />
                  <div className={styles.idealBlock}>
                    <div className={styles.label}>Venta ideal a la fecha (K)</div>
                    <div className={styles.valueRow}>
                      <div className={styles.value}>{formatCurrency(kpi.ventaIdealFecha)}</div>
                      {(() => {
                        const diff = kpi.capital - kpi.ventaIdealFecha!;
                        return (
                          <span className={`${styles.delta} ${toneClass(diff >= 0)}`}>
                            {diff >= 0 ? '+' : '−'}{formatCurrency(Math.abs(diff))}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {showProy && (
            <div className={styles.panel}>
              <div className={styles.sectionTitle}>
                {kpi.esMesActual ? 'Proyección fin de mes' : 'Cierre del mes'}
              </div>

              <div className={`${styles.row} ${styles.rowProjection}`}>
                <div className={styles.cell}>
                  {kpi.proyCapital !== null && (
                    <>
                      <div className={styles.label}>{kpi.esMesActual ? 'Proy. fin mes (K)' : 'Final mes (K)'}</div>
                      <div className={styles.valueRow}>
                        <div className={`${styles.value} ${toneClass(kpi.proyCapital >= kpi.metaCapital)}`}>{formatCurrency(kpi.proyCapital)}</div>
                        {kpi.cumplProyCapital !== null && (
                          <span className={`${styles.delta} ${toneClass(kpi.cumplProyCapital >= 100)}`}>({kpi.cumplProyCapital.toFixed(2)}%)</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className={styles.cell}>
                  {kpi.proyOps !== null && (
                    <>
                      <div className={styles.label}>{kpi.esMesActual ? 'Proy. fin mes (Q)' : 'Final mes (Q)'}</div>
                      <div className={styles.valueRow}>
                        <div className={`${styles.value} ${toneClass(kpi.proyOps >= kpi.metaOps)}`}>{Math.round(kpi.proyOps)}</div>
                        {kpi.cumplProyOps !== null && (
                          <span className={`${styles.delta} ${toneClass(kpi.cumplProyOps >= 100)}`}>({kpi.cumplProyOps.toFixed(2)}%)</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.divider} />

              <div className={`${styles.row} ${styles.rowProjection}`}>
                <div className={styles.cell}>
                  {kpi.faltaCapital !== null && (
                    <>
                      <div className={styles.label}>Falta 100% (K)</div>
                      <div className={`${styles.value} ${toneClass(kpi.faltaCapital === 0)}`}>{formatCurrency(kpi.faltaCapital)}</div>
                    </>
                  )}
                </div>
                <div className={styles.cell}>
                  {kpi.faltaOps !== null && (
                    <>
                      <div className={styles.label}>Falta 100% (Q)</div>
                      <div className={`${styles.value} ${toneClass(kpi.faltaOps === 0)}`}>{Math.round(kpi.faltaOps || 0)}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
