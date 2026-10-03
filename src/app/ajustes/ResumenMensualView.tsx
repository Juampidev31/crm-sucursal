'use client';

import styles from './ResumenMensualView.module.css';
import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement
} from 'chart.js';
import { CONFIG } from '@/types';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cumplColor } from '@/lib/registro-stats';
import { Plus, Trash2, BarChart3, Users, TrendingUp, Activity, Shield, Target, FileText, Briefcase, PieChart, Tag, ChevronDown } from 'lucide-react';
import MetricasTab from './MetricasTab';
import NuevaSeccionSheets from '@/app/analistas/NuevaSeccionSheets';
import SeccionGraficosResumen from './SeccionGraficosResumen';
import DistBlock from '@/components/charts/DistBlock';
import { UI_FONT_FAMILY } from '@/app/fonts';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement);

// ── Plugin inline: data labels on bars ───────────────────────────────────
const labelsPlugin: any = {
  id: 'labelsPlugin',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    const isHorizontal = chart.config.options.indexAxis === 'y';
    const isStacked = chart.config.options.scales?.x?.stacked || chart.config.options.scales?.y?.stacked;

    chart.data.datasets.forEach((ds: any, dsIdx: number) => {
      const meta = chart.getDatasetMeta(dsIdx);
      if (!meta || meta.hidden || meta.type !== 'bar') return;

      ctx.save();
      ctx.fillStyle = '#344054';
      ctx.font = `700 11px ${UI_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = isStacked ? 'middle' : 'bottom';

      ctx.shadowColor = 'rgba(255,255,255,0.95)';
      ctx.shadowBlur = 4;

      const isPct = chart.config.options?._isPct === true;

      meta.data.forEach((bar: any, idx: number) => {
        const val = ds.data[idx];
        if (val === null || val === undefined || (val === 0 && !isPct)) return;

        let label = '';
        const v = Math.abs(val);

        if (isPct) {
          label = Math.round(val) + '%';
        } else if (v >= 1000) {
          label = Math.round(val).toLocaleString('es-AR');
        } else {
          label = (val < 10 && val > 0 && !Number.isInteger(val)) ? val.toFixed(1).replace('.', ',') : Math.round(val).toString();
        }

        if (isHorizontal) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bar.x + 6, bar.y);
        } else if (isStacked) {
          ctx.fillText(label, bar.x, bar.y + (bar.base - bar.y) / 2);
        } else {
          ctx.fillText(label, bar.x, bar.y - 7);
        }
      });
      ctx.restore();
    });
  },
};

// Dibuja líneas horizontales de referencia (objetivo) de extremo a extremo,
// necesario cuando hay una sola categoría (una línea de datos quedaría como un punto).
const referenceLinesPlugin: any = {
  id: 'referenceLinesPlugin',
  afterDraw(chart: any) {
    const { ctx, chartArea: { left, right }, scales } = chart;
    chart.data.datasets.forEach((dataset: any) => {
      if (dataset.horizontalReferenceValue !== undefined) {
        const yScale = scales[dataset.yAxisID || 'y'];
        if (!yScale) return;
        const yValue = yScale.getPixelForValue(dataset.horizontalReferenceValue);
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash(dataset.borderDash || []);
        ctx.lineWidth = dataset.borderWidth || 2;
        ctx.strokeStyle = dataset.borderColor || '#fff';
        ctx.moveTo(left, yValue);
        ctx.lineTo(right, yValue);
        ctx.stroke();
        ctx.restore();
      }
    });
  },
};

const baseChartOpts = (yLabel = '', horizontal = false, showLabels = false, showLegend = false, stacked = false): any => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: horizontal ? 'y' as const : 'x' as const,
  layout: { padding: { top: showLabels ? 50 : 20, bottom: 0 } },
  _isPct: yLabel.includes('%'),
  plugins: {
    legend: {
      display: showLegend,
      position: 'top' as const,
      align: 'end' as const,
      labels: { color: '#666', font: { size: 10 }, usePointStyle: true, padding: 10 }
    },
    tooltip: {
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      titleColor: '#ffffff',
      titleFont: { size: 18, weight: 700, family: UI_FONT_FAMILY },
      titleAlign: 'center' as const,
      titleMarginBottom: 16,
      bodyColor: '#f1f5f9',
      bodyFont: { size: 15, weight: 600, family: UI_FONT_FAMILY },
      bodySpacing: 10,
      borderColor: 'rgba(255,255,255,0.15)',
      borderWidth: 2,
      padding: 24,
      cornerRadius: 16,
      boxPadding: 8,
      usePointStyle: true,
    },
    datalabels: {
      display: showLabels,
      align: stacked ? 'center' as const : 'top' as const,
      anchor: stacked ? 'center' as const : 'end' as const,
      offset: stacked ? 0 : 12,
      color: '#fff',
      formatter: (v: any) => {
        if (v === 0 || v === undefined || v === null) return '';
        const n = Number(v);
        if (isNaN(n)) return v;
        if (yLabel.includes('%')) return n.toFixed(0) + '%';
        if (yLabel.includes('ops') || yLabel.includes('reg')) return n;
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
        return n;
      },
      font: { size: 10, weight: 700 }
    },
  },
  scales: {
    x: {
      stacked,
      ticks: {
        color: '#555', font: { size: 10 },
        maxRotation: 0, minRotation: 0, padding: 0, autoSkip: false,
        callback: function (this: any, val: any) {
          let label = this.getLabelForValue(val);
          if (label === undefined) label = val;
          if (horizontal) {
            const n = Number(label);
            if (isNaN(n)) return label;
            return (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n) + yLabel;
          }
          return label;
        }
      },
      grid: { display: false }, border: { display: false }
    },
    y: {
      stacked,
      ticks: {
        color: '#555', font: { size: 10 },
        precision: yLabel.includes('ops') || yLabel.includes('reg') ? 0 : undefined,
        callback: function (this: any, val: any) {
          const n = Number(val);
          if (isNaN(n)) return val;
          if (horizontal) return val;
          if (yLabel.includes('%')) return n.toFixed(0) + '%';
          if (n >= 1000) return n.toLocaleString('es-AR') + yLabel;
          return n + yLabel;
        }
      },
      grid: { color: 'rgba(255,255,255,0.06)' }, border: { display: false }, beginAtZero: true,
    },
  },
});

const tendBadge = (pct: number | null, showLabel = true) => {
  if (pct === null) return <span className={styles.liveStyle001}>—</span>;
  return (
    <div className={styles.liveStyle002}>
      {showLabel && <span className={styles.liveStyle003}>vs mes anterior</span>}
      <span className={styles.liveStyle004}>
        <span className={`report-trend-direction ${pct >= 0 ? 'is-positive' : 'is-negative'}`}>{pct >= 0 ? '▲' : '▼'}</span> {Math.abs(pct).toFixed(2)}%
      </span>
    </div>
  );
};

const ManualTextarea = ({ label, value, onChange, placeholder, readOnly }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean;
}) => (
  <div className={styles.liveStyle005}>
    <label className={styles.liveStyle006}>{label}</label>
    {readOnly ? (
      <div className={styles.liveStyle007} style={{ color: value ? '#ccc' : '#333' }}>
        {value || placeholder || '—'}
      </div>
    ) : (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? `${label}...`}
        rows={4}
        className={styles.liveStyle008}
      />
    )}
  </div>
);

interface PlanAccion {
  problema: string;
  accion: string;
  responsable: string;
  fecha: string;
}

interface ResumenTextos {
  logros: string;
  desvios: string;
  acciones_clave: string;
  gestiones_realizadas: string;
  coordinacion_salidas: string;
  empresas_estrategicas: string;
  analisis_comercial: string;
  dotacion: string;
  ausentismo: string;
  capacitacion: string;
  evaluacion_desempeno: string;
  operacion_procesos: string;
  experiencia_cliente: string;
  plan_acciones: PlanAccion[];
}

type DistItem = { label: string; monto: number; cantidad: number };

export interface ResumenMensualViewProps {
  readOnly?: boolean;
  // periodo
  selectedMes: number;
  selectedAnio: number;
  mesPrev: number;
  mesAntLabel: string;
  // colapsado
  collapsedSections: Record<number, boolean>;
  toggleSection: (id: number) => void;
  // KPIs / charts (pre-calculados)
  kpiTotal: any;
  chartCapitalVsObjetivo: any;
  chartAperturas: any;
  chartRenovaciones: any;
  chartTicketPromedio: any;
  // registros "safe" para sub-componentes
  registros: any[];
  ventasMes: any[];
  auditoriaData: { analista: string }[];
  // distribuciones
  periodoSec3: 'mensual' | 'total';
  setPeriodoSec3: (p: 'mensual' | 'total') => void;
  distAcuerdos: DistItem[]; distAcuerdosTotal: DistItem[];
  distCuotas: DistItem[]; distCuotasTotal: DistItem[];
  distRangoEtario: DistItem[]; distRangoEtarioTotal: DistItem[];
  distSexo: DistItem[]; distSexoTotal: DistItem[];
  distEmpleador: DistItem[]; distEmpleadorTotal: DistItem[];
  distLocalidad: DistItem[]; distLocalidadTotal: DistItem[];
  // textos del resumen
  resumen: ResumenTextos;
  setResumen: React.Dispatch<React.SetStateAction<any>>;
  // sección 10 (removida)
}

export default function ResumenMensualView(props: ResumenMensualViewProps) {
  const {
    readOnly = false,
    selectedMes, selectedAnio, mesPrev, mesAntLabel,
    collapsedSections, toggleSection,
    kpiTotal, chartCapitalVsObjetivo, chartAperturas, chartRenovaciones, chartTicketPromedio,
    registros, ventasMes, auditoriaData,
    periodoSec3, setPeriodoSec3,
    distAcuerdos, distAcuerdosTotal, distCuotas, distCuotasTotal,
    distRangoEtario, distRangoEtarioTotal, distSexo, distSexoTotal,
    distEmpleador, distEmpleadorTotal, distLocalidad, distLocalidadTotal,
    resumen, setResumen,
  } = props;

  const { nombres: analistasDefault } = useAnalistas();

  const sectionHeader = (id: number, title: string, icon: React.ReactNode) => {
    const isCollapsed = !!collapsedSections[id];
    return (
      <div className={styles.liveStyle009} style={{ marginBottom: isCollapsed ? 0 : 16, borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
        <div className={styles.liveStyle010}>
          {icon}
          <span className={styles.liveStyle011}>{title}</span>
        </div>
        {!readOnly && (
          <button
            onClick={() => toggleSection(id)}
            className={styles.liveStyle012} style={{ background: isCollapsed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)', color: isCollapsed ? '#555' : '#fff', boxShadow: isCollapsed ? 'none' : '0 0 15px rgba(255,255,255,0.05)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isCollapsed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = isCollapsed ? '#555' : '#fff';
            }}
          >
            <ChevronDown size={14} className={styles.liveStyle013} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div id="resumen-reporte-body" className={styles.liveStyle014}>
      {/* ── SECCIÓN 1: TABLERO ── */}
      <div className={`data-card ${styles.liveStyle015}`} >
        {sectionHeader(1, '1. Tablero', <BarChart3 size={15} color="#00d4ff" />)}
        {!collapsedSections[1] && (
          <>
          <div className={styles.liveStyle016}>
            <div className={styles.liveStyle017}>
              <div className={styles.liveStyle018}>Capital Vendido</div>
              <div className={styles.liveStyle019}>
                <div className={styles.liveStyle020}>{formatCurrency(kpiTotal.capital)}</div>
                {tendBadge(kpiTotal.tendCapital)}
              </div>
              <div className={styles.liveStyle021}>
                Meta: {kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}
              </div>
              {kpiTotal.cumplCapital !== null && (
                <div className={styles.liveStyle022}>
                  <span className={styles.liveStyle023} style={{ color: cumplColor(kpiTotal.cumplCapital) }}>●</span>
                  {kpiTotal.cumplCapital.toFixed(1)}% Cumpl.
                </div>
              )}
              <div className={styles.liveStyle024}>
                <div className={styles.liveStyle025}>
                  <div className={styles.liveStyle026}>Capital vs Objetivo</div>
                  <div className={styles.liveStyle027}>
                    <div className={styles.liveStyle028}>
                      <div className={styles.liveStyle029} />
                      <span className={styles.liveStyle030}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                    </div>
                    <div className={styles.liveStyle031}>
                      <div className={styles.liveStyle032} />
                      <span className={styles.liveStyle033}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                    </div>
                  </div>
                </div>
                <div id="chart-capital-objetivo" className={styles.liveStyle034}>
                  <Bar data={chartCapitalVsObjetivo as any} options={baseChartOpts('$', false, true, false)} plugins={[labelsPlugin, referenceLinesPlugin]} />
                </div>
              </div>
            </div>
            <div className={styles.liveStyle035}>
              <div className={styles.liveStyle036}>Operaciones</div>
              <div className={styles.liveStyle037}>
                <div className={styles.liveStyle038}>{kpiTotal.ops}</div>
                {tendBadge(kpiTotal.tendOps)}
              </div>
              <div className={styles.liveStyle039}>
                Meta: {kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}
              </div>
              {kpiTotal.cumplOps !== null && (
                <div className={styles.liveStyle040}>
                  <span className={styles.liveStyle041} style={{ color: cumplColor(kpiTotal.cumplOps) }}>●</span>
                  {kpiTotal.cumplOps.toFixed(1)}% Cumpl.
                </div>
              )}
              <div className={styles.liveStyle042}>
                <div className={styles.liveStyle043}>
                  <div className={styles.liveStyle044}>Aperturas vs Renovaciones</div>
                  <div className={styles.liveStyle045}>
                    <div className={styles.liveStyle046}>
                      <div className={styles.liveStyle047} />
                      <span className={styles.liveStyle048}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                    </div>
                    <div className={styles.liveStyle049}>
                      <div className={styles.liveStyle050} />
                      <span className={styles.liveStyle051}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.liveStyle052}>
                  <div className={styles.liveStyle053}>
                    <div className={styles.liveStyle054}>Aperturas</div>
                    <div id="chart-aperturas" className={styles.liveStyle055}>
                      <Bar data={chartAperturas} options={baseChartOpts(' ops', false, true, false, false)} plugins={[labelsPlugin]} />
                    </div>
                  </div>
                  <div className={styles.liveStyle056}>
                    <div className={styles.liveStyle057}>Renov.</div>
                    <div id="chart-renovaciones" className={styles.liveStyle058}>
                      <Bar data={chartRenovaciones} options={baseChartOpts(' ops', false, true, false, false)} plugins={[labelsPlugin]} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.liveStyle059}>
              <div className={styles.liveStyle060}>Ticket Promedio</div>
              <div className={styles.liveStyle061}>
                <div className={styles.liveStyle062}>{formatCurrency(kpiTotal.ticket)}</div>
                {tendBadge(kpiTotal.tendTicket)}
              </div>
              <div className={styles.liveStyle063}>
                <div className={styles.liveStyle064} title="Avance del pipeline: (Venta + Aprob. CC) / (Venta + Aprob. CC + Proyección + En seguimiento + Score bajo + Afectaciones + Rechaz. CC)">Conversión total: {(kpiTotal.conversionGlobal ?? 0).toFixed(1)}%</div>
                {tendBadge(kpiTotal.tendConversionGlobal, false)}
              </div>
              <div className={styles.liveStyle065}>
                <div className={styles.liveStyle066} title="Efectividad comercial: (Venta + Aprob. CC) / (Venta + Aprob. CC + Rechaz. CC)">Tasa de cierre (efectividad): {kpiTotal.conversion.toFixed(1)}%</div>
                {tendBadge(kpiTotal.tendConversion, false)}
              </div>
              <div className={styles.liveStyle067}>
                <div className={styles.liveStyle068}>{kpiTotal.clientes} clientes ingresados</div>
                {tendBadge(kpiTotal.tendClientes, false)}
              </div>
              <div className={styles.liveStyle069}>
                <div className={styles.liveStyle070}>
                  <div className={styles.liveStyle071}>Análisis vs {mesAntLabel}</div>
                  <div className={styles.liveStyle072}>
                    <div className={styles.liveStyle073}>
                      <div className={styles.liveStyle074} />
                      <span className={styles.liveStyle075}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                    </div>
                    <div className={styles.liveStyle076}>
                      <div className={styles.liveStyle077} />
                      <span className={styles.liveStyle078}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                    </div>
                  </div>
                </div>
                <div id="chart-ticket-promedio" className={styles.liveStyle079}>
                  <Bar data={chartTicketPromedio as any} options={baseChartOpts('$', false, true, false)} plugins={[labelsPlugin]} />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.liveStyle080}>
            {/* ── SECCIÓN GRÁFICOS ── */}
            <SeccionGraficosResumen
              kpiTotal={kpiTotal}
              selectedMes={selectedMes}
              selectedAnio={selectedAnio}
              allRegistros={registros}
            />
          </div>
          </>
        )}
      </div>

      {/* ── SECCIÓN 2: VENTAS POR CATEGORÍA ── */}
      <div className={`data-card ${styles.liveStyle081}`} >
        <div className={styles.liveStyle082}>
          <div className={styles.liveStyle083}>{sectionHeader(2, '2. Ventas por Categoría', <Tag size={15} color="#fb923c" />)}</div>
          {!collapsedSections[2] && (
            <div className={styles.liveStyle084}>
              <span className={styles.liveStyle085}>
                {periodoSec3 === 'mensual'
                  ? (() => {
                      const isVentaLocal = (r: any) => {
                        const e = (r.estado || '').toLowerCase().trim();
                        return e === 'venta' || e.includes('aprobado cc') || e.includes('derivado');
                      };
                      const v = ventasMes.filter(isVentaLocal);
                      return `MES: Solo Venta y Aprob. CC (${v.length} ops · ${formatCurrency(v.reduce((s, r) => s + (Number(r.monto) || 0), 0))})`;
                    })()
                  : `TOTAL: Todos los estados (${registros.length} ops · ${formatCurrency(registros.reduce((s, r) => s + (Number(r.monto) || 0), 0))})`}
              </span>
              <div className={styles.liveStyle086}>
                {(['mensual', 'total'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriodoSec3(p)}
                    className={styles.liveStyle087} style={{ background: periodoSec3 === p ? '#fb923c' : 'transparent', color: periodoSec3 === p ? '#000' : '#555' }}
                  >
                    {p === 'mensual' ? 'Mes' : 'Total'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {!collapsedSections[2] && (
          <div className={styles.liveStyle088}>
            {(() => {
              const isMensual = periodoSec3 === 'mensual';
              const fuente = isMensual ? ventasMes : registros;
              const base = fuente.reduce((s, r) => s + (Number(r.monto) || 0), 0);
              const ac = isMensual ? distAcuerdos : distAcuerdosTotal;
              const cu = isMensual ? distCuotas : distCuotasTotal;
              const re = isMensual ? distRangoEtario : distRangoEtarioTotal;
              const sx = isMensual ? distSexo : distSexoTotal;
              const em = isMensual ? distEmpleador : distEmpleadorTotal;
              const lo = isMensual ? distLocalidad : distLocalidadTotal;
              return (
                <>
                  <DistBlock titulo="Acuerdo" icon={<PieChart size={12} color="#ffaa00" />} datos={ac} color="#ffaa00" totalMes={base} />
                  <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#00d4ff" />} datos={cu} color="#00d4ff" totalMes={base} />
                  <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={re} color="#34d399" totalMes={base} />
                  <DistBlock titulo="Sexo" icon={<Users size={12} color="#b266ff" />} datos={sx} color="#b266ff" totalMes={base} />
                  <DistBlock titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={em} color="#fbbf24" totalMes={base} />
                  <DistBlock titulo="Localidad" icon={<FileText size={12} color="#a78bfa" />} datos={lo} color="#a78bfa" totalMes={base} />
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── SECCIÓN 3: DISTRIBUCIÓN POR ESTADO Y CATEGORÍAS ── */}
      <div className={`data-card ${styles.liveStyle089}`} >
        {sectionHeader(3, '3. Distribución por estado y categorías', <PieChart size={15} color="#00ff88" />)}
        {!collapsedSections[3] && (
          <div className={styles.liveStyle090}>
            <MetricasTab selectedMes={selectedMes} selectedAnio={selectedAnio} registros={registros} analista="PDV" analistas={analistasDefault} hideSelector reportAppearance />
            <NuevaSeccionSheets analista="PDV" reportAppearance />
          </div>
        )}
      </div>

      {/* ── SECCIÓN 4: ANÁLISIS COMERCIAL ── */}
      <div className={`data-card ${styles.liveStyle091}`} >
        {sectionHeader(4, '4. Análisis Comercial', <TrendingUp size={15} color="#34d399" />)}
        {!collapsedSections[4] && (
          <ManualTextarea
            label="Interpretación del Período"
            value={resumen.analisis_comercial}
            onChange={v => setResumen((p: any) => ({ ...p, analisis_comercial: v }))}
            placeholder="¿Por qué se vendió más o menos? Impacto de campañas, comportamiento del cliente, factores externos..."
            readOnly={readOnly}
          />
        )}
      </div>

      {/* ── SECCIÓN 5: OPERACIÓN Y PROCESOS ── */}
      <div className={`data-card ${styles.liveStyle092}`} >
        {sectionHeader(5, '5. Operación y Procesos', <Shield size={15} color="#818cf8" />)}
        {!collapsedSections[5] && (
          <ManualTextarea
            label="Cumplimiento de Procedimientos / Tiempos / Stock"
            value={resumen.operacion_procesos}
            onChange={v => setResumen((p: any) => ({ ...p, operacion_procesos: v }))}
            placeholder="Cumplimiento de procedimientos, tiempos de atención, stock de merchandising y flyers..."
            readOnly={readOnly}
          />
        )}
      </div>

      {/* ── SECCIÓN 6: GESTIÓN COMERCIAL ── */}
      <div className={`data-card ${styles.liveStyle093}`} >
        {sectionHeader(6, '6. Gestión Comercial', <Briefcase size={15} color="#34d399" />)}
        {!collapsedSections[6] && (
          <>
            <div className={styles.liveStyle094}>
              <ManualTextarea label="Gestiones Realizadas" value={resumen.gestiones_realizadas} onChange={v => setResumen((p: any) => ({ ...p, gestiones_realizadas: v }))} placeholder="Visitas, llamados, coordinaciones del período..." readOnly={readOnly} />
              <ManualTextarea label="Coordinación de Salidas" value={resumen.coordinacion_salidas} onChange={v => setResumen((p: any) => ({ ...p, coordinacion_salidas: v }))} placeholder="Salidas al campo, visitas programadas..." readOnly={readOnly} />
              <ManualTextarea label="Empresas Estratégicas" value={resumen.empresas_estrategicas} onChange={v => setResumen((p: any) => ({ ...p, empresas_estrategicas: v }))} placeholder="Empresas clave contactadas o visitadas..." readOnly={readOnly} />
            </div>
            <div className={styles.liveStyle095}>
              <ManualTextarea label="Principales Logros" value={resumen.logros} onChange={v => setResumen((p: any) => ({ ...p, logros: v }))} placeholder="Describí los principales logros del período..." readOnly={readOnly} />
              <ManualTextarea label="Principales Desvíos / Problemas" value={resumen.desvios} onChange={v => setResumen((p: any) => ({ ...p, desvios: v }))} placeholder="Describí los desvíos o problemas detectados..." readOnly={readOnly} />
              <ManualTextarea label="Acciones Clave a Seguir" value={resumen.acciones_clave} onChange={v => setResumen((p: any) => ({ ...p, acciones_clave: v }))} placeholder="Acciones prioritarias para el próximo período..." readOnly={readOnly} />
            </div>
          </>
        )}
      </div>

      {/* ── SECCIÓN 7: EXPERIENCIA DEL CLIENTE ── */}
      <div className={`data-card ${styles.liveStyle096}`} >
        {sectionHeader(7, '7. Experiencia del Cliente', <FileText size={15} color="#b266ff" />)}
        {!collapsedSections[7] && (
          <ManualTextarea
            label="Reclamos y Satisfacción"
            value={resumen.experiencia_cliente}
            onChange={v => setResumen((p: any) => ({ ...p, experiencia_cliente: v }))}
            placeholder="Cantidad y tipo de reclamos, nivel de satisfacción, problemas recurrentes..."
            readOnly={readOnly}
          />
        )}
      </div>

      {/* ── SECCIÓN 8: GESTIÓN DEL EQUIPO ── */}
      <div className={`data-card ${styles.liveStyle097}`} >
        {sectionHeader(8, '8. Gestión del Equipo', <Activity size={15} color="#fbbf24" />)}
        {!collapsedSections[8] && (
          <>
            {auditoriaData.length > 0 && (
              <div className={styles.liveStyle098}>
                <div className={styles.liveStyle099}>Actividad en Sistema</div>
                <div className={styles.liveStyle100}>
                  {analistasDefault.map(analista => {
                    const count = auditoriaData.filter(a => a.analista === analista).length;
                    return (
                      <div key={analista} className={styles.liveStyle101}>
                        <div className={styles.liveStyle102}>{analista}</div>
                        <div className={styles.liveStyle103}>{count}</div>
                        <div className={styles.liveStyle104}>acciones registradas</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className={styles.liveStyle105}>
              <ManualTextarea label="Dotación Actual" value={resumen.dotacion} onChange={v => setResumen((p: any) => ({ ...p, dotacion: v }))} readOnly={readOnly} />
              <ManualTextarea label="Ausentismo / Tardanzas" value={resumen.ausentismo} onChange={v => setResumen((p: any) => ({ ...p, ausentismo: v }))} readOnly={readOnly} />
              <ManualTextarea label="Capacitación Realizada" value={resumen.capacitacion} onChange={v => setResumen((p: any) => ({ ...p, capacitacion: v }))} readOnly={readOnly} />
              <ManualTextarea label="Evaluación de Desempeño" value={resumen.evaluacion_desempeno} onChange={v => setResumen((p: any) => ({ ...p, evaluacion_desempeno: v }))} readOnly={readOnly} />
            </div>
          </>
        )}
      </div>

      {/* ── SECCIÓN 9: PLAN DE ACCIÓN ── */}
      <div className={`data-card ${styles.liveStyle106}`} >
        {sectionHeader(9, '9. Plan de Acción', <Target size={15} color="#fb923c" />)}
        {!collapsedSections[9] && (
          <>
            <table className={styles.liveStyle107}>
              <thead>
                <tr>
                  {['Problema Detectado', 'Acción Concreta', 'Responsable', 'Fecha Ejecución', ...(readOnly ? [] : [''])].map(h => (
                    <th key={h} className={styles.liveStyle108}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.plan_acciones.map((fila, idx) => (
                  <tr key={idx} className={styles.liveStyle109}>
                    {(['problema', 'accion', 'responsable'] as const).map(campo => (
                      <td key={campo} className={styles.liveStyle110}>
                        {readOnly ? (
                          <div className={styles.liveStyle111}>{fila[campo] || '—'}</div>
                        ) : (
                          <input
                            value={fila[campo]}
                            onChange={e => {
                              const updated = resumen.plan_acciones.map((f, i) => i === idx ? { ...f, [campo]: e.target.value } : f);
                              setResumen((p: any) => ({ ...p, plan_acciones: updated }));
                            }}
                            placeholder={campo === 'problema' ? 'Describí el problema...' : campo === 'accion' ? 'Acción concreta...' : 'Responsable'}
                            className={styles.liveStyle112}
                          />
                        )}
                      </td>
                    ))}
                    <td className={styles.liveStyle113}>
                      {readOnly ? (
                        <div className={styles.liveStyle114}>{fila.fecha ? formatDate(fila.fecha) : '—'}</div>
                      ) : (
                        <input
                          type="date"
                          value={fila.fecha}
                          onChange={e => {
                            const updated = resumen.plan_acciones.map((f, i) => i === idx ? { ...f, fecha: e.target.value } : f);
                            setResumen((p: any) => ({ ...p, plan_acciones: updated }));
                          }}
                          className={styles.liveStyle115}
                        />
                      )}
                    </td>
                    {!readOnly && (
                      <td className={styles.liveStyle116}>
                        <button
                          onClick={() => setResumen((p: any) => ({ ...p, plan_acciones: p.plan_acciones.filter((_: any, i: number) => i !== idx) }))}
                          className={styles.liveStyle117}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239,68,68,0.06)';
                            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.12)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <Trash2 size={13} strokeWidth={2.5} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!readOnly && (
              <button
                onClick={() => setResumen((p: any) => ({ ...p, plan_acciones: [...p.plan_acciones, { problema: '', accion: '', responsable: '', fecha: '' }] }))}
                className={styles.liveStyle118}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = '#666';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Plus size={14} strokeWidth={2.5} /> Agregar fila
              </button>
            )}
          </>
        )}
      </div>

      {/* SECCIÓN 10 REMOVIDA PARA LA VISTA PÚBLICA */}
    </div>
  );
}
