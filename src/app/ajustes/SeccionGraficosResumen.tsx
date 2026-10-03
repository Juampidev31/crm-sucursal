import React, { useMemo } from 'react';
import { CONFIG } from '@/types';
import { filterByMonth, isVenta } from '@/lib/registro-stats';

type DistributionItem = { label: string; value: number; color: string };

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

function ProgressMetric({ label, value, color }: { label: string; value: number; color: string }) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return (
    <div className="monthly-insight-metric">
      <div className="monthly-insight-metric__head">
        <span>{label}</span>
        <strong>{safeValue.toFixed(1)}%</strong>
      </div>
      <div className="monthly-insight-track"><span style={{ width: `${clampPct(safeValue)}%`, background: color }} /></div>
    </div>
  );
}

function VariationMetric({ label, value }: { label: string; value: number | null | undefined }) {
  const safeValue = value ?? 0;
  const positive = safeValue >= 0;
  return (
    <div className="monthly-variation-item">
      <span>{label}</span>
      <strong className={positive ? 'is-positive' : 'is-negative'}>{positive ? '▲' : '▼'} {Math.abs(safeValue).toFixed(1)}%</strong>
      <small>vs. mes anterior</small>
    </div>
  );
}

function DistributionList({ items }: { items: DistributionItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="monthly-distribution-list">
      {items.map(item => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div className="monthly-distribution-row" key={item.label}>
            <div className="monthly-distribution-row__head">
              <span><i style={{ background: item.color }} />{item.label}</span>
              <b>{item.value} <small>{percentage.toFixed(0)}%</small></b>
            </div>
            <div className="monthly-insight-track"><span style={{ width: `${percentage}%`, background: item.color }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export default function SeccionGraficosResumen({ kpiTotal, selectedMes, selectedAnio, allRegistros }: {
  kpiTotal: any;
  selectedMes: number;
  selectedAnio: number;
  allRegistros: any[];
}) {
  const mesPrev = selectedMes === 1 ? 12 : selectedMes - 1;
  const mesAntLabel = CONFIG.MESES_NOMBRES[mesPrev - 1];

  const { acuerdos, empleos } = useMemo(() => {
    const ventas = filterByMonth(allRegistros, selectedMes, selectedAnio).filter(isVenta);
    const publicKeywords = ['municipio', 'municip', 'provincia', 'hospital', 'escuela', 'público', 'gobierno', 'estado', 'policia', 'policía', 'nación', 'nacional', 'ministerio', 'judicial', 'fuerzas'];
    const agreementItems: DistributionItem[] = [
      { label: 'Premium', value: 0, color: '#4f8272' },
      { label: 'Riesgo medio', value: 0, color: '#607da8' },
      { label: 'Riesgo bajo', value: 0, color: '#bd893e' },
      { label: 'No califica', value: 0, color: '#a85d68' },
    ];
    const employmentItems: DistributionItem[] = [
      { label: 'Público', value: 0, color: '#4f8272' },
      { label: 'Privado', value: 0, color: '#607da8' },
      { label: 'Sin dato', value: 0, color: '#99aab8' },
    ];

    for (const registro of ventas) {
      const acuerdo = String(registro.acuerdo_precios ?? '').toLowerCase();
      if (acuerdo.includes('premium')) agreementItems[0].value++;
      else if (acuerdo.includes('medio')) agreementItems[1].value++;
      else if (acuerdo.includes('bajo')) agreementItems[2].value++;
      else if (acuerdo.includes('no califica') || acuerdo === 'n/c') agreementItems[3].value++;

      const empleador = String(registro.empleador ?? '').toLowerCase().trim();
      if (!empleador || empleador === 'sin dato') employmentItems[2].value++;
      else if (publicKeywords.some(keyword => empleador.includes(keyword))) employmentItems[0].value++;
      else employmentItems[1].value++;
    }
    return { acuerdos: agreementItems, empleos: employmentItems };
  }, [allRegistros, selectedMes, selectedAnio]);

  return (
    <div className="monthly-insight-grid">
      <section className="monthly-insight-card">
        <header><div><span className="monthly-insight-eyebrow">Objetivos</span><h3>Cumplimiento del mes</h3></div><span className="monthly-insight-period">vs. {mesAntLabel}</span></header>
        <div className="monthly-insight-body">
          <ProgressMetric label="Capital" value={kpiTotal.cumplCapital ?? 0} color="#4f8272" />
          <ProgressMetric label="Operaciones" value={kpiTotal.cumplOps ?? 0} color="#607da8" />
        </div>
      </section>
      <section className="monthly-insight-card">
        <header><div><span className="monthly-insight-eyebrow">Evolución</span><h3>Variación mensual</h3></div></header>
        <div className="monthly-variation-grid">
          <VariationMetric label="Capital" value={kpiTotal.tendCapital} />
          <VariationMetric label="Operaciones" value={kpiTotal.tendOps} />
        </div>
      </section>
      <section className="monthly-insight-card">
        <header><div><span className="monthly-insight-eyebrow">Composición</span><h3>Acuerdos</h3></div><strong className="monthly-insight-total">{acuerdos.reduce((sum, item) => sum + item.value, 0)} ops</strong></header>
        <DistributionList items={acuerdos} />
      </section>
      <section className="monthly-insight-card">
        <header><div><span className="monthly-insight-eyebrow">Cartera</span><h3>Tipo de empleo</h3></div><strong className="monthly-insight-total">{empleos.reduce((sum, item) => sum + item.value, 0)} ops</strong></header>
        <DistributionList items={empleos} />
      </section>
    </div>
  );
}
