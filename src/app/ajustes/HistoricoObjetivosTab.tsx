'use client';

import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { BarChart3, CalendarDays, Check, Copy, History, Save, Target, X } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import ModalPortal from '@/components/ModalPortal';
import { CONFIG } from '@/types';
import { formatCurrency } from '@/lib/utils';
import styles from './HistoricoObjetivosTab.module.css';

export type HistoricoObjetivosRow = {
  capital_real: string;
  ops_real: string;
  meta_ventas: string;
  meta_operaciones: string;
};

export type MonthlyObjectiveOverviewRow = {
  analyst: string;
  capitalGoal: number;
  capitalResult: number;
  operationsGoal: number;
  operationsResult: number;
  observations: string;
};

type EditableField = 'meta_ventas' | 'meta_operaciones';

const integerFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const MONTH_MODAL_ZOOM_KEY = 'crm_historico_objetivos_modal_zoom_v1';
const clampMonthModalZoom = (value: number) => Math.min(1.15, Math.max(.75, Math.round(value * 100) / 100));

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('No se pudo incrustar la tipografía'));
  reader.readAsDataURL(blob);
});

const getEmbeddedFontCss = async () => {
  const fontRules: { cssText: string; baseUrl: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule && /font-family:\s*["']?Outfit/i.test(rule.cssText)) {
          fontRules.push({ cssText: rule.cssText, baseUrl: sheet.href ?? window.location.href });
        }
      }
    } catch {
      // Las hojas externas que no permiten leer sus reglas no afectan este modal.
    }
  }

  return (await Promise.all(fontRules.map(async ({ cssText, baseUrl }) => {
    const sourceUrl = cssText.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!sourceUrl) return cssText;
    try {
      const response = await fetch(new URL(sourceUrl, baseUrl));
      if (!response.ok) return cssText;
      const dataUrl = await blobToDataUrl(await response.blob());
      return cssText.replace(/url\(["']?[^"')]+["']?\)/, `url("${dataUrl}")`);
    } catch {
      return cssText;
    }
  }))).join('\n');
};

const renderElementToPng = async (element: HTMLElement): Promise<Blob> => {
  const embeddedFontCssPromise = document.fonts.ready.then(getEmbeddedFontCss);
  const bounds = element.getBoundingClientRect();
  const width = Math.ceil(bounds.width);
  const height = Math.ceil(bounds.height);
  const clone = element.cloneNode(true) as HTMLElement;
  const sourceNodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];

  sourceNodes.forEach((source, index) => {
    const target = cloneNodes[index];
    if (!target) return;
    const computed = window.getComputedStyle(source);
    target.style.cssText = Array.from(computed)
      .map(property => `${property}:${computed.getPropertyValue(property)};`)
      .join('');
    target.style.animation = 'none';
    target.style.transition = 'none';
    target.style.caretColor = 'transparent';

    if (source instanceof HTMLTextAreaElement && target instanceof HTMLTextAreaElement) {
      target.value = source.value;
      target.textContent = source.value;
    } else if (source instanceof HTMLInputElement && target instanceof HTMLInputElement) {
      target.setAttribute('value', source.value);
    }
  });

  clone.style.margin = '0';
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.maxWidth = 'none';
  clone.style.maxHeight = 'none';
  clone.style.display = 'block';
  clone.style.gridTemplateRows = 'none';
  clone.style.zoom = '1';

  const embeddedFontCss = await embeddedFontCssPromise;
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${embeddedFontCss}</style>${serialized}</div></foreignObject></svg>`;
  const image = new Image();
  image.decoding = 'sync';
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('No se pudo generar la imagen del modal'));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la copia del modal');
  context.drawImage(image, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen PNG')), 'image/png');
  });
};

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
  monthlyOverview,
  saving,
  onAnalystChange,
  onYearChange,
  setRows,
  onSave,
  onSaveObservations,
}: {
  analysts: string[];
  analyst: string;
  year: number;
  rows: HistoricoObjetivosRow[];
  monthlyOverview: MonthlyObjectiveOverviewRow[][];
  saving: boolean;
  onAnalystChange: (value: string) => void;
  onYearChange: (value: number) => void;
  setRows: Dispatch<SetStateAction<HistoricoObjetivosRow[]>>;
  onSave: () => void;
  onSaveObservations: (monthIndex: number, observations: Record<string, string>) => void;
}) {
  const [monthModalIndex, setMonthModalIndex] = useState<number | null>(null);
  const [observationDrafts, setObservationDrafts] = useState<Record<string, string>>({});
  const [monthModalZoom, setMonthModalZoom] = useState(1);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const monthModalRef = useRef<HTMLElement | null>(null);
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

  const openMonth = (monthIndex: number) => {
    setMonthModalIndex(monthIndex);
    setCopyState('idle');
    setObservationDrafts(Object.fromEntries((monthlyOverview[monthIndex] ?? []).map(item => [item.analyst, item.observations])));
  };

  const modalOverview = monthModalIndex === null ? [] : monthlyOverview[monthModalIndex] ?? [];
  const modalPdv = modalOverview.find(row => row.analyst === 'PDV');

  const openCurrentMonth = () => {
    const now = new Date();
    openMonth(year === now.getFullYear() ? now.getMonth() : 0);
  };

  useEffect(() => {
    const storedZoom = Number(window.localStorage.getItem(MONTH_MODAL_ZOOM_KEY));
    if (Number.isFinite(storedZoom) && storedZoom > 0) setMonthModalZoom(clampMonthModalZoom(storedZoom));
  }, []);

  useEffect(() => {
    if (monthModalIndex === null) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setMonthModalZoom(previous => {
        const next = clampMonthModalZoom(previous + (event.deltaY < 0 ? .1 : -.1));
        window.localStorage.setItem(MONTH_MODAL_ZOOM_KEY, String(next));
        return next;
      });
    };

    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    return () => document.removeEventListener('wheel', handleWheel, true);
  }, [monthModalIndex]);

  const copyModal = async () => {
    const modal = monthModalRef.current;
    if (!modal || !window.ClipboardItem || !navigator.clipboard?.write) {
      setCopyState('error');
      return;
    }

    try {
      const png = renderElementToPng(modal);
      setCopyState('copying');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch (error) {
      console.error('Error copiando el modal:', error);
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2500);
    }
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
          <button className={styles.monthButton} type="button" onClick={openCurrentMonth}>
            <CalendarDays size={14} /> Objetivo mensual
          </button>
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

      {monthModalIndex !== null && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setMonthModalIndex(null)}>
            <section
              ref={monthModalRef}
              className={`modal-content ${styles.monthModal}`}
              style={{
                '--month-modal-zoom': monthModalZoom,
                maxHeight: `calc(${100 / monthModalZoom}vh - ${32 / monthModalZoom}px)`,
              } as CSSProperties}
              onClick={event => event.stopPropagation()}
              aria-modal="true"
              role="dialog"
              aria-labelledby="monthly-objective-title"
              title="Usá Ctrl + rueda para ajustar el tamaño"
            >
              <header className={styles.monthModalHeader}>
                <div>
                  <span>Objetivos del mes</span>
                  <h3 id="monthly-objective-title">PDV y analistas · {year}</h3>
                </div>
                <button className={`btn-icon ${styles.monthModalClose}`} type="button" onClick={() => setMonthModalIndex(null)} aria-label="Cerrar"><X size={17} /></button>
              </header>

              <div className={styles.monthModalBody}>
                <div className={`${styles.selectWrap} ${styles.monthSelector}`}>
                  <CustomSelect
                    value={monthModalIndex}
                    onChange={value => openMonth(Number(value))}
                    options={CONFIG.MESES_NOMBRES.map((label, value) => ({ label, value }))}
                    width="100%"
                  />
                </div>

                <div className={styles.monthOverview}>
                  <div className={styles.monthOverviewHeader}><span>Equipo</span><span>Capital</span><span>Operaciones</span><span>Observaciones</span></div>
                  {modalOverview.map(item => {
                    const capitalCompliance = item.capitalGoal > 0 ? (item.capitalResult / item.capitalGoal) * 100 : null;
                    const operationsCompliance = item.operationsGoal > 0 ? (item.operationsResult / item.operationsGoal) * 100 : null;
                    const capitalDistribution = (modalPdv?.capitalGoal ?? 0) > 0 ? (item.capitalGoal / modalPdv!.capitalGoal) * 100 : null;
                    const operationsDistribution = (modalPdv?.operationsGoal ?? 0) > 0 ? (item.operationsGoal / modalPdv!.operationsGoal) * 100 : null;
                    return (
                      <article className={`${styles.monthOverviewRow}${item.analyst === 'PDV' ? ` ${styles.monthOverviewTotal}` : ''}`} key={item.analyst}>
                        <div className={styles.monthOverviewAnalyst}><strong>{item.analyst}</strong><span>{item.analyst === 'PDV' ? 'Total sucursal' : 'Analista'}</span></div>
                        <div className={styles.monthOverviewMetric}>
                          <span>Objetivo</span><strong>{item.capitalGoal > 0 ? formatCurrency(item.capitalGoal) : '—'}</strong>
                          <small>Venta: {item.capitalResult > 0 ? formatCurrency(item.capitalResult) : '—'}</small>
                          <i>Distribución: {capitalDistribution === null ? '—' : `${capitalDistribution.toFixed(1)}%`}</i>
                          <b className={`${styles.complianceBadge} ${complianceClass(capitalCompliance)}`}>{capitalCompliance === null ? '—' : `${capitalCompliance.toFixed(1)}%`}</b>
                        </div>
                        <div className={styles.monthOverviewMetric}>
                          <span>Objetivo</span><strong>{item.operationsGoal > 0 ? integerFormatter.format(item.operationsGoal) : '—'}</strong>
                          <small>Operaciones: {item.operationsResult > 0 ? integerFormatter.format(item.operationsResult) : '—'}</small>
                          <i>Distribución: {operationsDistribution === null ? '—' : `${operationsDistribution.toFixed(1)}%`}</i>
                          <b className={`${styles.complianceBadge} ${complianceClass(operationsCompliance)}`}>{operationsCompliance === null ? '—' : `${operationsCompliance.toFixed(1)}%`}</b>
                        </div>
                        <label className={styles.monthObservation}>
                          <span>Observaciones</span>
                          <textarea value={observationDrafts[item.analyst] ?? ''} onChange={event => setObservationDrafts(previous => ({ ...previous, [item.analyst]: event.target.value }))} placeholder="Agregar una observación del mes…" rows={2} />
                        </label>
                      </article>
                    );
                  })}
                </div>
              </div>

              <footer className={styles.monthModalFooter}>
                <button type="button" className={styles.copyButton} onClick={copyModal} disabled={copyState === 'copying'}>
                  {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                  {copyState === 'copying' ? 'Copiando…' : copyState === 'copied' ? 'Copiado' : copyState === 'error' ? 'No se pudo copiar' : 'Copiar'}
                </button>
                <button type="button" className={styles.cancelButton} onClick={() => setMonthModalIndex(null)}>Cerrar</button>
                <button type="button" className={styles.saveButton} onClick={() => onSaveObservations(monthModalIndex, observationDrafts)} disabled={saving}><Save size={14} />{saving ? 'Guardando…' : 'Guardar observaciones'}</button>
              </footer>
            </section>
          </div>
        </ModalPortal>
      )}
    </section>
  );
}
