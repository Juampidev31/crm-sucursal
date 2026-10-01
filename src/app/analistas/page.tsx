'use client';

import styles from './AnalistasPage.module.css';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDeferredMount, ChartShimmer } from '@/components/ChartShimmer';
import { CONFIG } from '@/types';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { formatCurrency } from '@/lib/utils';
import { tasaCierrePct, conversionTotalPct } from '@/lib/kpi-cierre';
import { calcularDiasHabilesMes } from '@/lib/dias-habiles';
import { useObjetivos } from '@/features/objetivos/ObjetivosProvider';
import { useSettings, useAnalistas } from '@/features/settings/SettingsProvider';
import { useAuth } from '@/context/AuthContext';
import { BarChart3, Users, Activity, Shield, Target, FileText, PieChart, Tag, ChevronLeft, ChevronRight, Calculator, DollarSign, X, Clock, Trash2 } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement, Filler
} from 'chart.js';
import MetricasTab from '@/app/ajustes/MetricasTab';
import CustomSelect from '@/components/CustomSelect';
import ModalPortal from '@/components/ModalPortal';
import NuevaSeccionSheets from './NuevaSeccionSheets';
import { filterByMonth, isVenta, emptyTiposAcuerdo, matchTipoAcuerdo, buildDistEmpleador, distPor } from '@/lib/registro-stats';
import ModernDoughnut from '@/components/charts/ModernDoughnut';
import DistBlock from '@/components/charts/DistBlock';
import ProyeccionCard from './ProyeccionCard';
import { UI_FONT_FAMILY } from '@/app/fonts';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement, Filler);
ChartJS.defaults.font.family = UI_FONT_FAMILY;

// ─ Plugin inline: sombreado para líneas ─
const lineShadowPlugin: any = {
  id: 'lineShadowPlugin',
  beforeDatasetDraw(chart: any, args: any) {
    const { ctx } = chart;
    ctx.save();
    if (args.index === 0) {
      ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
    } else if (args.index === 1) {
      ctx.shadowColor = 'rgba(251, 146, 60, 0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }
  },
  afterDatasetDraw(chart: any) {
    chart.ctx.restore();
  }
};

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

      // Shadow for readability
      ctx.shadowColor = 'rgba(255,255,255,0.95)';
      ctx.shadowBlur = 4;

      // Detección de porcentaje: solo mediante flag explícito
      const isPct = chart.config.options?._isPct === true;

      meta.data.forEach((bar: any, idx: number) => {
        const val = ds.data[idx];
        if (val === null || val === undefined || (val === 0 && !isPct)) return;

        let label = '';
        const v = Math.abs(val);

        if (isPct) {
          label = Math.round(val) + '%';
        } else if (v >= 1_000_000) {
          label = (val / 1_000_000).toFixed(1).replace('.', ',') + 'M';
        } else if (v >= 1000) {
          label = (val / 1000).toFixed(0) + 'K';
        } else {
          // Redondear a 1 decimal si es < 10, sino entero
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
 
// ── Plugin inline: líneas de referencia horizontales (Meta/Objetivo) ─────
const referenceLinesPlugin: any = {
  id: 'referenceLinesPlugin',
  afterDraw(chart: any) {
    const { ctx, chartArea: { left, right }, scales } = chart;
    
    chart.data.datasets.forEach((dataset: any) => {
      if (dataset.horizontalReferenceValue !== undefined) {
        const yAxisID = dataset.yAxisID || 'y';
        const yScale = scales[yAxisID];
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
        
        // Etiqueta opcional
        if (dataset.showLabelOnLine) {
          ctx.fillStyle = dataset.borderColor;
          ctx.font = `700 9px ${UI_FONT_FAMILY}`;
          ctx.textAlign = 'right';
          ctx.fillText(dataset.label, right - 5, yValue - 5);
        }
        
        ctx.restore();
      }
    });
  }
};
 
import { useSearchParams } from 'next/navigation';

const now = new Date();

const cumplColor = (pct: number | null) =>
  pct === null ? '#64748b' : pct >= 100 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#f87171';

export default function AnalistasPage() {
  const { registros: allRegistros, loading } = useRegistros();
  const { objetivos } = useObjetivos();
  const { diasConfig, feriados, diasTranscurridosAuto } = useSettings();
  const { nombres: analistasDefault, cobraIncentivo } = useAnalistas();
  const { isAdmin } = useAuth();
  
  const searchParams = useSearchParams();
  const [analista, setAnalista] = useState<string>('PDV');

  useEffect(() => {
    const queryAnalista = searchParams?.get('analista');
    if (queryAnalista) {
      setAnalista(queryAnalista);
    } else {
      setAnalista('PDV');
    }
  }, [searchParams]);

  const chartsLoaded = useDeferredMount();
  const esVistaGlobal = analista === 'PDV' || analista === 'PROYECTADOS';

  const registros = useMemo(() => {
    return esVistaGlobal ? allRegistros : allRegistros.filter(r => r.analista === analista);
  }, [allRegistros, analista, esVistaGlobal]);

  const analistasParaMostrar = esVistaGlobal ? analistasDefault : [analista];
  const chartLabels = useMemo(() => {
    if (analista === 'PDV') {
      return ['TOTAL GENERAL'];
    }
    return ['INDIVIDUAL'];
  }, [analista]);

  const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(now.getFullYear());
  // Selector independiente de la sección 4 (Distribución por Estado)
  const [sec4Mes, setSec4Mes] = useState<string>(String(now.getMonth() + 1).padStart(2, '0'));
  const [sec4Anio, setSec4Anio] = useState<number>(now.getFullYear());
  const [periodoSec3, setPeriodoSec3] = useState<'mensual' | 'total'>('mensual');
  const [periodoAcuerdos, setPeriodoAcuerdos] = useState<'mensual' | 'total'>('mensual');
  const [periodoEmpleo, setPeriodoEmpleo] = useState<'mensual' | 'total'>('mensual');
  const [rendimiento12MOpen, setRendimiento12MOpen] = useState(false);
  const [incentivosModalOpen, setIncentivosModalOpen] = useState(false);
  const [anioRendimiento, setAnioRendimiento] = useState<number | 'TODOS'>(now.getFullYear());
  const [mesRendimiento, setMesRendimiento] = useState<number | 'TODOS'>('TODOS');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [proyShowActual, setProyShowActual] = useState(true);
  const [proyShowProy, setProyShowProy] = useState(true);

  const aniosDisponiblesRendimiento = useMemo(() => {
    const set = new Set<number>();
    for (const r of registros) {
      const y = r.fecha?.slice(0, 4);
      if (y) set.add(Number(y));
    }
    for (const o of objetivos) set.add(o.anio);
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [registros, objetivos]);

  const mesesAnioKQ = useMemo(() => {
    const buckets: { key: string; mes0: number; anio: number; label: string; monto: number; ops: number; metaK: number; metaQ: number }[] = [];
    
    const aniosToInclude = anioRendimiento === 'TODOS' ? aniosDisponiblesRendimiento.slice().sort((a,b) => a - b) : [anioRendimiento];
    const mesesToInclude = mesRendimiento === 'TODOS' ? Array.from({length: 12}, (_, i) => i) : [mesRendimiento as number];

    for (const y of aniosToInclude) {
      for (const m of mesesToInclude) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        buckets.push({ 
           key, 
           mes0: m, 
           anio: y, 
           label: anioRendimiento === 'TODOS' ? `${CONFIG.MESES_NOMBRES[m]} ${y}` : CONFIG.MESES_NOMBRES[m], 
           monto: 0, ops: 0, metaK: 0, metaQ: 0 
        });
      }
    }

    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const r of registros) {
      if (!(r.estado?.toLowerCase() === 'venta' || r.estado?.toLowerCase().includes('aprobado cc'))) continue;
      const k = r.fecha?.slice(0, 7);
      if (!k) continue;
      const i = idx.get(k);
      if (i === undefined) continue;
      buckets[i].monto += Number(r.monto) || 0;
      buckets[i].ops += 1;
    }
    for (const b of buckets) {
      const obj = objetivos.find(o => o.analista === analista && o.mes === b.mes0 && o.anio === b.anio);
      b.metaK = obj?.meta_ventas ?? 0;
      b.metaQ = obj?.meta_operaciones ?? 0;
    }
    return buckets;
  }, [registros, objetivos, analista, anioRendimiento, mesRendimiento, aniosDisponiblesRendimiento]);

  // ── Persistencia de cobranzas manuales por analista y período ─────────────
  const [cobranzasStore, setCobranzasStore] = useState<Record<string, { pctTr90?: string | number; pctTr120?: string | number; pctRefin?: string | number }>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('crm_manual_cobranzas_v1');
      if (saved) {
        setCobranzasStore(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error cargando cobranzas manuales de localStorage:', e);
    }
  }, []);

  const getCobranzasForAnalista = useCallback((nombreAnalista: string, anio: number, mes: number) => {
    const keyWithPeriod = `${anio}-${String(mes).padStart(2, '0')}_${nombreAnalista}`;
    if (cobranzasStore[keyWithPeriod]) {
      return cobranzasStore[keyWithPeriod];
    }
    if (cobranzasStore[nombreAnalista]) {
      return cobranzasStore[nombreAnalista];
    }
    return { pctTr90: '', pctTr120: '', pctRefin: '' };
  }, [cobranzasStore]);

  const currentCobranzas = useMemo(() => {
    return getCobranzasForAnalista(analista, selectedAnio, selectedMes);
  }, [getCobranzasForAnalista, analista, selectedAnio, selectedMes]);

  const handleManualCobChange = (key: 'pctTr90' | 'pctTr120' | 'pctRefin', val: string) => {
    const keyWithPeriod = `${selectedAnio}-${String(selectedMes).padStart(2, '0')}_${analista}`;

    setCobranzasStore(prev => {
      const current = prev[keyWithPeriod] || prev[analista] || { pctTr90: '', pctTr120: '', pctRefin: '' };
      const updated = { ...current, [key]: val };

      const hasAnyValue = (updated.pctTr90 !== undefined && updated.pctTr90 !== '' && Number(updated.pctTr90) !== 0) ||
                          (updated.pctTr120 !== undefined && updated.pctTr120 !== '' && Number(updated.pctTr120) !== 0) ||
                          (updated.pctRefin !== undefined && updated.pctRefin !== '' && Number(updated.pctRefin) !== 0) ||
                          (val !== '' && val !== undefined);

      const nextStore = { ...prev };
      if (!hasAnyValue) {
        delete nextStore[keyWithPeriod];
        delete nextStore[analista];
      } else {
        nextStore[keyWithPeriod] = updated;
        nextStore[analista] = updated;
      }

      try {
        localStorage.setItem('crm_manual_cobranzas_v1', JSON.stringify(nextStore));
      } catch (err) {
        console.error('Error guardando cobranzas manuales en localStorage:', err);
      }

      return nextStore;
    });
  };

  const handleClearManualCob = () => {
    const keyWithPeriod = `${selectedAnio}-${String(selectedMes).padStart(2, '0')}_${analista}`;
    setCobranzasStore(prev => {
      const nextStore = { ...prev };
      delete nextStore[keyWithPeriod];
      delete nextStore[analista];
      try {
        localStorage.setItem('crm_manual_cobranzas_v1', JSON.stringify(nextStore));
      } catch (err) {
        console.error('Error borrando cobranzas manuales en localStorage:', err);
      }
      return nextStore;
    });
  };

  const tendBadge = (pct: number | null, showLabel = true) => {
    if (pct === null) return <span className={[styles.uColor64748b].join(' ')}>—</span>;
    const color = pct >= 0 ? 'var(--brand-muted)' : '#f87171';
    return (
      <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap6px].join(' ')}>
        {showLabel && <span className={[styles.uFontSize9px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-5px"], styles.uWhiteSpacenowrap].join(' ')}>vs mes anterior</span>}
        <span className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-strong"], styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uPadding2px-6px"], styles.uBorderRadius4px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap3px, styles.uMinWidth60px, styles.uJustifyContentcenter].join(' ')}>
        <span style={{ color: color }}>{pct >= 0 ? '▲' : '▼'}</span> {Math.abs(pct).toFixed(2)}%
        </span>
      </div>
    );
  };

  const sectionHeader = (id: number, title: string, icon: React.ReactNode, extra?: React.ReactNode) => {
    return (
      <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom16px, styles.uPaddingBottom10px, styles["uBorderBottom1px-solid-border-subtle"], styles.uGap12px, styles.uUserSelectnone].join(' ')}
      >
        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap10px].join(' ')}>
          {icon}
          <span className={[styles.uFontSize13px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px].join(' ')}>{title}</span>
          {extra}
        </div>
      </div>
    );
  };

  const mesPrev = selectedMes === 1 ? 12 : selectedMes - 1;
  const anioPrev = selectedMes === 1 ? selectedAnio - 1 : selectedAnio;

  // ── KPI por analista ──────────────────────────────────────────────────────
  const kpiPorAnalista = useMemo(() => {
    return analistasParaMostrar.map(analista => {
      const regsAnalista = filterByMonth(registros, selectedMes, selectedAnio).filter(r => r.analista === analista);
      const ventas = regsAnalista.filter(isVenta);
      const capital = ventas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const ops = ventas.length;
      // Tasa de cierre (efectividad) y conversión total del embudo — fórmula centralizada
      const conversion = tasaCierrePct(regsAnalista) ?? 0;
      const conversionGlobal = conversionTotalPct(regsAnalista) ?? 0;

      // Monto venta y Aprob CC por separado
      const montoVenta = regsAnalista
        .filter(r => (r.estado ?? '').toLowerCase() === 'venta')
        .reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const montoAprobCC = regsAnalista
        .filter(r => (r.estado ?? '').toLowerCase().includes('aprobado cc'))
        .reduce((s, r) => s + (Number(r.monto) || 0), 0);

      // Objetivo.mes es 0-indexed (0 = Enero)
      const obj = objetivos.find(o => o.analista === analista && o.mes === selectedMes - 1 && o.anio === selectedAnio);
      const metaCapital = obj?.meta_ventas ?? 0;
      const metaOps = obj?.meta_operaciones ?? 0;
      const cumplCapital = metaCapital > 0 ? (capital / metaCapital) * 100 : null;
      const restanteCapital = metaCapital > 0 ? Math.max(0, 100 - (capital / metaCapital) * 100) : null;
      const cumplOps = metaOps > 0 ? (ops / metaOps) * 100 : null;
      const restanteOps = metaOps > 0 ? Math.max(0, 100 - (ops / metaOps) * 100) : null;

      const ventasAnt = filterByMonth(registros, mesPrev, anioPrev).filter(r => r.analista === analista).filter(isVenta);
      const capitalAnt = ventasAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const opsAnt = ventasAnt.length;
      const tendCapital = capitalAnt > 0 ? ((capital - capitalAnt) / capitalAnt) * 100 : null;
      const tendOps = opsAnt > 0 ? ((ops - opsAnt) / opsAnt) * 100 : null;

      // Proyección a fin de mes — usa días hábiles cargados manualmente por admin (/ajustes)
      const hoy = new Date();
      const esMesActual = selectedMes === (hoy.getMonth() + 1) && selectedAnio === hoy.getFullYear();
      const cfgDias = diasConfig.find(d => d.analista === analista);
      const diasHabilesAdmin = cfgDias?.dias_habiles ?? 0;
      const diasTransAdmin = cfgDias?.dias_transcurridos ?? 0;
      const tieneDiasAdmin = diasHabilesAdmin > 0;

      // Ticket promedio y ritmo: en el día 1 antes de las 19:30 hs usa 1 como divisor provisional si ya hay ventas
      const diasDivisor = diasTransAdmin > 0 ? diasTransAdmin : (capital > 0 ? 1 : 0);
      const ticket = diasDivisor > 0 ? capital / diasDivisor : 0;

      const diasRestantes = Math.max(0, diasHabilesAdmin - diasTransAdmin);
      const ventaPorDia = diasDivisor > 0 ? capital / diasDivisor : null;
      const opsPorDia = diasTransAdmin > 0 ? ops / diasTransAdmin : (ops > 0 ? ops / 1 : null);
      
      // La meta diaria se calcula como lo que falta para llegar dividido los días restantes
      // Si ya pasó el mes o no hay días cargados, se usa la meta lineal original
      const metaDiariaCapital = (esMesActual && tieneDiasAdmin && diasRestantes > 0)
        ? Math.max(0, metaCapital - capital) / diasRestantes
        : (tieneDiasAdmin ? metaCapital / diasHabilesAdmin : null);
      
      const metaDiariaOps = (esMesActual && tieneDiasAdmin && diasRestantes > 0)
        ? Math.max(0, metaOps - ops) / diasRestantes
        : (tieneDiasAdmin ? metaOps / diasHabilesAdmin : null);

      const proyCapital = (esMesActual && tieneDiasAdmin && ventaPorDia !== null) ? ventaPorDia * diasHabilesAdmin : (esMesActual ? null : capital);
      const proyOps = (esMesActual && tieneDiasAdmin && opsPorDia !== null) ? opsPorDia * diasHabilesAdmin : (esMesActual ? null : ops);
      const faltaCapital = metaCapital > 0 ? Math.max(0, metaCapital - capital) : null;
      const faltaOps = metaOps > 0 ? Math.max(0, metaOps - ops) : null;

      const cumplProyCapital = metaCapital > 0 ? (proyCapital !== null ? (proyCapital / metaCapital) * 100 : null) : null;
      const cumplProyOps = metaOps > 0 ? (proyOps !== null ? (proyOps / metaOps) * 100 : null) : null;

      // Cálculo de incentivos (analistas con incentivo)
      const tieneIncentivo = cobraIncentivo(analista);
      
      let coefCap = 0;
      let coefOps = 0;
      let incentivoCap = 0;
      let incentivoOps = 0;
      let topeKQAplicado = false;
      let topeKQExcedente = 0;

      if (tieneIncentivo) {
        if (cumplCapital !== null) {
          if (cumplCapital >= 120) coefCap = 0.0045;
          else if (cumplCapital >= 110) coefCap = 0.0037;
          else if (cumplCapital >= 90) coefCap = 0.0030;
          else if (cumplCapital >= 75) coefCap = 0.0020;
        }
        
        if (cumplOps !== null && cumplCapital !== null && cumplCapital >= 75) {
          if (cumplOps >= 100) coefOps = 0.0030;
          else if (cumplOps >= 80) coefOps = 0.0020;
        }

        const incentivoCapVariable = capital * coefCap;
        incentivoCap = incentivoCapVariable + 21470;
        
        // El incentivo de operaciones es un % del incentivo de capital VARIABLE (sin los 21470)
        incentivoOps = incentivoCapVariable * (coefOps === 0.0030 ? 0.30 : (coefOps === 0.0020 ? 0.20 : 0));

        // Tope máximo de $200,000 para Ventas (K y Q)
        const totalKQ = incentivoCap + incentivoOps;
        if (totalKQ > 200000) {
          topeKQAplicado = true;
          topeKQExcedente = totalKQ - 200000;
          const factor = 200000 / totalKQ;
          incentivoCap = incentivoCap * factor;
          incentivoOps = incentivoOps * factor;
        }
      }

      // ── Incentivos de Cobranzas ──────────────────────────────────────────────
      let incentivoCobTr90 = 0, incentivoCobTr120 = 0, incentivoCobRefin = 0;
      let pctTr90 = 0, pctTr120 = 0, pctRefin = 0;

      if (cobraIncentivo(analista)) {
        const cob = getCobranzasForAnalista(analista, selectedAnio, selectedMes);
        pctTr90 = parseFloat(String(cob.pctTr90 ?? 0)) || 0;
        pctTr120 = parseFloat(String(cob.pctTr120 ?? 0)) || 0;
        pctRefin = parseFloat(String(cob.pctRefin ?? 0)) || 0;

        // Tramo 90-119
        if (pctTr90 >= 100) incentivoCobTr90 = 16667;
        else if (pctTr90 >= 90) incentivoCobTr90 = 12643;

        // Tramo 120-209
        if (pctTr120 >= 100) incentivoCobTr120 = 16667;
        else if (pctTr120 >= 90) incentivoCobTr120 = 12643;

        // Refinanciacion
        if (pctRefin >= 110) incentivoCobRefin = 16667;
        else if (pctRefin >= 90) incentivoCobRefin = 12643;

        // Tope máximo de $50,000 para Cobranzas
        const totalCobranzas = incentivoCobTr90 + incentivoCobTr120 + incentivoCobRefin;
        if (totalCobranzas > 50000) {
          const factorCob = 50000 / totalCobranzas;
          incentivoCobTr90 = incentivoCobTr90 * factorCob;
          incentivoCobTr120 = incentivoCobTr120 * factorCob;
          incentivoCobRefin = incentivoCobRefin * factorCob;
        }
      }

      const incentivoTotal = incentivoCap + incentivoOps + incentivoCobTr90 + incentivoCobTr120 + incentivoCobRefin;

      return {
        analista, capital, ops, ticket, conversion, conversionGlobal, metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps, tendCapital, tendOps,
        clientesIngresados: regsAnalista.length,
        montoVenta,
        montoAprobCC,
        ventaPorDia, opsPorDia, metaDiariaCapital, metaDiariaOps, proyCapital, proyOps, faltaCapital, faltaOps, esMesActual,
        diasHabilesAdmin, diasTransAdmin, tieneDiasAdmin, diasRestantes,
        cumplProyCapital, cumplProyOps,
        coefCap, coefOps, incentivoCap, incentivoOps,
        topeKQAplicado, topeKQExcedente,
        incentivoCobTr90, incentivoCobTr120, incentivoCobRefin,
        pctTr90, pctTr120, pctRefin,
        incentivoTotal
      };
    });
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev, diasConfig, cobranzasStore, analista, analistasParaMostrar, cobraIncentivo, getCobranzasForAnalista]);

  // ── KPI total ─────────────────────────────────────────────────────────────
  const kpiTotal = useMemo(() => {
    // Total usa el entry 'Todos' como fuente canonica; fallback al max sobre analistas si no existe
    const cfgTodos = diasConfig.find(d => d.analista === 'Todos');
    const diasTransMes = cfgTodos
      ? (Number(cfgTodos.dias_transcurridos) || 0)
      : Math.max(0, ...diasConfig.map(d => Number(d.dias_transcurridos) || 0));
    const regs = filterByMonth(registros, selectedMes, selectedAnio);
    const ventas = regs.filter(isVenta);
    const capital = ventas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const ops = ventas.length;
    // Ticket promedio = total vendido (Venta + Aprob. CC) / dias transcurridos
    const ticket = diasTransMes > 0 ? capital / diasTransMes : 0;
    const clientes = regs.length;
    // Tasa de cierre (efectividad) y conversión total del embudo — fórmula centralizada
    const conversion = tasaCierrePct(regs) ?? 0;
    const conversionGlobal = conversionTotalPct(regs) ?? 0;

    const montoVenta = regs
      .filter(r => (r.estado ?? '').toLowerCase() === 'venta')
      .reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const montoAprobCC = regs
      .filter(r => (r.estado ?? '').toLowerCase().includes('aprobado cc'))
      .reduce((s, r) => s + (Number(r.monto) || 0), 0);

    const ventasAnt = filterByMonth(registros, mesPrev, anioPrev).filter(isVenta);
    const regsAnt = filterByMonth(registros, mesPrev, anioPrev);
    const capitalAnt = ventasAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const opsAnt = ventasAnt.length;
    const ticketAnt = diasTransMes > 0 ? capitalAnt / diasTransMes : 0;
    const clientesAnt = regsAnt.length;
    const conversionAnt = tasaCierrePct(regsAnt) ?? 0;
    const conversionGlobalAnt = conversionTotalPct(regsAnt) ?? 0;

    const tendCapital = capitalAnt > 0 ? ((capital - capitalAnt) / capitalAnt) * 100 : null;
    const tendOps = opsAnt > 0 ? ((ops - opsAnt) / opsAnt) * 100 : null;
    const tendTicket = ticketAnt > 0 ? ((ticket - ticketAnt) / ticketAnt) * 100 : null;
    const tendClientes = clientesAnt > 0 ? ((clientes - clientesAnt) / clientesAnt) * 100 : null;
    const tendConversion = conversionAnt > 0 ? ((conversion - conversionAnt) / conversionAnt) * 100 : null;
    const tendConversionGlobal = conversionGlobalAnt > 0 ? ((conversionGlobal - conversionGlobalAnt) / conversionGlobalAnt) * 100 : null;

    const analistaObjetivo = analista === 'PROYECTADOS' ? 'PDV' : analista;
    const obj = objetivos.find(o => o.analista === analistaObjetivo && o.mes === selectedMes - 1 && o.anio === selectedAnio);
    const metaCapital = obj?.meta_ventas ?? 0;
    const metaOps = obj?.meta_operaciones ?? 0;
    const cumplCapital = metaCapital > 0 ? (capital / metaCapital) * 100 : null;
    const restanteCapital = metaCapital > 0 ? Math.max(0, 100 - (capital / metaCapital) * 100) : null;
    const cumplOps = metaOps > 0 ? (ops / metaOps) * 100 : null;
    const restanteOps = metaOps > 0 ? Math.max(0, 100 - (ops / metaOps) * 100) : null;

    const hoy = new Date();
    const esMesActual = selectedMes === (hoy.getMonth() + 1) && selectedAnio === hoy.getFullYear();
    const cfgDias = esVistaGlobal
      ? diasConfig.find(d => d.analista === 'Todos')
      : diasConfig.find(d => d.analista === analista);
    const diasHabilesAdmin = cfgDias?.dias_habiles ?? 0;
    const diasTransAdmin = cfgDias?.dias_transcurridos ?? 0;
    const tieneDiasAdmin = diasHabilesAdmin > 0;
    const diasRestantes = Math.max(0, diasHabilesAdmin - diasTransAdmin);
    const diasDivisor = diasTransAdmin > 0 ? diasTransAdmin : (capital > 0 ? 1 : 0);
    const ventaPorDia = diasDivisor > 0 ? capital / diasDivisor : null;
    const opsPorDia = diasTransAdmin > 0 ? ops / diasTransAdmin : (ops > 0 ? ops / 1 : null);
    // (I) x Venta = total del campo Interés de las ventas; Productividad (%) = Interés / Monto otorgado × 100
    const interesXVenta = ventas.reduce((s, r) => s + (Number(r.interes) || 0), 0);
    const productividad = capital > 0 ? (interesXVenta / capital) * 100 : null;
    // Desglose por tipo de cliente (cada uno con su propio Interés / Monto)
    const ventasApertura = ventas.filter(r => (r.tipo_cliente ?? '').toLowerCase() === 'apertura');
    const ventasRenov = ventas.filter(r => (r.tipo_cliente ?? '').toLowerCase().startsWith('renov'));
    const montoApertura = ventasApertura.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const montoRenov = ventasRenov.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const interesApertura = ventasApertura.reduce((s, r) => s + (Number(r.interes) || 0), 0);
    const interesRenov = ventasRenov.reduce((s, r) => s + (Number(r.interes) || 0), 0);
    const productividadApertura = montoApertura > 0 ? (interesApertura / montoApertura) * 100 : null;
    const productividadRenov = montoRenov > 0 ? (interesRenov / montoRenov) * 100 : null;

    const metaDiariaCapital = (esMesActual && tieneDiasAdmin && diasRestantes > 0)
      ? Math.max(0, metaCapital - capital) / diasRestantes
      : (tieneDiasAdmin ? metaCapital / diasHabilesAdmin : null);
      
    const metaDiariaOps = (esMesActual && tieneDiasAdmin && diasRestantes > 0)
      ? Math.max(0, metaOps - ops) / diasRestantes
      : (tieneDiasAdmin ? metaOps / diasHabilesAdmin : null);

    const proyCapital = (esMesActual && tieneDiasAdmin && ventaPorDia !== null) ? ventaPorDia * diasHabilesAdmin : (esMesActual ? null : capital);
    const proyOps = (esMesActual && tieneDiasAdmin && opsPorDia !== null) ? opsPorDia * diasHabilesAdmin : (esMesActual ? null : ops);
    const faltaCapital = metaCapital > 0 ? Math.max(0, metaCapital - capital) : null;
    const faltaOps = metaOps > 0 ? Math.max(0, metaOps - ops) : null;

    const cumplProyCapital = metaCapital > 0 ? (proyCapital !== null ? (proyCapital / metaCapital) * 100 : null) : null;
    const cumplProyOps = metaOps > 0 ? (proyOps !== null ? (proyOps / metaOps) * 100 : null) : null;

    // ── Mes anterior a la misma fecha (comparación acumulada al mismo día) ────
    // Día de corte: hoy si es el mes en curso, sino el último día con datos del mes seleccionado
    const diaCorte = esMesActual
      ? hoy.getDate()
      : (regs.reduce((max, r) => Math.max(max, Number(r.fecha?.slice(8, 10)) || 0), 0)
         || new Date(selectedAnio, selectedMes, 0).getDate());
    const ventasAntFecha = ventasAnt.filter(r => (Number(r.fecha?.slice(8, 10)) || 0) <= diaCorte);
    const capitalAntFecha = ventasAntFecha.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const opsAntFecha = ventasAntFecha.length;
    const varCapitalFecha = capitalAntFecha > 0 ? ((capital - capitalAntFecha) / capitalAntFecha) * 100 : null;
    const varOpsFecha = opsAntFecha > 0 ? ((ops - opsAntFecha) / opsAntFecha) * 100 : null;

    // Cálculo de incentivos global - Suma de individuales (Solo Luciana y Victoria)
    const incentivoCap = kpiPorAnalista.reduce((s, k) => s + (k.incentivoCap || 0), 0);
    const incentivoOps = kpiPorAnalista.reduce((s, k) => s + (k.incentivoOps || 0), 0);
    
    // Cobranzas Total (Suma de analistas con incentivo)
    const incentivoCobTr90 = kpiPorAnalista.reduce((s, k) => s + (k.incentivoCobTr90 || 0), 0);
    const incentivoCobTr120 = kpiPorAnalista.reduce((s, k) => s + (k.incentivoCobTr120 || 0), 0);
    const incentivoCobRefin = kpiPorAnalista.reduce((s, k) => s + (k.incentivoCobRefin || 0), 0);

    const incentivoTotal = incentivoCap + incentivoOps + incentivoCobTr90 + incentivoCobTr120 + incentivoCobRefin;

    return {
      analista: 'PDV',
      capital, ops, ticket, conversion, conversionGlobal, clientes, tendCapital, tendOps, tendTicket, tendClientes, tendConversion, tendConversionGlobal,
      metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps, montoVenta, montoAprobCC,
      clientesIngresados: clientes,
      ventaPorDia, opsPorDia, metaDiariaCapital, metaDiariaOps, proyCapital, proyOps, faltaCapital, faltaOps, esMesActual,
      interesXVenta, productividad, productividadApertura, productividadRenov,
      diasHabilesAdmin, diasTransAdmin, tieneDiasAdmin, diasRestantes,
      cumplProyCapital, cumplProyOps,
      diaCorte, capitalAntFecha, opsAntFecha, varCapitalFecha, varOpsFecha,
      coefCap: 0, coefOps: 0, incentivoCap, incentivoOps,
      topeKQAplicado: kpiPorAnalista.some(k => k.topeKQAplicado),
      topeKQExcedente: kpiPorAnalista.reduce((s, k) => s + (k.topeKQExcedente || 0), 0),
      incentivoCobTr90, incentivoCobTr120, incentivoCobRefin,
      incentivoTotal
    };
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev, diasConfig, analista, kpiPorAnalista]);

  // ── Días restantes del período para el badge en Tablero ───────────────────
  const diasRestantesCalculados = useMemo(() => {
    const hoy = new Date();
    const esMesActual = selectedMes === (hoy.getMonth() + 1) && selectedAnio === hoy.getFullYear();
    const esMesPasado = selectedAnio < hoy.getFullYear() || (selectedAnio === hoy.getFullYear() && selectedMes < (hoy.getMonth() + 1));

    if (esMesPasado) {
      return 0;
    }

    const cfgDias = esVistaGlobal
      ? diasConfig.find(d => d.analista === 'Todos')
      : diasConfig.find(d => d.analista === analista);

    const diasHabilesAdmin = cfgDias?.dias_habiles ?? 0;
    const diasTransAdmin = cfgDias?.dias_transcurridos ?? 0;

    if (diasHabilesAdmin > 0) {
      if (esMesActual) {
        return Math.max(0, diasHabilesAdmin - diasTransAdmin);
      }
      return diasHabilesAdmin;
    }

    // Fallback con cálculo automático oficial
    const diasHabilesAuto = calcularDiasHabilesMes(selectedAnio, selectedMes, feriados || []);
    if (esMesActual) {
      return Math.max(0, diasHabilesAuto - (diasTranscurridosAuto ?? 0));
    }
    return diasHabilesAuto;
  }, [selectedMes, selectedAnio, esVistaGlobal, diasConfig, analista, feriados, diasTranscurridosAuto]);

  const badgeDiasRestantes = useMemo(() => {
    const num = diasRestantesCalculados;
    const displayNum = num % 1 === 0 ? num : num.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const texto = num === 1 ? `${displayNum} día restante` : `${displayNum} días restantes`;

    return (
      <div className={[styles["uDisplayinline-flex"], styles.uAlignItemscenter, styles.uGap6px, styles["uPadding3px-10px"], styles.uBorderRadius8px, styles.uBackgrounde8f1f7, styles["uBorder1px-solid-9db7c8"], styles.uColor355f78, styles.uFontSize11px, styles.uFontWeight800, styles["uLetterSpacing0-4px"], styles.uFontFamilyUi, styles["uBoxShadow0-2px-7px-rgba-53-95-120-0-12"], styles.uTextTransformnone].join(' ')}
        title={`Días hábiles restantes: ${texto}`}
      >
        <Clock className={[styles.uColor477a98].join(' ')} size={12} strokeWidth={2.5} />
        <span>{texto}</span>
      </div>
    );
  }, [diasRestantesCalculados]);

  // ── Distribución acuerdo de precios ──────────────────────────────────────
  const distribucionAcuerdos = useMemo(() => {
    const tipos = emptyTiposAcuerdo();
    for (const r of filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta)) {
      const matched = matchTipoAcuerdo(r.acuerdo_precios ?? '', r.estado ?? '', true);
      if (matched) {
        tipos[matched].monto += Number(r.monto) || 0;
        tipos[matched].cantidad += 1;
      }
    }
    return tipos;
  }, [registros, selectedMes, selectedAnio]);

  // ── Distribuciones demográficas (ventas del mes) ─────────────────────────
  const ventasMes = useMemo(() =>
    filterByMonth(registros, selectedMes, selectedAnio),
    [registros, selectedMes, selectedAnio]
  );

  // `ventasMes.filter(isVenta)` se recalculaba 5 veces seguidas sobre la misma
  // colección (una por distribución). Se resuelve una sola vez y se comparte.
  const ventasMesEfectivas = useMemo(() => ventasMes.filter(isVenta), [ventasMes]);

  const distEmpleador = useMemo(() => buildDistEmpleador(ventasMesEfectivas), [ventasMesEfectivas]);

  const distCuotas = useMemo(() => distPor('cuotas', ventasMesEfectivas), [ventasMesEfectivas]);
  const distRangoEtario = useMemo(() => distPor('rango_etario', ventasMesEfectivas), [ventasMesEfectivas]);
  const distSexo = useMemo(() => distPor('sexo', ventasMesEfectivas), [ventasMesEfectivas]);
  const distLocalidad = useMemo(() => distPor('localidad', ventasMesEfectivas), [ventasMesEfectivas]);
  const distAcuerdos = useMemo(() => {
    return Object.entries(distribucionAcuerdos)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [distribucionAcuerdos]);

  // ── Distribuciones totales (todos los registros) ──────────────────────────
  const distCuotasTotal = useMemo(() => distPor('cuotas', registros.filter(isVenta)), [registros]);
  const distRangoEtarioTotal = useMemo(() => distPor('rango_etario', registros), [registros]);
  const distSexoTotal = useMemo(() => distPor('sexo', registros), [registros]);
  const distLocalidadTotal = useMemo(() => distPor('localidad', registros), [registros]);
  const distEmpleadorTotal = useMemo(() => buildDistEmpleador(registros), [registros]);
  const distAcuerdosTotal = useMemo(() => {
    const tipos = emptyTiposAcuerdo();
    for (const r of registros) {
      const matched = matchTipoAcuerdo(r.acuerdo_precios ?? '', r.estado ?? '', isVenta(r));
      if (matched) { tipos[matched].monto += Number(r.monto) || 0; tipos[matched].cantidad += 1; }
    }
    return Object.entries(tipos).map(([label, data]) => ({ label, ...data })).sort((a, b) => b.cantidad - a.cantidad);
  }, [registros]);

  // ── Distribuciones mes anterior ───────────────────────────────────────────
  const ventasMesAnt = useMemo(() =>
    filterByMonth(registros, mesPrev, anioPrev),
    [registros, mesPrev, anioPrev]
  );

  // ── Config base de gráficos (dark theme) ─────────────────────────────────
  const mesActualLabel = CONFIG.MESES_NOMBRES[selectedMes - 1].slice(0, 3);
  const mesAntLabel = CONFIG.MESES_NOMBRES[mesPrev - 1].slice(0, 3);

  // Helper: gradient
  const getGradient = (context: any, colorStart: string, colorEnd: string) => {
    const chart = context.chart;
    const { ctx, chartArea } = chart;
    if (!chartArea) return null;
    const horizontal = chart.config.options.indexAxis === 'y';
    const gradient = horizontal 
      ? ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
      : ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
  };

  const baseChartOpts = (yLabel = '', horizontal = false, showLabels = false, showLegend = false, stacked = false, hideXLabels = false): any => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' as const : 'x' as const,
    layout: { padding: { top: showLabels ? 50 : 20, bottom: 0 } },
    _isPct: yLabel.includes('%'), // Flag explícito para el plugin
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
        align: 'end' as const,
        labels: { color: '#475467', font: { size: 10, weight: 700 }, usePointStyle: true, padding: 10 }
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
        align: stacked ? 'center' as const : (horizontal ? 'right' as const : 'top' as const),
        anchor: stacked ? 'center' as const : 'end' as const,
        offset: stacked ? 0 : (horizontal ? 6 : 12),
        color: '#344054',
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
    categoryPercentage: 0.85,
    barPercentage: 0.9,
    scales: {
      x: {
        display: !hideXLabels,
        stacked,
        ticks: {
          display: !hideXLabels,
          color: '#555', font: { size: 10 },
          maxRotation: 0, minRotation: 0, padding: 0, autoSkip: horizontal, maxTicksLimit: horizontal ? 6 : undefined,
          callback: function (this: any, val: any) {
            let label = this.getLabelForValue(val);
            if (label === undefined) label = val;
            if (horizontal) {
              const n = Number(val);
              if (isNaN(n)) return label;
              const compact = n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n;
              return yLabel.includes('$') ? `$ ${compact}` : `${compact}${yLabel}`;
            }
            return label;
          }
        },
        grid: { color: 'rgba(255,255,255,0.03)' }
      },
      y: {
        stacked,
        ticks: {
          color: '#555', font: { size: 10 },
          callback: function (this: any, val: any) {
            let label = this.getLabelForValue(val);
            if (label === undefined) label = val;
            if (!horizontal) {
              const n = Number(label);
              if (isNaN(n)) return label;
              return (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n) + yLabel;
            }
            return label;
          }
        },
        grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true,
      },
    },
  });

  // Helper: línea de referencia 100%
  const refLine100 = (n: number, yAxisID?: string) => ({
    type: 'line' as const,
    label: 'Meta 100%',
    data: Array(n).fill(100),
    horizontalReferenceValue: 100,
    borderColor: '#b86b6b',
    borderWidth: 1.5,
    borderDash: [5, 4],
    pointRadius: 0,
    fill: false,
    order: 0,
    yAxisID,
  });

  // ── Datos gráfico cumplimiento por analista ───────────────────────────────
  // Card unificada: en Vista Global usa el consolidado (kpiTotal); en vista de analista usa el individual
  const kpiCards = useMemo(
    () => (esVistaGlobal ? [kpiTotal] : kpiPorAnalista),
    [esVistaGlobal, kpiTotal, kpiPorAnalista]
  );

  const analistaIndividualKpi = useMemo(() => {
    if (analista === 'PDV' || !cobraIncentivo(analista)) return null;
    return kpiCards.find(k => k.analista === analista) || kpiCards[0] || null;
  }, [analista, cobraIncentivo, kpiCards]);

  const chartCumplimiento = useMemo(() => {
    const labels = kpiCards.map(k => k.analista);
    return {
      labels,
      datasets: [
        {
          label: `Capital ${mesActualLabel}`,
          data: kpiCards.map(k => k.cumplCapital ?? 0),
          backgroundColor: (context: any) => getGradient(context, 'rgba(95, 146, 127, 0.08)', 'rgba(95, 146, 127, 0.82)'),
          borderColor: '#4f8272',
          borderWidth: 0,
          borderRadius: 4, order: 1,
        },
        {
          label: `Capital ${mesAntLabel}`,
          data: kpiCards.map(k => {
            const antRegs = filterByMonth(registros, mesPrev, anioPrev);
            const ant = (k.analista === 'PDV' ? antRegs : antRegs.filter(r => r.analista === k.analista)).filter(isVenta);
            const capitalAnt = ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
            const objAnt = objetivos.find(o => o.analista === k.analista && o.mes === mesPrev - 1 && o.anio === anioPrev);
            return objAnt?.meta_ventas ? (capitalAnt / objAnt.meta_ventas) * 100 : 0;
          }),
          backgroundColor: (context: any) => getGradient(context, 'rgba(71, 85, 105, 0.12)', 'rgba(71, 85, 105, 0.72)'),
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 0,
          borderRadius: 4, order: 1,
        },
        {
          label: `Ops ${mesActualLabel}`,
          data: kpiCards.map(k => k.cumplOps ?? 0),
          backgroundColor: (context: any) => getGradient(context, 'rgba(85, 120, 139, 0.08)', 'rgba(85, 120, 139, 0.82)'),
          borderColor: '#55788b',
          borderWidth: 0,
          borderRadius: 4, order: 1,
        },
        {
          label: `Ops ${mesAntLabel}`,
          data: kpiCards.map(k => {
            const antRegs = filterByMonth(registros, mesPrev, anioPrev);
            const ant = (k.analista === 'PDV' ? antRegs : antRegs.filter(r => r.analista === k.analista)).filter(isVenta);
            const opsAnt = ant.length;
            const objAnt = objetivos.find(o => o.analista === k.analista && o.mes === mesPrev - 1 && o.anio === anioPrev);
            return objAnt?.meta_operaciones ? (opsAnt / objAnt.meta_operaciones) * 100 : 0;
          }),
          backgroundColor: (context: any) => getGradient(context, 'rgba(71, 85, 105, 0.12)', 'rgba(71, 85, 105, 0.72)'),
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 0,
          borderRadius: 4, order: 1, // Purpura oscuro
        },
        refLine100(labels.length),
      ],
    };
  }, [kpiCards, registros, objetivos, mesPrev, anioPrev, mesActualLabel, mesAntLabel]);

  // ── Chart 1: Capital vs Objetivo ──────────────────────────────────────────
  const chartCapitalVsObjetivo = useMemo(() => {
    const labels = chartLabels;
    const isSingle = labels.length === 1;

    const isPDV = analista === 'PDV';

    const capitalAct = isPDV ? [kpiTotal.capital] : kpiPorAnalista.map(k => k.capital);

    const capitalAnt = isPDV
      ? [filterByMonth(allRegistros, mesPrev, anioPrev).filter(isVenta).reduce((s, r) => s + (Number(r.monto) || 0), 0)]
      : kpiPorAnalista.map(k => {
          const ant = filterByMonth(allRegistros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
          return ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
        });

    const objetivo = isPDV ? [kpiTotal.metaCapital || 0] : kpiPorAnalista.map(k => k.metaCapital || 0);

    return {
      labels,
      datasets: [
        { label: `Capital ${mesActualLabel}`, data: capitalAct, backgroundColor: (context: any) => getGradient(context, 'rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.85)'), borderColor: '#10b981', borderWidth: 0, borderRadius: 4, order: 2, maxBarThickness: 100 },
        { label: `Capital ${mesAntLabel}`, data: capitalAnt, backgroundColor: (context: any) => getGradient(context, 'rgba(71, 85, 105, 0.12)', 'rgba(71, 85, 105, 0.72)'), borderColor: '#64748b', borderWidth: 1, borderRadius: 4, order: 2, maxBarThickness: 100 },
        { 
          type: 'line' as const, label: 'Objetivo ($)', data: objetivo, borderColor: '#f87171', borderWidth: 2, borderDash: [5, 4], pointRadius: 0, fill: false, order: 1,
          horizontalReferenceValue: isSingle ? objetivo[0] : undefined 
        },
      ],
    };
  }, [chartLabels, kpiPorAnalista, kpiTotal, allRegistros, mesPrev, anioPrev, mesActualLabel, mesAntLabel, analista]);

  // ── Chart 2: Ticket Promedio ──────────────────────────────────────────────
  const chartTicketPromedio = useMemo(() => {
    const labels = chartLabels;
    const isPDV = analista === 'PDV';

    const ticketAct = isPDV ? [kpiTotal.ticket] : kpiPorAnalista.map(k => k.ticket);

    const ticketAnt = isPDV
      ? (() => {
          const vAnt = filterByMonth(allRegistros, mesPrev, anioPrev).filter(isVenta);
          return [vAnt.length > 0 ? vAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0) / vAnt.length : 0];
        })()
      : kpiPorAnalista.map(k => {
          const ant = filterByMonth(allRegistros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
          const cap = ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
          return ant.length > 0 ? cap / ant.length : 0;
        });

    return {
      labels,
      datasets: [
        { label: `Ticket ${mesActualLabel}`, data: ticketAct, backgroundColor: (context: any) => getGradient(context, 'rgba(245, 158, 11, 0.05)', 'rgba(245, 158, 11, 0.85)'), borderColor: '#f59e0b', borderWidth: 0, borderRadius: 4, maxBarThickness: 100 },
        { label: `Ticket ${mesAntLabel}`, data: ticketAnt, backgroundColor: (context: any) => getGradient(context, 'rgba(71, 85, 105, 0.12)', 'rgba(71, 85, 105, 0.72)'), borderColor: '#64748b', borderWidth: 1, borderRadius: 4, maxBarThickness: 100 },
      ],
    };
  }, [chartLabels, kpiPorAnalista, kpiTotal, allRegistros, mesPrev, anioPrev, mesActualLabel, mesAntLabel, analista]);

  // ── Chart 4: Variación % vs mes anterior ─────────────────────────────────
  const chartVariacion = useMemo(() => {
    const isGlobal = analista === 'PDV';
    const labels = isGlobal ? ['TOTAL GENERAL'] : ['INDIVIDUAL'];
    
    const capitalVar = isGlobal ? [kpiTotal.tendCapital ?? 0] : [kpiPorAnalista[0]?.tendCapital ?? 0];
    const opsVar = isGlobal ? [kpiTotal.tendOps ?? 0] : [kpiPorAnalista[0]?.tendOps ?? 0];

    return {
      labels,
      datasets: [
        { 
          label: 'Variación Capital %', 
          data: capitalVar, 
          backgroundColor: capitalVar.map(v => v >= 0 ? 'rgba(95, 146, 127, 0.28)' : 'rgba(184, 107, 107, 0.16)'),
          borderColor: capitalVar.map(v => v >= 0 ? 'rgba(95, 146, 127, 0.65)' : 'rgba(184, 107, 107, 0.55)'),
          borderWidth: 1.5,
          borderRadius: 4, 
          maxBarThickness: 100 
        },
        { 
          label: 'Variación Ops %', 
          data: opsVar, 
          backgroundColor: opsVar.map(v => v >= 0 ? 'rgba(96, 125, 168, 0.35)' : 'rgba(184, 107, 107, 0.2)'),
          borderColor: opsVar.map(v => v >= 0 ? 'rgba(96, 125, 168, 0.7)' : 'rgba(184, 107, 107, 0.55)'),
          borderWidth: 1.5,
          borderRadius: 4, 
          maxBarThickness: 100 
        },
      ],
    };
  }, [kpiPorAnalista, kpiTotal, analista]);

  // ── Chart 7: Aperturas vs Renovaciones ───────────────────────────────────
  const apertVsRenData = useMemo(() => {
    const allVentas = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);
    const allAnt = ventasMesAnt.filter(isVenta);
    return {
      porAnalista: analistasParaMostrar.map(analista => {
        const v = allVentas.filter(r => r.analista === analista);
        return { analista, aperturas: v.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: v.filter(r => r.tipo_cliente === 'Renovacion').length };
      }),
      porAnalistaAnt: analistasParaMostrar.map(analista => {
        const v = allAnt.filter(r => r.analista === analista);
        return { analista, aperturas: v.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: v.filter(r => r.tipo_cliente === 'Renovacion').length };
      }),
      total: { aperturas: allVentas.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: allVentas.filter(r => r.tipo_cliente === 'Renovacion').length },
      ant: { aperturas: allAnt.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: allAnt.filter(r => r.tipo_cliente === 'Renovacion').length },
    };
  }, [registros, selectedMes, selectedAnio, ventasMesAnt]);

  const chartProgreso = useMemo(() => {
    const regsMes = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);
    
    const daysInMonth = new Date(selectedAnio, selectedMes, 0).getDate();
    const today = new Date();
    const isCurrentMonth = selectedMes === (today.getMonth() + 1) && selectedAnio === today.getFullYear();
    const isFutureMonth = selectedAnio > today.getFullYear() || (selectedAnio === today.getFullYear() && selectedMes > (today.getMonth() + 1));
    const maxDay = isCurrentMonth ? today.getDate() : (isFutureMonth ? 0 : daysInMonth);

    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    
    let cumulative = 0;
    const dailyData: (number | null)[] = [];
    const realData = labels.map((_, i) => {
      const day = i + 1;
      if (day > maxDay) {
        dailyData.push(null);
        return null;
      }
      const dayRegs = regsMes.filter(r => {
        if (!r.fecha) return false;
        const d = new Date(r.fecha + 'T12:00:00');
        return d.getDate() === day;
      });
      const dayTotal = dayRegs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      dailyData.push(dayTotal);
      cumulative += dayTotal;
      return cumulative;
    });

    const meta = kpiTotal.metaCapital;
    const idealData = labels.map((_, i) => (meta / daysInMonth) * (i + 1));

    return {
      labels,
      datasets: [
        {
          label: 'Vendido',
          data: realData,
          dailyData,
          borderColor: '#10b981',
          borderWidth: 2.5,
          pointBackgroundColor: '#4f8272',
          pointBorderColor: '#4f8272',
          pointRadius: 2,
          fill: false,
          tension: 0.2
        },
        {
          label: 'Ideal',
          data: idealData,
          borderColor: '#b8794f',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    };
  }, [registros, selectedMes, selectedAnio, kpiTotal.metaCapital]);

  // Progreso vs Ideal por separado: PDV + cada analista, cada uno con SU propio Ideal.
  const chartsProgresoSep = useMemo(() => {
    const daysInMonth = new Date(selectedAnio, selectedMes, 0).getDate();
    const today = new Date();
    const isCurrentMonth = selectedMes === (today.getMonth() + 1) && selectedAnio === today.getFullYear();
    const isFutureMonth = selectedAnio > today.getFullYear() || (selectedAnio === today.getFullYear() && selectedMes > (today.getMonth() + 1));
    const maxDay = isCurrentMonth ? today.getDate() : (isFutureMonth ? 0 : daysInMonth);
    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

    const regsMes = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);

    const cumFor = (pred: (r: typeof regsMes[number]) => boolean): (number | null)[] => {
      let cum = 0;
      return labels.map((_, i) => {
        const day = i + 1;
        if (day > maxDay) return null;
        const dayTotal = regsMes.reduce((s, r) => {
          if (!r.fecha || !pred(r)) return s;
          return new Date(r.fecha + 'T12:00:00').getDate() === day ? s + (Number(r.monto) || 0) : s;
        }, 0);
        cum += dayTotal;
        return cum;
      });
    };

    const buildChart = (pred: (r: typeof regsMes[number]) => boolean, meta: number) => ({
      labels,
      datasets: [
        {
          label: 'Vendido', data: cumFor(pred), borderColor: '#4f8272', borderWidth: 2.5,
          pointBackgroundColor: '#4f8272', pointBorderColor: '#4f8272', pointRadius: 2, fill: false, tension: 0.2,
        },
        {
          label: 'Ideal', data: labels.map((_, i) => (meta / daysInMonth) * (i + 1)),
          borderColor: '#b8794f', borderWidth: 2, borderDash: [6, 5], pointRadius: 0, fill: false, tension: 0,
        },
      ],
    });

    const metaDe = (a: string) => kpiPorAnalista.find(k => k.analista === a)?.metaCapital ?? 0;

    return [
      { titulo: 'PDV (Total)', data: buildChart(() => true, kpiTotal.metaCapital) },
      ...analistasDefault.map(a => ({ titulo: a, data: buildChart(r => r.analista === a, metaDe(a)) })),
    ];
  }, [registros, selectedMes, selectedAnio, kpiTotal.metaCapital, kpiPorAnalista, analistasDefault]);

  const chartProgresoSepOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { color: '#475467', font: { size: 10, weight: 700 }, usePointStyle: true } },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#fff', bodyColor: '#f1f5f9', padding: 16, cornerRadius: 12, usePointStyle: true,
        callbacks: {
          title: (items: any[]) => `Día ${items[0].label}`,
          label: (ctx: any) => {
            if (ctx.raw == null) return null;
            return ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148,163,184,0.16)' },
        ticks: { color: '#64748b', font: { size: 9, weight: 600 }, autoSkip: false, maxRotation: 0, minRotation: 0 }
      },
      y: { grid: { color: 'rgba(148,163,184,0.22)' }, ticks: { color: '#64748b', font: { size: 9, weight: 600 }, callback: (v: any) => formatCurrency(v) } },
    },
  };

  const chartProgresoOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { color: '#475467', font: { size: 10, weight: 700 }, usePointStyle: true } },
      tooltip: {
        itemSort: (a: any, b: any) => b.datasetIndex - a.datasetIndex,
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#ffffff',
        titleFont: { size: 18, weight: 700, family: UI_FONT_FAMILY },
        titleAlign: 'center' as const,
        titleMarginBottom: 16,
        bodyColor: '#f1f5f9',
        bodyFont: { size: 15, weight: 600, family: UI_FONT_FAMILY },
        bodySpacing: 10,
        footerColor: (ctx: any) => {
          const tooltipItems = ctx.tooltip.dataPoints;
          if (!tooltipItems || !tooltipItems[0]) return '#34d399';
          const index = tooltipItems[0].dataIndex;
          const vendido = tooltipItems[0].chart.data.datasets[0].data[index];
          const ideal = tooltipItems[0].chart.data.datasets[1].data[index];
          if (vendido == null || ideal == null || ideal === 0) return '#34d399';
          const pct = ((vendido / ideal) - 1) * 100;
          return pct < 0 ? '#f87171' : '#34d399';
        },
        footerFont: { size: 16, weight: 700, family: UI_FONT_FAMILY },
        footerMarginTop: 16,
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 2,
        padding: 24,
        cornerRadius: 16,
        boxPadding: 8,
        usePointStyle: true,
        callbacks: {
          title: (tooltipItems: any[]) => {
            return `Día ${tooltipItems[0].label}`;
          },
          label: (ctx: any) => {
            const v = ctx.raw;
            if (v == null) return null;
            if (ctx.datasetIndex === 0) {
              const daily = ctx.dataset.dailyData?.[ctx.dataIndex];
              if (daily != null) {
                return [
                  ` Acumulado: ${formatCurrency(v)}`,
                  ` ↳ Venta del día: ${formatCurrency(daily)}`
                ];
              }
              return ` Acumulado: ${formatCurrency(v)}`;
            }
            return ` Ideal: ${formatCurrency(v)}`;
          },
          footer: (tooltipItems: any[]) => {
             const index = tooltipItems[0].dataIndex;
             const vendido = tooltipItems[0].chart.data.datasets[0].data[index];
             const ideal = tooltipItems[0].chart.data.datasets[1].data[index];
             if (vendido == null || ideal == null || ideal === 0) return '';
             const pct = ((vendido / ideal) - 1) * 100;
             const sign = pct > 0 ? '+' : '';
             return `➔ Variación: ${sign}${pct.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(148,163,184,0.16)' },
        ticks: { color: '#64748b', font: { size: 9, weight: 600 }, autoSkip: false, maxRotation: 0, minRotation: 0 }
      },
      y: { grid: { color: 'rgba(148,163,184,0.22)' }, ticks: { color: '#64748b', font: { size: 9, weight: 600 }, callback: (v: any) => formatCurrency(v) } }
    },
    interaction: { mode: 'index' as const, intersect: false }
  };

  const chartAperturas = useMemo(() => {
    const labels = chartLabels;
    const isPDV = analista === 'PDV';
    const actual = isPDV ? [apertVsRenData.total.aperturas] : apertVsRenData.porAnalista.map(d => d.aperturas);
    const anterior = isPDV ? [apertVsRenData.ant.aperturas] : apertVsRenData.porAnalistaAnt.map(d => d.aperturas);

    return {
      labels,
      datasets: [
        { label: `Actual`, data: actual, backgroundColor: (context: any) => getGradient(context, 'rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.85)'), borderColor: '#10b981', borderWidth: 0, borderRadius: 4, maxBarThickness: 100 },
        { label: `Anterior`, data: anterior, backgroundColor: (context: any) => getGradient(context, 'rgba(71, 85, 105, 0.12)', 'rgba(71, 85, 105, 0.72)'), borderColor: '#64748b', borderWidth: 1, borderRadius: 4, maxBarThickness: 100 },
      ],
    };
  }, [chartLabels, apertVsRenData, analista]);

  const chartRenovaciones = useMemo(() => {
    const labels = chartLabels;
    const isPDV = analista === 'PDV';
    const actual = isPDV ? [apertVsRenData.total.renovaciones] : apertVsRenData.porAnalista.map(d => d.renovaciones);
    const anterior = isPDV ? [apertVsRenData.ant.renovaciones] : apertVsRenData.porAnalistaAnt.map(d => d.renovaciones);

    return {
      labels,
      datasets: [
        { label: `Actual`, data: actual, backgroundColor: (context: any) => getGradient(context, 'rgba(59, 130, 246, 0.05)', 'rgba(59, 130, 246, 0.85)'), borderColor: '#3b82f6', borderWidth: 0, borderRadius: 4, maxBarThickness: 100 },
        { label: `Anterior`, data: anterior, backgroundColor: (context: any) => getGradient(context, 'rgba(71, 85, 105, 0.12)', 'rgba(71, 85, 105, 0.72)'), borderColor: '#64748b', borderWidth: 1, borderRadius: 4, maxBarThickness: 100 },
      ],
    };
  }, [chartLabels, apertVsRenData, analista]);

  // ── Chart 8: % Empleo Público / Privado ──────────────────────────────────
  const empleoPublPrivData = useMemo(() => {
    const PUBLICO = ['municipio', 'municip', 'provincia', 'hospital', 'escuela', 'público', 'gobierno', 'estado', 'policia', 'policía', 'nación', 'nacional', 'ministerio', 'judicial', 'fuerzas'];
    const ventas = periodoEmpleo === 'mensual' ? ventasMes.filter(isVenta) : registros;
    const classify = (r: typeof ventas[0]) => {
      const e = (r.empleador ?? '').toLowerCase();
      return PUBLICO.some(k => e.includes(k)) ? 'Público' : e.trim() === '' || e === 'sin dato' ? 'Sin dato' : 'Privado';
    };
    const counts: Record<string, number> = { 'Público': 0, 'Privado': 0, 'Sin dato': 0 };
    ventas.forEach(r => counts[classify(r)]++);
    return { counts };
  }, [registros, ventasMes, periodoEmpleo]);

  const chartEmpleoPublPriv = useMemo(() => {
    const { counts } = empleoPublPrivData;
    const labels = ['Público', 'Privado', 'Sin dato'];
    const colors = ['#5f927f', '#607da8', '#8d99a8'];
    const filtered = labels.filter(l => (counts[l] ?? 0) > 0);
    return {
      labels: filtered,
      datasets: [{
        data: filtered.map(l => counts[l] ?? 0),
        backgroundColor: filtered.map(l => colors[labels.indexOf(l)]),
        borderWidth: 0,
        hoverOffset: 10,
        borderRadius: 4,
        spacing: 4
      }],
    };
  }, [empleoPublPrivData]);

  const ExecutiveDashboard = () => {
    const capitalAnterior = Number((chartCapitalVsObjetivo.datasets[1] as any)?.data?.[0] || 0);
    const ticketAnterior = Number((chartTicketPromedio.datasets[1] as any)?.data?.[0] || 0);
    const aperturaActual = apertVsRenData.total.aperturas;
    const aperturaAnterior = apertVsRenData.ant.aperturas;
    const renovacionActual = apertVsRenData.total.renovaciones;
    const renovacionAnterior = apertVsRenData.ant.renovaciones;
    const variacion = (actual: number, anterior: number) => anterior > 0 ? ((actual - anterior) / anterior) * 100 : null;
    const aperturaVar = variacion(aperturaActual, aperturaAnterior);
    const renovacionVar = variacion(renovacionActual, renovacionAnterior);
    const compactMoney = (value: number) => value >= 1_000_000 ? `$ ${(value / 1_000_000).toFixed(1)}M` : formatCurrency(value);
    const maxCapital = Math.max(10_000_000, Math.ceil(Math.max(kpiTotal.capital, capitalAnterior, kpiTotal.metaCapital, 1) / 10_000_000) * 10_000_000);
    const maxOps = Math.max(30, Math.ceil(Math.max(aperturaActual, aperturaAnterior, renovacionActual, renovacionAnterior, 1) / 10) * 10);
    const maxTicket = Math.max(500_000, Math.ceil(Math.max(kpiTotal.ticket, ticketAnterior, 1) / 500_000) * 500_000);
    const capitalTicks = Array.from({ length: Math.round(maxCapital / 10_000_000) + 1 }, (_, i) => i * 10_000_000);
    const opsTicks = Array.from({ length: Math.round(maxOps / 10) + 1 }, (_, i) => i * 10);
    const ticketTicks = Array.from({ length: Math.round(maxTicket / 500_000) + 1 }, (_, i) => i * 500_000);
    const width = (value: number, max: number) => `${Math.max(3, Math.min(100, (value / max) * 100))}%`;
    const capitalMetaSuperada = (kpiTotal.cumplCapital ?? 0) > 100;
    const productividadObjetivo = 200;
    const productividadActual = kpiTotal.productividad ?? 0;
    const productividadMetaSuperada = productividadActual > productividadObjetivo;
    const productividadScaleMax = Math.max(300, Math.ceil(productividadActual / 100) * 100);
    const productividadIdealPosition = (productividadObjetivo / productividadScaleMax) * 100;
    const productividadBaseWidth = (Math.min(productividadActual, productividadObjetivo) / productividadScaleMax) * 100;
    const productividadOverflowWidth = (Math.max(0, productividadActual - productividadObjetivo) / productividadScaleMax) * 100;
    const productividadOverflowVisualWidth = productividadMetaSuperada
      ? Math.min(100 - productividadIdealPosition, Math.max(14, productividadOverflowWidth))
      : 0;
    const changePill = (value: number | null) => (
      <span className={value !== null && value >= 0 ? 'exec-change positive' : 'exec-change negative'}>
        {value === null ? '—' : `${value >= 0 ? '↑' : '↓'} ${Math.abs(value).toFixed(1)}%`}
      </span>
    );
    const miniMetric = (label: string, value: React.ReactNode, secondary?: React.ReactNode, tone = 'neutral') => (
      <div className={`exec-mini ${tone}`}>
        <span>{label}</span><strong>{value}</strong>{secondary && <small>{secondary}</small>}
      </div>
    );

    return (
      <div className="executive-dashboard">
        <div className="exec-top-grid">
          <section className="exec-card">
            <div className="exec-kpi-head"><div><span>Capital vendido</span><strong>{formatCurrency(kpiTotal.capital)}</strong></div>{tendBadge(kpiTotal.tendCapital)}</div>
            <div className="exec-inline-meta"><span className="dot green" /> Meta: {formatCurrency(kpiTotal.metaCapital)}<i /><b>{kpiTotal.cumplCapital?.toFixed(1) ?? '—'}% Cumpl.</b></div>
            <div className="exec-goal">
              <div className="exec-goal-label" style={{ left: `${Math.min(92, (kpiTotal.metaCapital / maxCapital) * 100)}%` }}><span>Meta</span><b>{formatCurrency(kpiTotal.metaCapital)}</b></div>
              <div className="exec-goal-track">
                <div className="exec-goal-fill" style={{ width: width(Math.min(kpiTotal.capital, kpiTotal.metaCapital), maxCapital) }} />
                {capitalMetaSuperada && <div className="exec-goal-overflow" style={{ left: `${Math.min(100, (kpiTotal.metaCapital / maxCapital) * 100)}%`, width: `${Math.min(100 - ((kpiTotal.metaCapital / maxCapital) * 100), ((kpiTotal.capital - kpiTotal.metaCapital) / maxCapital) * 100)}%` }}><span>+{((kpiTotal.cumplCapital ?? 100) - 100).toFixed(1)}%</span></div>}
                <i style={{ left: `${Math.min(100, (kpiTotal.metaCapital / maxCapital) * 100)}%` }} /><em style={{ left: width(kpiTotal.capital, maxCapital) }} />
              </div>
              <div className="exec-axis">{capitalTicks.map(v => <span key={v}>{v === 0 ? '0' : `${v / 1_000_000}M`}</span>)}</div>
            </div>
            <div className="exec-compare"><span>Comparativo mensual</span><div>
              <article><b>{compactMoney(kpiTotal.capital)}</b><small>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</small><i className="green" /></article>
              <article><b>{compactMoney(capitalAnterior)}</b><small>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</small><i className="slate" /></article>
              {changePill(kpiTotal.tendCapital)}
            </div></div>
          </section>

          <section className="exec-card">
            <div className="exec-kpi-head"><div><span>Operaciones</span><strong>{kpiTotal.ops}</strong></div>{tendBadge(kpiTotal.tendOps)}</div>
            <div className="exec-inline-meta"><span className="dot amber" /> Meta: {kpiTotal.metaOps}<i /><b>{kpiTotal.cumplOps?.toFixed(1) ?? '—'}% Cumpl.</b></div>
            <div className="exec-ops-chart">
              <div className="exec-legend"><span className="blue" />{CONFIG.MESES_NOMBRES[selectedMes - 1]}<span className="slate" />{CONFIG.MESES_NOMBRES[mesPrev - 1]}</div>
              <div className="exec-op-row"><b>Aperturas</b><div><i className="blue" style={{ width: width(aperturaActual, maxOps) }} /><em style={{ left: width(aperturaActual, maxOps) }}>{aperturaActual}</em><i className="slate" style={{ width: width(aperturaAnterior, maxOps) }} /><em style={{ left: width(aperturaAnterior, maxOps) }}>{aperturaAnterior}</em></div>{changePill(aperturaVar)}</div>
              <div className="exec-op-row"><b>Renovaciones</b><div><i className="blue" style={{ width: width(renovacionActual, maxOps) }} /><em style={{ left: width(renovacionActual, maxOps) }}>{renovacionActual}</em><i className="slate" style={{ width: width(renovacionAnterior, maxOps) }} /><em style={{ left: width(renovacionAnterior, maxOps) }}>{renovacionAnterior}</em></div>{changePill(renovacionVar)}</div>
              <div className="exec-scale-axis">{opsTicks.map(v => <span key={v}>{v}</span>)}</div>
            </div>
          </section>

          <section className="exec-card">
            <div className="exec-kpi-head"><div><span>Ticket promedio</span><strong>{formatCurrency(kpiTotal.ticket)}</strong></div>{tendBadge(kpiTotal.tendTicket)}</div>
            <div className="exec-inline-meta">Conversión total: {kpiTotal.conversionGlobal.toFixed(1)}%<i />Tasa de cierre: {kpiTotal.conversion.toFixed(1)}%</div>
            <div className="exec-clients">{kpiTotal.clientes} clientes ingresados</div>
            <div className="exec-ticket-chart">
              <div className="exec-analysis-head"><b>Análisis vs {mesAntLabel}</b><span><i className="amber" />{CONFIG.MESES_NOMBRES[selectedMes - 1]}<i className="slate" />{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span></div>
              <div className="exec-ticket-row"><span>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span><i className="amber" style={{ width: width(kpiTotal.ticket, maxTicket) }} /><b>{compactMoney(kpiTotal.ticket)}</b></div>
              <div className="exec-ticket-row"><span>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span><i className="slate" style={{ width: width(ticketAnterior, maxTicket) }} /><b>{compactMoney(ticketAnterior)}</b></div>
              <div className="exec-scale-axis ticket">{ticketTicks.map(v => <span key={v}>{v === 0 ? '0' : `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`}</span>)}</div>
            </div>
          </section>
        </div>

        <div className="exec-summary-grid">
          <section className="exec-card exec-sale"><span>Venta (I)</span><strong>{formatCurrency(kpiTotal.interesXVenta)}</strong><small>Total del mes</small></section>
          <section className={`exec-card exec-productivity${productividadMetaSuperada ? ' is-over-target' : ''}`}>
            <div><span>Productividad</span><strong>{kpiTotal.productividad !== null ? `${kpiTotal.productividad.toFixed(2)}%` : '—'}</strong><small>vs ideal</small></div>
            <div className="exec-product-track"><span style={{ left: `${productividadIdealPosition}%` }}>Ideal 200%</span><div><i className={productividadMetaSuperada ? 'is-target-met' : 'is-below-target'} style={{ width: `${productividadBaseWidth}%` }} />{productividadMetaSuperada && <em style={{ left: `${productividadIdealPosition}%`, width: `${productividadOverflowVisualWidth}%` }}><span>+{(productividadActual - productividadObjetivo).toFixed(2)}%</span></em>}<b style={{ left: `${productividadIdealPosition}%` }} />{productividadMetaSuperada && <strong className="exec-product-end" style={{ left: `${productividadIdealPosition + productividadOverflowVisualWidth}%` }} />}</div></div>
            <div className="exec-product-split"><span>Apertura<strong>{kpiTotal.productividadApertura?.toFixed(2) ?? '—'}%</strong></span><span>Renovación<strong>{kpiTotal.productividadRenov?.toFixed(2) ?? '—'}%</strong></span></div>
          </section>
        </div>

        <div className="exec-bottom-grid">
          <section className="exec-card exec-operations"><h3>Métricas operativas</h3><div>
            {miniMetric('Venta / día (necesario)', formatCurrency(kpiTotal.metaDiariaCapital ?? 0), <>Ritmo: {formatCurrency(kpiTotal.ventaPorDia ?? 0)}</>)}
            {miniMetric('Ops. / día (necesario)', Math.round(kpiTotal.metaDiariaOps ?? 0), <>Ritmo: {Math.round(kpiTotal.opsPorDia ?? 0)}</>)}
            {miniMetric('Proy. fin mes (K)', formatCurrency(kpiTotal.proyCapital ?? 0), kpiTotal.cumplProyCapital !== null ? `▲ ${kpiTotal.cumplProyCapital.toFixed(2)}%` : undefined, 'positive')}
            {miniMetric('Proy. fin mes (Q)', Math.round(kpiTotal.proyOps ?? 0), kpiTotal.cumplProyOps !== null ? `${kpiTotal.cumplProyOps >= 100 ? '▲' : '▼'} ${kpiTotal.cumplProyOps.toFixed(2)}%` : undefined, kpiTotal.cumplProyOps !== null && kpiTotal.cumplProyOps >= 100 ? 'positive' : 'negative')}
            {miniMetric('Falta 100% (K)', formatCurrency(kpiTotal.faltaCapital ?? 0), undefined, kpiTotal.faltaCapital === 0 ? 'positive' : 'negative')}
            {miniMetric('Falta 100% (Q)', Math.round(kpiTotal.faltaOps ?? 0), undefined, kpiTotal.faltaOps === 0 ? 'positive' : 'negative')}
          </div></section>
          <section className="exec-card exec-previous"><h3>{CONFIG.MESES_NOMBRES[mesPrev - 1]} al día {kpiTotal.diaCorte}</h3>
            {miniMetric('Ventas (K)', formatCurrency(kpiTotal.capitalAntFecha), kpiTotal.varCapitalFecha !== null ? `▲ ${Math.abs(kpiTotal.varCapitalFecha).toFixed(2)}%` : undefined, 'positive')}
            {miniMetric('Operaciones (Q)', kpiTotal.opsAntFecha, kpiTotal.varOpsFecha !== null ? `▲ ${Math.abs(kpiTotal.varOpsFecha).toFixed(2)}%` : undefined, 'positive')}
          </section>
          <section className="exec-card exec-progress"><h3>Progreso vs ideal</h3><div>{chartsLoaded ? <Line data={chartProgreso} options={chartProgresoOptions as any} plugins={[lineShadowPlugin]} /> : <ChartShimmer />}</div></section>
        </div>
      </div>
    );
  };
  const showLegacyDashboard = selectedAnio < 0;

  if (loading) return <div className={[styles.uDisplayflex, styles.uJustifyContentcenter, styles.uPadding40px].join(' ')}><div className="spinner"></div></div>;

  return (
    <div className={["analistas-report", styles.page, styles.uDisplayflex, styles.uFlexDirectioncolumn, styles.uGap16px, styles.uPaddingTop16px].join(' ')}>
      {/* Toolbar Superior */}
      <div className={[styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles.uBorderRadius16px, styles["uPadding12px-24px"], styles["uBoxShadowshadow-md"], styles.toolbar].join(' ')}>
        <div className={[styles.uDisplayflex, styles["uJustifyContentspace-between"], styles.uAlignItemscenter, styles.uFlexWrapwrap, styles.uGap16px, styles.toolbarInner].join(' ')}>
            <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap16px, styles.toolbarTitle].join(' ')}>
            <div>
              <div className={[styles.uFontSize24px, styles.uFontWeight900, styles["uColortext-strong"], styles["uLetterSpacing0-5px12zy2"]].join(' ')}>
                {analista === 'PDV' ? 'PDV' : analista.charAt(0).toUpperCase() + analista.slice(1).toLowerCase()}
              </div>
              <div className={[styles.uFontSize13px, styles["uColortext-muted"], styles.uMarginTop2px].join(' ')}>Métricas</div>
            </div>
          </div>
          <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap12px, styles.filters].join(' ')}>
            <CustomSelect
              value={analista}
              onChange={val => setAnalista(String(val))}
              options={[
                { label: 'PDV', value: 'PDV' },
                ...analistasDefault.map(a => ({ label: a, value: a })),
                ...(isAdmin ? [{ label: '📊 Proyectados', value: 'PROYECTADOS' }] : []),
              ]}
              width="150px"
            />
            <CustomSelect
              value={selectedMes}
              onChange={val => setSelectedMes(Number(val))}
              options={CONFIG.MESES_NOMBRES.map((m, i) => ({ label: m, value: i + 1 }))}
              width="150px"
              menuMaxHeight="442px"
            />
            <CustomSelect
              value={selectedAnio}
              onChange={val => setSelectedAnio(Number(val))}
              options={Array.from({ length: new Date().getFullYear() + 1 - 2016 + 1 }, (_, i) => 2016 + i).map(a => ({ label: String(a), value: a }))}
              width="110px"
            />
          </div>
        </div>
      </div>

            {analista === 'PROYECTADOS' && isAdmin ? (
              <>
              <div className={[styles.uMarginTop16px, styles.uDisplayflex, styles.uGap10px].join(' ')}>
                {[
                  { label: 'Situación actual', open: proyShowActual, toggle: () => setProyShowActual(v => !v) },
                  { label: 'Proyección fin de mes', open: proyShowProy, toggle: () => setProyShowProy(v => !v) },
                ].map(({ label, open, toggle }) => (
                  <button className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap6px, styles["uBorder1px-solid-border-subtle"], styles.uBorderRadius8px, styles["uPadding6px-12px"], styles.uCursorpointer, styles.uFontSize11px, styles.uFontWeight800, styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"]].join(' ')}
                    key={label}
                    onClick={toggle}
                    style={{ background: open ? 'rgba(255,255,255,0.04)' : 'transparent', color: open ? '#e2e8f0' : '#64748b' }}
                  >
                    <ChevronRight className={[styles["uTransitiontransform-0-15s"]].join(' ')} size={14} style={{ transform: open ? 'rotate(90deg)' : 'none' }} />
                    {label}
                  </button>
                ))}
              </div>
              <div className={["analistas-autogrid", styles.uMarginTop12px, styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-auto-fit-minmax-360px-1fr"], styles.uGap16px, styles.uAlignItemsstretch].join(' ')}>
                {(() => {
                  // Venta ideal a la fecha = meta / días del mes * día actual (misma fórmula que el gráfico "Progreso vs Ideal")
                  const daysInMonth = new Date(selectedAnio, selectedMes, 0).getDate();
                  const hoyIdeal = new Date();
                  const esMesActualIdeal = selectedMes === (hoyIdeal.getMonth() + 1) && selectedAnio === hoyIdeal.getFullYear();
                  const diaActualIdeal = esMesActualIdeal ? hoyIdeal.getDate() : daysInMonth;
                  const idealFecha = (k: any) => (k.metaCapital > 0 ? (k.metaCapital / daysInMonth) * diaActualIdeal : null);
                  // El General se compone como suma de los individuales para que sea coherente
                  // (Necesario/día, Promedio/día e Ideal del total = suma de Luciana + Victoria)
                  const sum = (f: string) => kpiPorAnalista.reduce((s, k: any) => s + (k[f] ?? 0), 0);
                  const anyIdeal = kpiPorAnalista.some(k => idealFecha(k) !== null);
                  const pdvCard = {
                    ...kpiTotal,
                    metaDiariaCapital: sum('metaDiariaCapital'),
                    metaDiariaOps: sum('metaDiariaOps'),
                    ventaPorDia: sum('ventaPorDia'),
                    opsPorDia: sum('opsPorDia'),
                    ventaIdealFecha: anyIdeal ? kpiPorAnalista.reduce((s, k) => s + (idealFecha(k) ?? 0), 0) : null,
                  };
                  const cards = [
                    { kpi: pdvCard, titulo: 'PDV (Total General)' },
                    ...kpiPorAnalista.map((k: any) => ({ kpi: { ...k, ventaIdealFecha: idealFecha(k) }, titulo: k.analista })),
                  ];
                  return cards.map(({ kpi, titulo }) => (
                    <ProyeccionCard key={titulo} kpi={kpi} titulo={titulo} showActual={proyShowActual} showProy={proyShowProy} />
                  ));
                })()}
              </div>

              {/* ── Progreso vs Ideal por separado (PDV + cada analista, con su propio Ideal) ── */}
              <div className={["analistas-autogrid", styles.uMarginTop16px, styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-auto-fit-minmax-360px-1fr"], styles.uGap16px].join(' ')}>
                {chartsProgresoSep.map(({ titulo, data }) => (
                  <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding14px-16px"], styles["uBorder1px-solid-border-subtle"]].join(' ')} key={titulo}>
                    <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"], styles.uMarginBottom10px].join(' ')}>Progreso vs Ideal — {titulo}</div>
                    <div className={[styles.uHeight240px, styles.uPositionrelative, styles.uWidth100].join(' ')}>
                      {chartsLoaded ? (
                        <Line data={data} options={chartProgresoSepOptions as any} plugins={[lineShadowPlugin]} />
                      ) : (
                        <ChartShimmer />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </>
            ) : (
              <>
      <div className={[styles.uDisplayflex, styles.uFlexDirectioncolumn, styles.uGap16px].join(' ')}>
          {/* ── SECCIÓN 1: TABLERO ── */}
          <div className={["data-card", styles["uBackgroundlinear-gradient-180deg-rgba-255-255-255-0-"], styles["uBoxShadowshadow-md"], styles.uPositionrelative].join(' ')}>
            <div className={[styles.uPositionabsolute, styles.uTop16px, styles.uRight16px, styles.uZIndex2].join(' ')}>
              <button className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap6px, styles["uPadding6px-12px"], styles.uBorderRadius8px, styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-rgba-255-255-255-0-2"], styles["uColortext-strong"], styles["uBoxShadow0-0-10px-rgba-255-255-255-0-1"], styles.uFontSize11px, styles.uFontWeight800, styles["uLetterSpacing0-6px"], styles.uTextTransformuppercase, styles.uCursorpointer, styles.uFontFamilyUi].join(' ')}
                type="button"
                onClick={() => setRendimiento12MOpen(true)}
              >
                Rendimiento Histórico
              </button>
            </div>
            {sectionHeader(1, '1. Tablero', null, badgeDiasRestantes)}
              <>
                <ExecutiveDashboard />
                {showLegacyDashboard && (
                <>
                <div className={["analistas-autogrid", styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-auto-fit-minmax-320px-1fr"], styles.uGap16px, styles.uMarginBottom16px].join(' ')}>
                <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding16px-20px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                  <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom8px].join(' ')}>Capital Vendido</div>
                  <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom4px].join(' ')}>
                    <div className={[styles.uFontSize22px, styles.uFontWeight900, styles["uColortext-strong"]].join(' ')}>{formatCurrency(kpiTotal.capital)}</div>
                    {tendBadge(kpiTotal.tendCapital)}
                  </div>
                  <div className={[styles.uFontSize12px, styles["uColortext-muted"], styles.uMarginBottom2px].join(' ')}>
                    Meta: {kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}
                  </div>
                  {kpiTotal.cumplCapital !== null && (
                    <div className={[styles.uFontSize12px, styles.uFontWeight800, styles["uColortext-strong"]].join(' ')}>
                      <span className={[styles.uMarginRight4px].join(' ')} style={{ color: cumplColor(kpiTotal.cumplCapital) }}>●</span>
                      {kpiTotal.cumplCapital.toFixed(1)}% Cumpl.
                    </div>
                  )}
                  <div className={[styles.uMarginTop14px, styles.uPaddingTop12px, styles["uBorderTop1px-solid-border-subtle"]].join(' ')}>
                    <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom12px].join(' ')}>
                      <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"]].join(' ')}>Capital vs Objetivo</div>
                      <div className={[styles.uDisplayflex, styles.uGap10px].join(' ')}>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                          <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles["uBackgroundrgba-96-165-250-0-8"]].join(' ')} />
                          <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                        </div>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                          <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles["uBackgroundrgba-30-58-138-0-9"]].join(' ')} />
                          <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                        </div>
                      </div>
                    </div>
                    <div className={[styles.uHeight135px].join(' ')} id="chart-capital-objetivo">
                      {chartsLoaded ? (
                        (() => {
                          const opts = baseChartOpts('$', true, true, false, false, analista !== 'PDV');
                          return <Bar data={chartCapitalVsObjetivo as any} options={opts} plugins={[labelsPlugin, referenceLinesPlugin]} />;
                        })()
                      ) : (
                        <ChartShimmer />
                      )}
                    </div>
                  </div>
                </div>
                <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding16px-20px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                  <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom8px].join(' ')}>Operaciones</div>
                  <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom4px].join(' ')}>
                    <div className={[styles.uFontSize22px, styles.uFontWeight900, styles["uColortext-strong"]].join(' ')}>{kpiTotal.ops}</div>
                    {tendBadge(kpiTotal.tendOps)}
                  </div>
                  <div className={[styles.uFontSize12px, styles["uColortext-muted"], styles.uMarginBottom2px].join(' ')}>
                    Meta: {kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}
                  </div>
                  {kpiTotal.cumplOps !== null && (
                    <div className={[styles.uFontSize12px, styles.uFontWeight800, styles["uColortext-strong"]].join(' ')}>
                      <span className={[styles.uMarginRight4px].join(' ')} style={{ color: cumplColor(kpiTotal.cumplOps) }}>●</span>
                      {kpiTotal.cumplOps.toFixed(1)}% Cumpl.
                    </div>
                  )}
                  <div className={[styles.uMarginTop14px, styles.uPaddingTop12px, styles["uBorderTop1px-solid-border-subtle"]].join(' ')}>
                    <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom12px].join(' ')}>
                      <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"]].join(' ')}>Aperturas vs Renovaciones</div>
                      <div className={[styles.uDisplayflex, styles.uGap10px].join(' ')}>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                          <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles.uBackground60a5fa].join(' ')} />
                          <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                        </div>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                          <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles["uBackgroundrgba-30-58-138-0-9"]].join(' ')} />
                          <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                        </div>
                      </div>
                    </div>
                    <div className={[styles.uDisplaygrid, styles["uGridTemplateColumns1fr-1fr"], styles.uGap16px].join(' ')}>
                      <div className={[styles.uMinWidth0].join(' ')}>
                        <div className={[styles.uFontSize9px, styles.uFontWeight800, styles.uColor60a5fa, styles.uTextAligncenter, styles.uMarginBottom6px, styles.uTextTransformuppercase].join(' ')}>Aperturas</div>
                        <div className={[styles.uHeight135px, styles.uPositionrelative, styles.uWidth100].join(' ')} id="chart-aperturas">
                          {chartsLoaded ? (
                            <Bar data={chartAperturas} options={baseChartOpts(' ops', true, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                          ) : (
                            <ChartShimmer />
                          )}
                        </div>
                      </div>
                      <div className={[styles.uMinWidth0].join(' ')}>
                        <div className={[styles.uFontSize9px, styles.uFontWeight800, styles.uColora78bfa, styles.uTextAligncenter, styles.uMarginBottom6px, styles.uTextTransformuppercase].join(' ')}>Renov.</div>
                        <div className={[styles.uHeight135px, styles.uPositionrelative, styles.uWidth100].join(' ')} id="chart-renovaciones">
                          {chartsLoaded ? (
                            <Bar data={chartRenovaciones} options={baseChartOpts(' ops', true, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                          ) : (
                            <ChartShimmer />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding16px-20px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                  <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom8px].join(' ')}>Ticket Promedio</div>
                  <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom4px].join(' ')}>
                    <div className={[styles.uFontSize22px, styles.uFontWeight900, styles["uColortext-strong"]].join(' ')}>{formatCurrency(kpiTotal.ticket)}</div>
                    {tendBadge(kpiTotal.tendTicket)}
                  </div>
                  <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginTop6px].join(' ')}>
                    <div className={[styles.uFontSize12px, styles["uColortext-muted"]].join(' ')} title="Avance del pipeline: (Venta + Aprob. CC) / (Venta + Aprob. CC + Proyección + En seguimiento + Score bajo + Afectaciones + Rechaz. CC)">Conversión total: {kpiTotal.conversionGlobal.toFixed(1)}%</div>
                    {tendBadge(kpiTotal.tendConversionGlobal, false)}
                  </div>
                  <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginTop6px].join(' ')}>
                    <div className={[styles.uFontSize12px, styles["uColortext-muted"]].join(' ')} title="Efectividad comercial: (Venta + Aprob. CC) / (Venta + Aprob. CC + Rechaz. CC)">Tasa de cierre (efectividad): {kpiTotal.conversion.toFixed(1)}%</div>
                    {tendBadge(kpiTotal.tendConversion, false)}
                  </div>
                  <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginTop6px].join(' ')}>
                    <div className={[styles.uFontSize11px, styles["uColortext-muted"]].join(' ')}>{kpiTotal.clientes} clientes ingresados</div>
                    {tendBadge(kpiTotal.tendClientes, false)}
                  </div>
                  <div className={[styles.uMarginTop14px, styles.uPaddingTop12px, styles["uBorderTop1px-solid-border-subtle"]].join(' ')}>
                    <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom12px].join(' ')}>
                      <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"]].join(' ')}>Análisis vs {mesAntLabel}</div>
                      <div className={[styles.uDisplayflex, styles.uGap10px].join(' ')}>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                          <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles["uBackgroundrgba-52-211-153-0-8"]].join(' ')} />
                          <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                        </div>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                          <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles["uBackgroundrgba-6-78-59-0-9"]].join(' ')} />
                          <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                        </div>
                      </div>
                    </div>
                    <div className={[styles.uHeight135px].join(' ')} id="chart-ticket-promedio">
                      {chartsLoaded ? (
                        <Bar data={chartTicketPromedio as any} options={baseChartOpts('$', true, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                      ) : (
                        <ChartShimmer />
                      )}
                    </div>
                  </div>
                </div>
              </div>

                {/* ── FILA: (I) x Venta / Productividad / Comisión ── */}
                <div className={["analistas-summary-row", styles.uDisplaygrid, styles.uGap16px, styles.uMarginBottom16px].join(' ')}>
                  <div className={[styles["uBackgroundlinear-gradient-135deg-ffffff-0-f8fafc-100"], styles.uBorderRadius12px, styles["uPadding16px-20px"], styles["uBorder1px-solid-cbd7e5"], styles["uBoxShadow0-8px-24px-rgba-15-23-42-0-06"]].join(' ')}>
                    <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom8px].join(' ')}>(I) x Venta</div>
                    <div className={[styles.uFontSize22px, styles.uFontWeight900, styles["uColortext-strong"]].join(' ')}>{formatCurrency(kpiTotal.interesXVenta)}</div>
                  </div>
                  <div className={["analistas-productivity", styles["uBackgroundlinear-gradient-135deg-ffffff-0-f8fafc-100"], styles.uBorderRadius12px, styles["uPadding16px-20px"], styles["uBorder1px-solid-cbd7e5"], styles["uBoxShadow0-8px-24px-rgba-15-23-42-0-06"]].join(' ')}>
                    <div className="analistas-productivity-main">
                      <div>
                        <div className={[styles.uFontSize10px, styles.uFontWeight800, styles.uColor667085, styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom8px].join(' ')}>Productividad</div>
                        <div className={[styles.uDisplayflex, styles.uAlignItemsbaseline, styles.uGap8px].join(' ')}>
                          <div className={[styles.uFontSize28px, styles.uLineHeight1, styles.uFontWeight900].join(' ')} style={{ color: kpiTotal.productividad === null ? '#344054' : (kpiTotal.productividad >= 200 ? '#059669' : '#ef4444') }}>{kpiTotal.productividad !== null ? `${kpiTotal.productividad.toFixed(2)}%` : '—'}</div>
                          <span className={[styles.uFontSize10px, styles.uColor667085, styles.uFontWeight700].join(' ')}>general</span>
                        </div>
                      </div>
                      <div className="analistas-productivity-track" aria-label="Productividad respecto del ideal de 100%">
                        <span>Ideal 100%</span>
                        <div><i /><b /></div>
                      </div>
                    </div>
                    {(kpiTotal.productividadApertura !== null || kpiTotal.productividadRenov !== null) && (
                      <div className={[styles.uMarginTop14px, styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-2-1fr"], styles.uGap8px, styles.uFontFamilyUi].join(' ')}>
                        <div className={[styles.uDisplayflex, styles.uFlexDirectioncolumn, styles["uAlignItemsflex-start"], styles.uJustifyContentcenter, styles.uGap5px, styles.uBackgroundf8fafc, styles["uBorder1px-solid-dbe3ee"], styles["uPadding9px-10px"], styles.uBorderRadius8px, styles.uWhiteSpacenowrap, styles.uMinWidth0].join(' ')}>
                          <span className={[styles["uFontSize9-5px"], styles.uFontWeight800, styles.uColor667085, styles.uTextTransformuppercase, styles["uLetterSpacing0-6px"]].join(' ')}>Apertura</span>
                          <span className={[styles.uFontSize28px, styles.uLineHeight1, styles.uFontWeight900, styles.uColor344054, styles.uFontFamilyUi].join(' ')}>
                            {kpiTotal.productividadApertura !== null ? `${kpiTotal.productividadApertura.toFixed(2)}%` : '—'}
                          </span>
                        </div>

                        <div className={[styles.uDisplayflex, styles.uFlexDirectioncolumn, styles["uAlignItemsflex-start"], styles.uJustifyContentcenter, styles.uGap5px, styles.uBackgroundf8fafc, styles["uBorder1px-solid-dbe3ee"], styles["uPadding9px-10px"], styles.uBorderRadius8px, styles.uWhiteSpacenowrap, styles.uMinWidth0].join(' ')}>
                          <span className={[styles["uFontSize9-5px"], styles.uFontWeight800, styles.uColor667085, styles.uTextTransformuppercase, styles["uLetterSpacing0-6px"]].join(' ')}>Renovación</span>
                          <span className={[styles.uFontSize28px, styles.uLineHeight1, styles.uFontWeight900, styles.uColor344054, styles.uFontFamilyUi].join(' ')}>
                            {kpiTotal.productividadRenov !== null ? `${kpiTotal.productividadRenov.toFixed(2)}%` : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {analistaIndividualKpi && (
                    <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding16px-20px"], styles["uBorder1px-solid-border-subtle"], styles.uCursorpointer, styles["uTransitionall-0-2s-ease"], styles.uPositionrelative, styles.incentiveCard].join(' ')}
                      onClick={() => setIncentivosModalOpen(true)}
                      title="Hacé clic para ver el detalle de incentivos y escalas"
                    >
                      <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom8px].join(' ')}>
                        <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap6px].join(' ')}>
                          <Calculator className={[styles.uColor10b981].join(' ')} size={13} />
                          <span>Comisión Estimada</span>
                        </div>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap6px].join(' ')}>
                          {analistaIndividualKpi.topeKQAplicado && (
                            <span className={[styles.uFontSize9px, styles.uFontWeight800, styles["uPadding2px-5px"], styles.uBorderRadius4px, styles["uBackgroundrgba-251-191-36-0-15"], styles.uColorfbbf24, styles["uBorder1px-solid-rgba-251-191-36-0-3"], styles.uTextTransformuppercase, styles["uLetterSpacing0-5px"]].join(' ')}>
                              TOPE K+Q
                            </span>
                          )}
                          <button className={[styles["uDisplayinline-flex"], styles.uAlignItemscenter, styles.uGap5px, styles["uPadding3px-9px"], styles.uBorderRadius6px, styles.uFontSize10px, styles.uFontWeight800, styles["uBackgroundrgba-16-185-129-0-12"], styles["uBorder1px-solid-rgba-16-185-129-0-35"], styles.uColor10b981, styles.uCursorpointer, styles.uTextTransformuppercase, styles["uLetterSpacing0-5px"], styles["uBoxShadow0-0-10px-rgba-16-185-129-0-15"], styles["uTransitionall-0-15s-ease"], styles.detailButton].join(' ')}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIncentivosModalOpen(true);
                            }}
                          >
                            <span>Ver Detalle</span>
                            <span className={[styles.uFontSize11px].join(' ')}>↗</span>
                          </button>
                        </div>
                      </div>
                      <div className={[styles.uFontSize22px, styles.uFontWeight900, styles.uColor10b981].join(' ')}>
                        {formatCurrency(analistaIndividualKpi.incentivoTotal)}
                      </div>
                      <div className={[styles.uMarginTop10px, styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-3-1fr"], styles.uGap8px, styles.uFontFamilyUi].join(' ')}>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles.uGap6px, styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uPadding5px-6px"], styles.uBorderRadius6px, styles.uTextAligncenter, styles.uWhiteSpacenowrap, styles.uMinWidth0].join(' ')}>
                          <span className={[styles["uFontSize9-5px"], styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-6px"]].join(' ')}>Cap</span>
                          <span className={[styles["uFontSize11-5px"], styles.uFontWeight800, styles["uColortext-strong"]].join(' ')}>{formatCurrency(analistaIndividualKpi.incentivoCap)}</span>
                        </div>

                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles.uGap6px, styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uPadding5px-6px"], styles.uBorderRadius6px, styles.uTextAligncenter, styles.uWhiteSpacenowrap, styles.uMinWidth0].join(' ')}>
                          <span className={[styles["uFontSize9-5px"], styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-6px"]].join(' ')}>Ops</span>
                          <span className={[styles["uFontSize11-5px"], styles.uFontWeight800, styles["uColortext-strong"]].join(' ')}>{formatCurrency(analistaIndividualKpi.incentivoOps)}</span>
                        </div>

                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles.uGap6px, styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uPadding5px-6px"], styles.uBorderRadius6px, styles.uTextAligncenter, styles.uWhiteSpacenowrap, styles.uMinWidth0].join(' ')}>
                          <span className={[styles["uFontSize9-5px"], styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-6px"]].join(' ')}>Cob</span>
                          <span className={[styles["uFontSize11-5px"], styles.uFontWeight800, styles["uColortext-strong"]].join(' ')}>
                            {formatCurrency((analistaIndividualKpi.incentivoCobTr90 || 0) + (analistaIndividualKpi.incentivoCobTr120 || 0) + (analistaIndividualKpi.incentivoCobRefin || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── BLOQUE DE PROYECCIÓN ── */}
                <div className={["analistas-autogrid", styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-auto-fit-minmax-400px-1fr"], styles.uGap16px, styles.uMarginTop0, styles.uAlignItemsstretch].join(' ')}>
                  <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding14px-20px"], styles["uBorder1px-solid-border-subtle"], styles.uDisplayflex, styles.uFlexDirectioncolumn, styles.uJustifyContentcenter].join(' ')}>
                    {kpiTotal.esMesActual && !kpiTotal.tieneDiasAdmin ? (
                      <div className={[styles.uFontSize11px, styles["uColortext-muted"], styles.uFontStyleitalic, styles.uTextAligncenter].join(' ')}>
                        Cargá días hábiles en Ajustes para ver proyección
                      </div>
                    ) : (
                      <div className={[styles.uDisplayflex, styles.uGap32px, styles.uFlex1].join(' ')}>
                       <div className={[styles.uDisplayflex, styles.uFlexDirectioncolumn, styles.uGap16px, styles.uFlex2, styles["uJustifyContentspace-between"]].join(' ')}>
                        <div className={[styles.uDisplayflex, styles.uGap32px].join(' ')}>
                          <div className={[styles.uFlex1].join(' ')}>
                            {kpiTotal.metaDiariaCapital !== null && (
                              <>
                                <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom6px].join(' ')}>Venta / día ({kpiTotal.esMesActual ? 'Necesario' : 'Meta'})</div>
                                <div className={[styles.uFontSize20px, styles.uFontWeight900, styles["uColortext-strong"]].join(' ')}>{formatCurrency(kpiTotal.metaDiariaCapital)}</div>
                                {kpiTotal.ventaPorDia !== null && <div className={[styles.uFontSize10px, styles["uColortext-muted"], styles.uFontWeight700, styles.uMarginTop4px].join(' ')}>RITMO: {formatCurrency(kpiTotal.ventaPorDia)}</div>}
                              </>
                            )}
                          </div>
                          <div className={[styles.uFlex1].join(' ')}>
                            {kpiTotal.metaDiariaOps !== null && (
                              <>
                                <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom6px].join(' ')}>Ops. / día ({kpiTotal.esMesActual ? 'Necesario' : 'Meta'})</div>
                                <div className={[styles.uFontSize20px, styles.uFontWeight900, styles["uColortext-strong"]].join(' ')}>{Math.round(kpiTotal.metaDiariaOps)}</div>
                                {kpiTotal.opsPorDia !== null && <div className={[styles.uFontSize10px, styles["uColortext-muted"], styles.uFontWeight700, styles.uMarginTop4px].join(' ')}>RITMO: {Math.round(kpiTotal.opsPorDia)}</div>}
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className={[styles.uHeight1px, styles["uBackgroundsurface-sunken"]].join(' ')} />

                        <div className={[styles.uDisplayflex, styles.uGap32px].join(' ')}>
                          <div className={[styles.uFlex1].join(' ')}>
                            {kpiTotal.proyCapital !== null && (
                              <>
                                <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom6px].join(' ')}>{kpiTotal.esMesActual ? 'Proy. fin mes (K)' : 'Final mes (K)'}</div>
                                <div className={[styles.uDisplayflex, styles.uAlignItemsbaseline, styles.uGap8px].join(' ')}>
                                  <div className={[styles.uFontSize20px, styles.uFontWeight900].join(' ')} style={{ color: kpiTotal.proyCapital >= kpiTotal.metaCapital ? '#10b981' : '#f87171' }}>{formatCurrency(kpiTotal.proyCapital)}</div>
                                  {kpiTotal.cumplProyCapital !== null && (
                                    <span className={[styles.uFontSize12px, styles.uFontWeight800].join(' ')} style={{ color: kpiTotal.cumplProyCapital >= 100 ? '#10b981' : '#f87171' }}>
                                      ({kpiTotal.cumplProyCapital.toFixed(2)}%)
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          <div className={[styles.uFlex1].join(' ')}>
                            {kpiTotal.proyOps !== null && (
                              <>
                                <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom6px].join(' ')}>{kpiTotal.esMesActual ? 'Proy. fin mes (Q)' : 'Final mes (Q)'}</div>
                                <div className={[styles.uDisplayflex, styles.uAlignItemsbaseline, styles.uGap8px].join(' ')}>
                                  <div className={[styles.uFontSize20px, styles.uFontWeight900].join(' ')} style={{ color: kpiTotal.proyOps >= kpiTotal.metaOps ? '#10b981' : '#f87171' }}>{Math.round(kpiTotal.proyOps)}</div>
                                  {kpiTotal.cumplProyOps !== null && (
                                    <span className={[styles.uFontSize12px, styles.uFontWeight800].join(' ')} style={{ color: kpiTotal.cumplProyOps >= 100 ? '#10b981' : '#f87171' }}>
                                      ({kpiTotal.cumplProyOps.toFixed(2)}%)
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className={[styles.uHeight1px, styles["uBackgroundsurface-sunken"]].join(' ')} />

                        <div className={[styles.uDisplayflex, styles.uGap32px].join(' ')}>
                          <div className={[styles.uFlex1].join(' ')}>
                            {kpiTotal.faltaCapital !== null && (
                              <>
                                <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom6px].join(' ')}>Falta 100% (K)</div>
                                <div className={[styles.uFontSize20px, styles.uFontWeight900].join(' ')} style={{ color: kpiTotal.faltaCapital === 0 ? '#10b981' : '#f87171' }}>{formatCurrency(kpiTotal.faltaCapital)}</div>
                              </>
                            )}
                          </div>
                          <div className={[styles.uFlex1].join(' ')}>
                            {kpiTotal.faltaOps !== null && (
                              <>
                                <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom6px].join(' ')}>Falta 100% (Q)</div>
                                <div className={[styles.uFontSize20px, styles.uFontWeight900].join(' ')} style={{ color: kpiTotal.faltaOps === 0 ? '#10b981' : '#f87171' }}>{Math.round(kpiTotal.faltaOps || 0)}</div>
                              </>
                            )}
                          </div>
                        </div>

                       </div>

                       <div className={[styles.uWidth1px, styles["uBackgroundrgba-255-255-255-0-06"], styles.uAlignSelfstretch].join(' ')} />

                       <div className={[styles.uFlex1, styles.uDisplayflex, styles.uFlexDirectioncolumn, styles.uJustifyContentcenter, styles.uGap20px].join(' ')}>
                         <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px].join(' ')}>
                           {CONFIG.MESES_NOMBRES[mesPrev - 1]} al día {kpiTotal.diaCorte}
                         </div>
                         <div>
                           <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom6px].join(' ')}>Ventas (K)</div>
                           <div className={[styles.uDisplayflex, styles.uAlignItemsbaseline, styles.uGap8px].join(' ')}>
                             <div className={[styles.uFontSize20px, styles.uFontWeight900, styles["uColortext-strong"]].join(' ')}>{formatCurrency(kpiTotal.capitalAntFecha)}</div>
                             {kpiTotal.varCapitalFecha !== null && (
                               <span className={[styles.uFontSize12px, styles.uFontWeight800].join(' ')} style={{ color: kpiTotal.varCapitalFecha >= 0 ? '#10b981' : '#f87171' }}>
                                 {kpiTotal.varCapitalFecha >= 0 ? '▲' : '▼'} {Math.abs(kpiTotal.varCapitalFecha).toFixed(2)}%
                               </span>
                             )}
                           </div>
                         </div>
                         <div>
                           <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles.uMarginBottom6px].join(' ')}>Operaciones (Q)</div>
                           <div className={[styles.uDisplayflex, styles.uAlignItemsbaseline, styles.uGap8px].join(' ')}>
                             <div className={[styles.uFontSize20px, styles.uFontWeight900, styles["uColortext-strong"]].join(' ')}>{kpiTotal.opsAntFecha}</div>
                             {kpiTotal.varOpsFecha !== null && (
                               <span className={[styles.uFontSize12px, styles.uFontWeight800].join(' ')} style={{ color: kpiTotal.varOpsFecha >= 0 ? '#10b981' : '#f87171' }}>
                                 {kpiTotal.varOpsFecha >= 0 ? '▲' : '▼'} {Math.abs(kpiTotal.varOpsFecha).toFixed(2)}%
                               </span>
                             )}
                           </div>
                         </div>
                       </div>
                      </div>
                    )}
                  </div>

                  <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding14px-16px"], styles["uBorder1px-solid-border-subtle"], styles.uDisplayflex, styles.uFlexDirectioncolumn].join(' ')}>
                    <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"], styles.uMarginBottom10px].join(' ')}>Progreso vs Ideal</div>
                    <div className={[styles.uHeight320px, styles.uPositionrelative, styles.uWidth100].join(' ')}>
                      {chartsLoaded ? (
                        <Line data={chartProgreso} options={chartProgresoOptions as any} plugins={[lineShadowPlugin]} />
                      ) : (
                        <ChartShimmer />
                      )}
                    </div>
                  </div>
                </div>
                </>
                )}
                </>
              </div>

          {/* ── SECCIÓN 2: GRÁFICOS ── */}
          <div className={["data-card", styles["uBackgroundlinear-gradient-180deg-rgba-255-255-255-0-"], styles["uBoxShadowshadow-md"]].join(' ')}>
            {sectionHeader(2, '2. Gráficos', <BarChart3 size={15} color="#a78bfa" />)}
              <>
                <div className={[styles.uMarginBottom28px].join(' ')}>
                  <div className={["analistas-autogrid", styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-auto-fit-minmax-280px-1fr"], styles.uGap16px].join(' ')}>
                    {/* 1. Cumplimiento */}
                    <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding14px-16px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                      <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom10px].join(' ')}>
                        <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"]].join(' ')}>% Cumplimiento — Actual vs {mesAntLabel}</div>
                        <div className={[styles.uDisplayflex, styles.uGap10px].join(' ')}>
                          <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                            <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles["uBackgroundrgba-96-165-250-0-8"]].join(' ')} />
                            <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                          </div>
                          <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                            <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles["uBackgroundrgba-30-58-138-0-9"]].join(' ')} />
                            <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                          </div>
                        </div>
                      </div>
                      <div className={[styles.uHeight224px].join(' ')} id="chart-cumplimiento">
                        {chartsLoaded ? (
                          <Bar data={chartCumplimiento as any} options={baseChartOpts('%', false, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                        ) : (
                          <ChartShimmer />
                        )}
                      </div>
                    </div>

                    {/* 2. Variación */}
                    <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding14px-16px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                      <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom10px].join(' ')}>
                        <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"]].join(' ')}>Variación % vs {mesAntLabel}</div>
                        <div className={[styles.uDisplayflex, styles.uGap10px].join(' ')}>
                          <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                            <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles["uBackgroundrgba-52-211-153-0-7"]].join(' ')} />
                            <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>Positivo</span>
                          </div>
                          <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px].join(' ')}>
                            <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50, styles["uBackgroundrgba-248-113-113-0-7"]].join(' ')} />
                            <span className={[styles.uFontSize9px, styles.uFontWeight700, styles["uColortext-muted"], styles.uTextTransformuppercase].join(' ')}>Negativo</span>
                          </div>
                        </div>
                      </div>
                      <div className={[styles.uHeight224px].join(' ')} id="chart-variacion">
                        {chartsLoaded ? (
                          <Bar data={chartVariacion} options={baseChartOpts('%', false, true, false, false, analista !== 'PDV')} plugins={[labelsPlugin, referenceLinesPlugin]} />
                        ) : (
                          <ChartShimmer />
                        )}
                      </div>
                    </div>

                    {/* 3. Embudo */}
                    {/* 3. Acuerdos por Analista */}
                    <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding14px-16px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                      <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom10px].join(' ')}>
                        <div className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"]].join(' ')}>
                          Distribución de Acuerdos
                        </div>
                        <div className="report-period-toggle">
                          <button
                            onClick={() => setPeriodoAcuerdos('mensual')}
                            className={[periodoAcuerdos === 'mensual' ? 'is-active' : undefined, styles["uPadding2px-8px"], styles.uBorderRadius4px, styles.uBordernone, styles.uCursorpointer, styles.uFontSize9px, styles.uFontWeight800, styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"], styles["uTransitionall-0-2s-ease"]].filter(Boolean).join(' ')}
                            style={{ background: periodoAcuerdos === 'mensual' ? '#fb923c' : 'transparent', color: periodoAcuerdos === 'mensual' ? '#000' : '#666' }}
                          >
                            MES
                          </button>
                          <button
                            onClick={() => setPeriodoAcuerdos('total')}
                            className={[periodoAcuerdos === 'total' ? 'is-active' : undefined, styles["uPadding2px-8px"], styles.uBorderRadius4px, styles.uBordernone, styles.uCursorpointer, styles.uFontSize9px, styles.uFontWeight800, styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"], styles["uTransitionall-0-2s-ease"]].filter(Boolean).join(' ')}
                            style={{ background: periodoAcuerdos === 'total' ? '#fb923c' : 'transparent', color: periodoAcuerdos === 'total' ? '#000' : '#666' }}
                          >
                            TOTAL
                          </button>
                        </div>
                      </div>
                      {(() => {
                        const regs = periodoAcuerdos === 'mensual' ? ventasMes.filter(isVenta) : registros;
                        
                        const categories = ['PREMIUM', 'Riesgo MEDIO', 'Riesgo BAJO', 'No califica'];
                        const bgColors = ['#5f927f', '#607da8', '#b98944', '#b86b6b'];
                        const displayLabels = categories;
                        
                        const displayData = categories.map(cat => {
                          return regs.filter(r => {
                             const ac = (r.acuerdo_precios || '').toLowerCase();
                             if (cat === 'PREMIUM') return ac.includes('premium');
                             if (cat === 'Riesgo MEDIO') return ac.includes('medio');
                             if (cat === 'Riesgo BAJO') return ac.includes('bajo');
                             if (cat === 'No califica') return ac.includes('no califica') || ac === 'n/c';
                             return false;
                          }).length;
                        });

                        const total = displayData.reduce((s, v) => s + v, 0);
                        const chartData = {
                          labels: displayLabels,
                          datasets: [{
                            data: displayData,
                            backgroundColor: bgColors,
                            borderWidth: 0,
                            hoverOffset: 10,
                            borderRadius: 4,
                            spacing: 4
                          }]
                        };

                        return chartsLoaded ? (
                          <div className={[styles.uHeight224px, styles.uDisplayflex, styles.uFlexDirectioncolumn, styles.uAlignItemscenter, styles.uJustifyContentcenter].join(' ')}>
                            <ModernDoughnut data={chartData} label="Acuerdos" value={`${total} Ops`} padding={32} height="174px" width="210px" labelSize={8} valueSize={15} />
                            <div className={["report-chart-legend", styles.uDisplayflex, styles.uFlexWrapwrap, styles.uJustifyContentcenter].join(' ')}>
                              {displayLabels.map((l, i) => {
                                const pct = total > 0 ? (displayData[i] / total * 100).toFixed(1) : '0';
                                return (
                                  <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap6px].join(' ')} key={l}>
                                    <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50].join(' ')} style={{ background: bgColors[i] }} />
                                    <span className={[styles.uFontSize9px, styles["uColortext-muted"], styles.uFontWeight700, styles.uTextTransformuppercase].join(' ')}>{l} ({pct}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className={styles.uHeight224px}><ChartShimmer /></div>
                        );
                      })()}
                    </div>

                    {/* 4. Empleo */}
                    <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius10px, styles["uPadding14px-16px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                      <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom10px].join(' ')}>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap6px].join(' ')}>
                          <div className={[styles.uWidth3px, styles.uHeight12px, styles.uBackground34d399, styles.uBorderRadius2px].join(' ')} />
                          <span className={[styles.uFontSize10px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"]].join(' ')}>
                            % Empleo Público / Privado
                          </span>
                        </div>
                        <div className="report-period-toggle">
                          <button
                            onClick={() => setPeriodoEmpleo('mensual')}
                            className={[periodoEmpleo === 'mensual' ? 'is-active' : undefined, styles["uPadding2px-8px"], styles.uBorderRadius4px, styles.uBordernone, styles.uCursorpointer, styles.uFontSize9px, styles.uFontWeight800, styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"], styles["uTransitionall-0-2s-ease"]].filter(Boolean).join(' ')}
                            style={{ background: periodoEmpleo === 'mensual' ? '#fb923c' : 'transparent', color: periodoEmpleo === 'mensual' ? '#000' : '#666' }}
                          >
                            MES
                          </button>
                          <button
                            onClick={() => setPeriodoEmpleo('total')}
                            className={[periodoEmpleo === 'total' ? 'is-active' : undefined, styles["uPadding2px-8px"], styles.uBorderRadius4px, styles.uBordernone, styles.uCursorpointer, styles.uFontSize9px, styles.uFontWeight800, styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"], styles["uTransitionall-0-2s-ease"]].filter(Boolean).join(' ')}
                            style={{ background: periodoEmpleo === 'total' ? '#fb923c' : 'transparent', color: periodoEmpleo === 'total' ? '#000' : '#666' }}
                          >
                            TOTAL
                          </button>
                        </div>
                      </div>
                      {(() => {
                        const counts = chartEmpleoPublPriv.datasets[0].data as number[];
                        const total = counts.reduce((s, v) => s + v, 0);
                        
                        return chartsLoaded ? (
                          <div className={[styles.uHeight224px, styles.uDisplayflex, styles.uFlexDirectioncolumn, styles.uAlignItemscenter, styles.uJustifyContentcenter].join(' ')}>
                            <ModernDoughnut data={chartEmpleoPublPriv} label="Total" value={`${total} Ops`} padding={32} height="174px" width="210px" labelSize={8} valueSize={15} />
                            <div className={["report-chart-legend", styles.uDisplayflex, styles.uFlexWrapwrap, styles.uJustifyContentcenter].join(' ')}>
                              {chartEmpleoPublPriv.labels.map((l, i) => {
                                const val = counts[i];
                                const pct = total > 0 ? (val / total * 100).toFixed(1) : '0';
                                return (
                                  <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap6px].join(' ')} key={l}>
                                    <div className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50].join(' ')} style={{ background: (chartEmpleoPublPriv.datasets[0].backgroundColor as string[])[i] }} />
                                    <span className={[styles.uFontSize9px, styles["uColortext-muted"], styles.uFontWeight700, styles.uTextTransformuppercase].join(' ')}>{l} ({pct}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className={styles.uHeight224px}><ChartShimmer /></div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </>
          </div>

          {/* ── SECCIÓN 3: VENTAS POR CATEGORÍA ── */}
          <div className={["data-card", styles["uBackgroundlinear-gradient-180deg-rgba-255-255-255-0-"], styles["uBoxShadowshadow-md"]].join(' ')}>
            <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap8px, styles.uMarginBottom0].join(' ')}>
              <div className={[styles.uFlex1].join(' ')}>{sectionHeader(3, '3. Ventas por Categoría', <Tag size={15} color="#fb923c" />)}</div>
              <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap12px, styles.uMarginBottom20px].join(' ')}>
                <span className={[styles.uFontSize11px, styles["uColortext-muted"], styles.uFontWeight600].join(' ')}>
                  {periodoSec3 === 'mensual'
                    ? (() => {
                        const v = ventasMes.filter(isVenta);
                        return `MES: Solo Venta y Aprob. CC (${v.length} ops · ${formatCurrency(v.reduce((s, r) => s + (Number(r.monto) || 0), 0))})`;
                      })()
                    : `TOTAL: Todos los estados (${registros.length} ops · ${formatCurrency(registros.reduce((s, r) => s + (Number(r.monto) || 0), 0))})`}
                </span>
                <div className="report-period-toggle">
                  {(['mensual', 'total'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriodoSec3(p)}
                      className={[periodoSec3 === p ? 'is-active' : undefined, styles["uPadding4px-14px"], styles.uBorderRadius6px, styles.uBordernone, styles.uCursorpointer, styles.uFontSize10px, styles.uFontWeight800, styles.uTextTransformuppercase, styles["uLetterSpacing0-8px"], styles["uTransitionall-0-2s-ease"]].filter(Boolean).join(' ')}
                      style={{ background: periodoSec3 === p ? '#fb923c' : 'transparent', color: periodoSec3 === p ? '#000' : '#555' }}
                    >
                      {p === 'mensual' ? 'Mes' : 'Total'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={[styles.uDisplayflex, styles.uGap16px, styles.uFlexWrapwrap, styles.uMarginBottom16px].join(' ')}>
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
                    <DistBlock theme="elevated" titulo="Acuerdo" icon={<PieChart size={12} color="#a66f4b" />} datos={ac} color="#a66f4b" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Cuotas" icon={<BarChart3 size={12} color="#6f88a8" />} datos={cu} color="#6f88a8" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Rango Etario" icon={<Users size={12} color="#668e80" />} datos={re} color="#668e80" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Sexo" icon={<Users size={12} color="#9a7185" />} datos={sx} color="#9a7185" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Empleador" icon={<Shield size={12} color="#aa8a4f" />} datos={em} color="#aa8a4f" totalMes={base} />
                    <DistBlock theme="elevated" titulo="Localidad" icon={<FileText size={12} color="#83799a" />} datos={lo} color="#83799a" totalMes={base} />
                  </>
                );
              })()}
            </div>
          </div>

          {/* ── SECCIÓN 4 Y SHEETS: GRID ── */}
          <div className={["analistas-autogrid", styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-auto-fit-minmax-400px-1fr"], styles.uGap24px, styles.uMarginBottom32px].join(' ')}>
            <div className={["data-card", styles.uMargin0, styles.uHeight100, styles["uBackgroundlinear-gradient-180deg-rgba-255-255-255-0-"], styles["uBoxShadowshadow-md"]].join(' ')}>
              <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom16px, styles.uPaddingBottom10px, styles["uBorderBottom1px-solid-border-subtle"], styles.uGap12px, styles.uUserSelectnone].join(' ')}>
                <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap8px].join(' ')}>
                  <PieChart size={15} color="#4ade80" />
                  <span className={[styles.uFontSize13px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px].join(' ')}>4. Distribucion por Estado</span>
                </div>
                <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap10px].join(' ')}>
                  <CustomSelect
                    value={sec4Mes}
                    onChange={val => setSec4Mes(String(val))}
                    options={[{ label: 'Todos', value: '' }, ...CONFIG.MESES_NOMBRES.map((m, i) => ({ label: m, value: String(i + 1).padStart(2, '0') }))]}
                    width="140px"
                    bg="#ffffff"
                  />
                  <CustomSelect
                    value={sec4Anio}
                    onChange={val => setSec4Anio(Number(val))}
                    options={[2024, 2025, 2026].map(y => ({ label: String(y), value: y }))}
                    width="100px"
                    bg="#ffffff"
                  />
                </div>
              </div>
              <MetricasTab hideSelector reportAppearance mesStr={sec4Mes} anioNum={sec4Anio} registros={registros} analista={analista} analistas={analistasDefault} />
            </div>
            <NuevaSeccionSheets reportAppearance analista={analista} />
          </div>


      </div>

      {rendimiento12MOpen && (
        <ModalPortal>
        <div className={[styles.uPositionfixed, styles.uInset0, styles.uZIndex9999, styles["uBackgroundrgba-0-0-0-0-65"], styles["uBackdropFilterblur-4px"], styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles.uPadding24px].join(' ')}
          onClick={() => setRendimiento12MOpen(false)}
        >
          <div className={[styles["uBackgroundsurface-card"], styles["uBorder1px-solid-border-subtle"], styles.uBorderRadius18px, styles.uPadding24px, styles["uWidthmin-1480px-100"], styles.uMaxHeight90vh, styles.uOverflowauto, styles["uBoxShadowshadow-md"]].join(' ')}
            onClick={e => e.stopPropagation()}
          >
            <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom18px, styles.uGap12px].join(' ')}>
              <div className={[styles.uFontSize12px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles["uLetterSpacing1-5px"]].join(' ')}>
                Rendimiento por Año {analista !== 'PDV' && `— ${analista}`}
              </div>
              <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap8px].join(' ')}>
                {isAdmin && (
                  <div className={[styles.uDisplayflex, styles.uGap4px, styles.uMarginRight16px, styles["uBackgroundsurface-sunken"], styles.uPadding4px, styles.uBorderRadius8px].join(' ')}>
                    {['OBJETIVO', 'ALCANCE', 'VAR.', 'CUMPL.'].map(col => {
                      const isHidden = hiddenCols.includes(col);
                      return (
                        <button className={[styles.uBordernone, styles.uBorderRadius6px, styles["uPadding4px-8px"], styles.uFontSize10px, styles.uFontWeight800, styles.uCursorpointer, styles["uTransitionall-0-2s"]].join(' ')}
                          key={col}
                          onClick={() => setHiddenCols(prev => isHidden ? prev.filter(c => c !== col) : [...prev, col])}
                          style={{ background: isHidden ? 'transparent' : 'rgba(255,255,255,0.1)', color: isHidden ? '#555' : '#aaa', textDecoration: isHidden ? 'line-through' : 'none' }}
                          title={isHidden ? `Mostrar columna ${col}` : `Ocultar columna ${col}`}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                )}
                {isAdmin && (
                  <CustomSelect
                    value={mesRendimiento}
                    onChange={raw => {
                      const val = raw === 'TODOS' ? 'TODOS' : Number(raw);
                      setMesRendimiento(val);
                      if (val !== 'TODOS') setAnioRendimiento('TODOS');
                    }}
                    options={[{ label: 'Todos los Meses', value: 'TODOS' }, ...CONFIG.MESES_NOMBRES.map((m: string, i: number) => ({ label: m, value: i }))]}
                    width="150px"
                  />
                )}

                <button className={[styles.uBackgroundtransparent, styles["uBorder1px-solid-rgba-255-255-255-0-1"], styles.uBorderRadius8px, styles.uWidth32px, styles.uHeight32px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles["uColortext-muted"], styles.uCursorpointer].join(' ')}
                  type="button"
                  onClick={() => {
                    if (anioRendimiento === 'TODOS') return;
                    const idx = aniosDisponiblesRendimiento.indexOf(anioRendimiento as number);
                    const next = aniosDisponiblesRendimiento[idx + 1];
                    if (next !== undefined) setAnioRendimiento(next);
                  }}
                  disabled={anioRendimiento === 'TODOS' || aniosDisponiblesRendimiento.indexOf(anioRendimiento as number) >= aniosDisponiblesRendimiento.length - 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <CustomSelect
                  value={anioRendimiento}
                  onChange={raw => setAnioRendimiento(raw === 'TODOS' ? 'TODOS' : Number(raw))}
                  options={[
                    ...(isAdmin ? [{ label: 'Todos los Años', value: 'TODOS' }] : []),
                    ...aniosDisponiblesRendimiento.map(a => ({ label: String(a), value: a })),
                  ]}
                  width="120px"
                />
                <button className={[styles.uBackgroundtransparent, styles["uBorder1px-solid-rgba-255-255-255-0-1"], styles.uBorderRadius8px, styles.uWidth32px, styles.uHeight32px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles["uColortext-muted"], styles.uCursorpointer].join(' ')}
                  type="button"
                  onClick={() => {
                    if (anioRendimiento === 'TODOS') return;
                    const idx = aniosDisponiblesRendimiento.indexOf(anioRendimiento as number);
                    const prev = aniosDisponiblesRendimiento[idx - 1];
                    if (prev !== undefined) setAnioRendimiento(prev);
                  }}
                  disabled={anioRendimiento === 'TODOS' || aniosDisponiblesRendimiento.indexOf(anioRendimiento as number) <= 0}
                >
                  <ChevronRight size={16} />
                </button>
                <button className={[styles.uBackgroundtransparent, styles["uBorder1px-solid-rgba-255-255-255-0-1"], styles.uBorderRadius8px, styles.uWidth32px, styles.uHeight32px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles["uColortext-muted"], styles.uCursorpointer, styles.uMarginLeft8px].join(' ')}
                  type="button"
                  onClick={() => setRendimiento12MOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {anioRendimiento === 'TODOS' && mesRendimiento === 'TODOS' ? (
              <div className={[styles.uDisplayflex, styles.uFlexDirectioncolumn, styles.uGap32px].join(' ')}>
                {aniosDisponiblesRendimiento.slice().sort((a,b) => b - a).map(anio => {
                  const bucketsYear = mesesAnioKQ.filter(b => b.anio === anio);
                  if (bucketsYear.length === 0) return null;
                  return (
                    <div key={anio}>
                      <div className={[styles.uFontSize16px, styles.uFontWeight900, styles["uColortext-strong"], styles.uMarginBottom12px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap8px].join(' ')}>
                        <div className={[styles.uWidth4px, styles.uHeight16px, styles.uBackgrounda78bfa, styles.uBorderRadius4px].join(' ')} />
                        AÑO {anio}
                      </div>
                      <div className={[styles.uDisplaygrid, styles["uGridTemplateColumns1fr-1fr"], styles.uGap16px].join(' ')}>
                        <Mini12Table
                          label="CAPITAL"
                          total={formatCurrency(bucketsYear.reduce((s, b) => s + b.monto, 0))}
                          buckets={bucketsYear}
                          accessor={b => b.monto}
                          metaAccessor={b => b.metaK}
                          formatValue={v => formatCurrency(v)}
                          hiddenCols={hiddenCols}
                        />
                        <Mini12Table
                          label="OPERACIONES"
                          total={String(bucketsYear.reduce((s, b) => s + b.ops, 0))}
                          buckets={bucketsYear}
                          accessor={b => b.ops}
                          metaAccessor={b => b.metaQ}
                          formatValue={v => String(v)}
                          hiddenCols={hiddenCols}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={[styles.uDisplaygrid, styles["uGridTemplateColumns1fr-1fr"], styles.uGap16px].join(' ')}>
                <Mini12Table
                  label="CAPITAL"
                  total={formatCurrency(mesesAnioKQ.reduce((s, b) => s + b.monto, 0))}
                  buckets={mesesAnioKQ}
                  accessor={b => b.monto}
                  metaAccessor={b => b.metaK}
                  formatValue={v => formatCurrency(v)}
                  hiddenCols={hiddenCols}
                />
                <Mini12Table
                  label="OPERACIONES"
                  total={String(mesesAnioKQ.reduce((s, b) => s + b.ops, 0))}
                  buckets={mesesAnioKQ}
                  accessor={b => b.ops}
                  metaAccessor={b => b.metaQ}
                  formatValue={v => String(v)}
                  hiddenCols={hiddenCols}
                />
              </div>
            )}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── MODAL: CÁLCULO DE INCENTIVOS ── */}
      {incentivosModalOpen && (
        <ModalPortal>
        <div className={[styles.uPositionfixed, styles.uInset0, styles.uZIndex9999, styles["uBackgroundrgba-0-0-0-0-7"], styles["uBackdropFilterblur-6px"], styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles.uPadding24px].join(' ')}
          onClick={() => setIncentivosModalOpen(false)}
        >
          <div className={[styles["uBackgroundsurface-card"], styles["uBorder1px-solid-border-subtle"], styles.uBorderRadius18px, styles.uPadding28px, styles["uWidthmin-1280px-100"], styles.uMaxHeight90vh, styles.uOverflowauto, styles["uBoxShadowshadow-md"], styles.uFontFamilyUi].join(' ')}
            onClick={e => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom24px, styles.uPaddingBottom14px, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>
              <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap12px].join(' ')}>
                <div className={[styles.uWidth36px, styles.uHeight36px, styles.uBorderRadius10px, styles["uBackgroundrgba-16-185-129-0-12"], styles["uBorder1px-solid-rgba-16-185-129-0-25"], styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles.uColor10b981].join(' ')}>
                  <Calculator size={18} />
                </div>
                <div>
                  <div className={[styles.uFontSize18px, styles.uFontWeight900, styles["uColortext-strong"], styles["uLetterSpacing0-3px"]].join(' ')}>
                    Cálculo de Incentivos — {analista}
                  </div>
                  <div className={[styles.uFontSize12px, styles["uColortext-muted"], styles.uMarginTop2px].join(' ')}>
                    Escalas de liquidación e ingreso manual de cobranzas
                  </div>
                </div>
              </div>

              <button className={[styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles.uBorderRadius8px, styles.uWidth32px, styles.uHeight32px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uJustifyContentcenter, styles["uColortext-muted"], styles.uCursorpointer, styles["uTransitionall-0-2s-ease"], styles.closeButton].join(' ')}
                type="button"
                onClick={() => setIncentivosModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Escalas: 3 Columnas */}
            <div className={["analistas-autogrid", styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-auto-fit-minmax-300px-1fr"], styles.uGap20px, styles.uMarginBottom28px].join(' ')}>
              {/* Reglas de Capital */}
              <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius12px, styles.uPadding18px, styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                <div className={[styles.uFontSize11px, styles.uFontWeight800, styles.uColora78bfa, styles.uTextTransformuppercase, styles.uMarginBottom12px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap8px, styles["uLetterSpacing0-8px"]].join(' ')}>
                  <Target size={14} /> Escala de Incentivos - Capital
                </div>
                <table className={[styles.uWidth100, styles.uFontSize13px, styles.uBorderCollapsecollapse].join(' ')}>
                  <thead>
                    <tr className={[styles["uBorderBottom1px-solid-rgba-255-255-255-0-1"]].join(' ')}>
                      <th className={[styles.uTextAlignleft, styles["uPadding10px-4px"], styles["uColortext-muted"], styles.uFontSize11px, styles.uFontWeight800].join(' ')}>ALCANCE</th>
                      <th className={[styles.uTextAlignright, styles["uPadding10px-4px"], styles["uColortext-muted"], styles.uFontSize11px, styles.uFontWeight800].join(' ')}>COEFICIENTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { a: '75% < 90%', c: '0.20%' },
                      { a: '90% < 110%', c: '0.30%' },
                      { a: '110% < 120%', c: '0.37%' },
                      { a: '>= 120%', c: '0.45%' },
                    ].map((r, i) => (
                      <tr className={[styles["uBorderBottom1px-solid-border-subtle"]].join(' ')} key={i}>
                        <td className={[styles["uPadding10px-4px"], styles["uColortext-muted"]].join(' ')}>{r.a}</td>
                        <td className={[styles["uPadding10px-4px"], styles.uTextAlignright, styles["uColortext-strong"], styles.uFontWeight800].join(' ')}>{r.c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className={[styles.uMarginTop12px, styles.uFontSize11px, styles["uColortext-muted"], styles.uFontStyleitalic, styles["uLineHeight1-5"]].join(' ')}>
                  * El tope máximo para Ventas (K + Q) es de $200,000.<br/>
                  * El tope máximo para Cobranzas es de $50,000 (Tope total: $250,000).
                </div>
              </div>

              {/* Reglas de Operaciones */}
              <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius12px, styles.uPadding18px, styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                <div className={[styles.uFontSize11px, styles.uFontWeight800, styles.uColor34d399, styles.uTextTransformuppercase, styles.uMarginBottom12px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap8px, styles["uLetterSpacing0-8px"]].join(' ')}>
                  <Activity size={14} /> Escala de Incentivos - Operaciones
                </div>
                <table className={[styles.uWidth100, styles.uFontSize13px, styles.uBorderCollapsecollapse].join(' ')}>
                  <thead>
                    <tr className={[styles["uBorderBottom1px-solid-rgba-255-255-255-0-1"]].join(' ')}>
                      <th className={[styles.uTextAlignleft, styles["uPadding10px-4px"], styles["uColortext-muted"], styles.uFontSize11px, styles.uFontWeight800].join(' ')}>ALCANCE</th>
                      <th className={[styles.uTextAlignright, styles["uPadding10px-4px"], styles["uColortext-muted"], styles.uFontSize11px, styles.uFontWeight800].join(' ')}>COEFICIENTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { a: '80% y 99.99%', c: '20%' },
                      { a: '>= 100%', c: '30%' },
                    ].map((r, i) => (
                      <tr className={[styles["uBorderBottom1px-solid-border-subtle"]].join(' ')} key={i}>
                        <td className={[styles["uPadding10px-4px"], styles["uColortext-muted"]].join(' ')}>{r.a}</td>
                        <td className={[styles["uPadding10px-4px"], styles.uTextAlignright, styles["uColortext-strong"], styles.uFontWeight800].join(' ')}>{r.c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className={[styles.uMarginTop12px, styles.uFontSize11px, styles["uColortext-muted"], styles.uFontStyleitalic].join(' ')}>
                  * Requiere alcance mínimo de 75% en Capital.
                </div>
              </div>

              {/* Reglas de Cobranzas */}
              <div className={[styles["uBackgroundsurface-sunken"], styles.uBorderRadius12px, styles.uPadding18px, styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                <div className={[styles.uFontSize11px, styles.uFontWeight800, styles.uColorfb923c, styles.uTextTransformuppercase, styles.uMarginBottom12px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap8px, styles["uLetterSpacing0-8px"]].join(' ')}>
                  <DollarSign size={14} /> Escala de Incentivos - Cobranzas
                </div>
                <table className={[styles.uWidth100, styles.uFontSize12px, styles.uBorderCollapsecollapse].join(' ')}>
                  <thead>
                    <tr className={[styles["uBorderBottom1px-solid-rgba-255-255-255-0-1"]].join(' ')}>
                      <th className={[styles.uTextAlignleft, styles["uPadding8px-4px"], styles["uColortext-muted"], styles.uFontSize11px, styles.uFontWeight800].join(' ')}>CONCEPTO</th>
                      <th className={[styles.uTextAlignleft, styles["uPadding8px-4px"], styles["uColortext-muted"], styles.uFontSize11px, styles.uFontWeight800].join(' ')}>ALCANCE</th>
                      <th className={[styles.uTextAlignright, styles["uPadding8px-4px"], styles["uColortext-muted"], styles.uFontSize11px, styles.uFontWeight800].join(' ')}>PREMIO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { n: 'TRAMO 90-119', a: '90% - 99.99%', p: '$12.643' },
                      { n: 'TRAMO 90-119', a: '>= 100%', p: '$16.667' },
                      { n: 'TRAMO 120-209', a: '90% - 99.99%', p: '$12.643' },
                      { n: 'TRAMO 120-209', a: '>= 100%', p: '$16.667' },
                      { n: 'REFINANCIACION', a: '90% - 109.99%', p: '$12.643' },
                      { n: 'REFINANCIACION', a: '>= 110%', p: '$16.667' },
                    ].map((r, i) => (
                      <tr className={[styles["uBorderBottom1px-solid-border-subtle"]].join(' ')} key={i}>
                        <td className={[styles["uPadding8px-4px"], styles["uColortext-muted"], styles.uFontSize11px].join(' ')}>{r.n}</td>
                        <td className={[styles["uPadding8px-4px"], styles["uColortext-muted"]].join(' ')}>{r.a}</td>
                        <td className={[styles["uPadding8px-4px"], styles.uTextAlignright, styles["uColortext-strong"], styles.uFontWeight800].join(' ')}>{r.p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className={[styles.uMarginTop16px, styles.uPaddingTop16px, styles["uBorderTop1px-solid-border-subtle"]].join(' ')}>
                  <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentspace-between"], styles.uMarginBottom8px].join(' ')}>
                    <div className={[styles.uFontSize10px, styles.uFontWeight800, styles.uColorfb923c, styles.uTextTransformuppercase, styles["uLetterSpacing0-6px"]].join(' ')}>
                      Ingreso Manual de Cumplimiento (%)
                    </div>
                    {Boolean(
                      (currentCobranzas.pctTr90 !== undefined && currentCobranzas.pctTr90 !== '') ||
                      (currentCobranzas.pctTr120 !== undefined && currentCobranzas.pctTr120 !== '') ||
                      (currentCobranzas.pctRefin !== undefined && currentCobranzas.pctRefin !== '')
                    ) && (
                      <button className={[styles["uBackgroundrgba-239-68-68-0-1"], styles["uBorder1px-solid-rgba-239-68-68-0-25"], styles.uColorf87171, styles.uFontSize10px, styles.uFontWeight700, styles.uCursorpointer, styles["uPadding2px-8px"], styles.uBorderRadius4px, styles.uDisplayflex, styles.uAlignItemscenter, styles.uGap4px, styles["uTransitionall-0-15s-ease"], styles.clearButton].join(' ')}
                        type="button"
                        onClick={handleClearManualCob}
                        title="Borrar porcentajes guardados de cobranzas"
                      >
                        <Trash2 size={11} /> Borrar
                      </button>
                    )}
                  </div>
                  <div className={[styles.uDisplaygrid, styles["uGridTemplateColumnsrepeat-3-1fr"], styles.uGap8px].join(' ')}>
                    <div>
                      <div className={[styles.uFontSize10px, styles["uColortext-muted"], styles.uMarginBottom4px].join(' ')}>TR 90</div>
                      <input className={[styles.uWidth100, styles["uBackgroundsurface-card"], styles["uBorder1px-solid-border-subtle"], styles.uBorderRadius4px, styles["uPadding6px-10px"], styles.uFontSize13px, styles["uColortext-strong"], styles.uOutlinenone].join(' ')}
                        type="number" 
                        value={currentCobranzas.pctTr90 ?? ''} 
                        onChange={(e) => handleManualCobChange('pctTr90', e.target.value)}
                        placeholder="0%"
                      />
                    </div>
                    <div>
                      <div className={[styles.uFontSize10px, styles["uColortext-muted"], styles.uMarginBottom4px].join(' ')}>TR 120</div>
                      <input className={[styles.uWidth100, styles["uBackgroundsurface-card"], styles["uBorder1px-solid-border-subtle"], styles.uBorderRadius4px, styles["uPadding6px-10px"], styles.uFontSize13px, styles["uColortext-strong"], styles.uOutlinenone].join(' ')}
                        type="number" 
                        value={currentCobranzas.pctTr120 ?? ''} 
                        onChange={(e) => handleManualCobChange('pctTr120', e.target.value)}
                        placeholder="0%"
                      />
                    </div>
                    <div>
                      <div className={[styles.uFontSize10px, styles["uColortext-muted"], styles.uMarginBottom4px].join(' ')}>REFIN</div>
                      <input className={[styles.uWidth100, styles["uBackgroundsurface-card"], styles["uBorder1px-solid-border-subtle"], styles.uBorderRadius4px, styles["uPadding6px-10px"], styles.uFontSize13px, styles["uColortext-strong"], styles.uOutlinenone].join(' ')}
                        type="number" 
                        value={currentCobranzas.pctRefin ?? ''} 
                        onChange={(e) => handleManualCobChange('pctRefin', e.target.value)}
                        placeholder="0%"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de resultados por Analista */}
            <div className={[styles.uOverflowXauto, styles["uBackgroundsurface-sunken"], styles.uBorderRadius14px, styles["uBorder1px-solid-border-subtle"], styles.uPadding6px].join(' ')}>
              <table className={[styles.uWidth100, styles.uBorderCollapseseparate, styles.uBorderSpacing0].join(' ')}>
                <thead>
                  <tr>
                    <th className={[styles.uTextAlignleft, styles["uPadding14px-14px"], styles.uFontSize11px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>Analista</th>
                    <th className={[styles.uTextAlignright, styles["uPadding14px-14px"], styles.uFontSize11px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>Vendido (K)</th>
                    <th className={[styles.uTextAlignright, styles["uPadding14px-14px"], styles.uFontSize11px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>Cumpl. (K)</th>
                    <th className={[styles.uTextAlignright, styles["uPadding14px-14px"], styles.uFontSize11px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>Incent. (K)</th>
                    <th className={[styles.uTextAlignright, styles["uPadding14px-14px"], styles.uFontSize11px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>Cumpl. (Q)</th>
                    <th className={[styles.uTextAlignright, styles["uPadding14px-14px"], styles.uFontSize11px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>Incent. (Q)</th>
                    <th className={[styles.uTextAlignright, styles["uPadding14px-14px"], styles.uFontSize11px, styles.uFontWeight800, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>Incent. (Cob)</th>
                    <th className={[styles.uTextAlignright, styles["uPadding14px-14px"], styles.uFontSize11px, styles.uFontWeight900, styles["uColortext-muted"], styles.uTextTransformuppercase, styles.uLetterSpacing1px, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>Total Final</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiCards.filter(k => k.analista === 'PDV' || cobraIncentivo(k.analista)).map((k, idx) => (
                    <tr key={k.analista} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td className={[styles["uPadding16px-14px"], styles.uFontSize13px, styles.uFontWeight800, styles["uColortext-strong"], styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>
                        {k.analista === 'PDV' ? 'TOTAL GENERAL' : (analista === 'PDV' ? k.analista.toUpperCase() : 'INDIVIDUAL')}
                      </td>
                      <td className={[styles["uPadding16px-14px"], styles.uTextAlignright, styles.uFontSize13px, styles["uColortext-strong"], styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>{formatCurrency(k.capital)}</td>
                      <td className={[styles["uPadding16px-14px"], styles.uTextAlignright, styles.uFontSize13px, styles.uFontWeight800, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')} style={{ color: k.cumplCapital && k.cumplCapital >= 75 ? '#10b981' : '#f87171' }}>{k.cumplCapital?.toFixed(1)}%</td>
                      <td className={[styles["uPadding16px-14px"], styles.uTextAlignright, styles.uFontSize13px, styles["uColortext-strong"], styles.uFontWeight700, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>{formatCurrency(k.incentivoCap)}</td>
                      <td className={[styles["uPadding16px-14px"], styles.uTextAlignright, styles.uFontSize13px, styles.uFontWeight800, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')} style={{ color: k.cumplOps && k.cumplOps >= 80 ? '#10b981' : '#f87171' }}>{k.cumplOps?.toFixed(1)}%</td>
                      <td className={[styles["uPadding16px-14px"], styles.uTextAlignright, styles.uFontSize13px, styles["uColortext-strong"], styles.uFontWeight700, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>{formatCurrency(k.incentivoOps)}</td>
                      <td className={[styles["uPadding16px-14px"], styles.uTextAlignright, styles.uFontSize13px, styles["uColortext-strong"], styles.uFontWeight700, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>{formatCurrency((k.incentivoCobTr90 || 0) + (k.incentivoCobTr120 || 0) + (k.incentivoCobRefin || 0))}</td>
                      <td className={[styles["uPadding16px-14px"], styles.uTextAlignright, styles.uFontSize15px, styles.uColor10b981, styles.uFontWeight900, styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>
                        <div className={[styles.uDisplayflex, styles.uAlignItemscenter, styles["uJustifyContentflex-end"], styles.uGap8px].join(' ')}>
                          {k.topeKQAplicado && (
                            <span className={[styles["uDisplayinline-flex"], styles.uAlignItemscenter, styles.uGap4px, styles["uPadding3px-8px"], styles.uBorderRadius6px, styles.uFontSize10px, styles.uFontWeight800, styles["uBackgroundrgba-251-191-36-0-15"], styles.uColorfbbf24, styles["uBorder1px-solid-rgba-251-191-36-0-35"], styles.uTextTransformuppercase, styles["uLetterSpacing0-5px"]].join(' ')}
                              title={`Tope $250.000 aplicado. Excedente sin pagar: ${formatCurrency(k.topeKQExcedente || 0)}`}
                            >
                              TOPE
                            </span>
                          )}
                          {formatCurrency(k.incentivoTotal)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
              </>
            )}
    </div>
  );
}

type Bucket12 = { key: string; label: string; monto: number; ops: number; metaK: number; metaQ: number };

function Mini12Table({ label, total, buckets, accessor, metaAccessor, formatValue, hiddenCols = [] }: {
  label: string;
  total: string;
  buckets: Bucket12[];
  accessor: (b: Bucket12) => number;
  metaAccessor?: (b: Bucket12) => number;
  formatValue?: (v: number) => string;
  hiddenCols?: string[];
}) {
  const fmt = formatValue || ((v: number) => String(v));
  const dotColor = (pct: number | null) => {
    if (pct === null) return '#555';
    if (pct >= 100) return '#4ade80';
    if (pct >= 75)  return '#fbbf24';
    return '#f87171';
  };
  return (
    <div className={[styles["uBackgroundsurface-card"], styles["uBorder1px-solid-border-subtle"], styles.uBorderRadius14px, styles["uPadding20px-22px"], styles.uDisplayflex, styles.uFlexDirectioncolumn].join(' ')}>
      <div className={[styles.uFontSize11px, styles["uColortext-muted"], styles.uFontWeight800, styles.uTextTransformuppercase, styles["uLetterSpacing1-5px"], styles.uMarginBottom6px].join(' ')}>{label}</div>
      <div className={[styles.uFontSize20px, styles.uFontWeight900, styles["uColortext-strong"], styles["uLineHeight1-1"], styles.uMarginBottom16px].join(' ')}>{total}</div>

      <table className={[styles.uWidth100, styles.uBorderCollapsecollapse].join(' ')}>
        <thead>
          <tr>
            <th className={styles.miniTableHead}>MES</th>
            {!hiddenCols.includes('OBJETIVO') && <th className={`${styles.miniTableHead} ${styles.textCenter}`}>OBJETIVO</th>}
            {!hiddenCols.includes('ALCANCE') && <th className={`${styles.miniTableHead} ${styles.textCenter}`}>ALCANCE</th>}
            {!hiddenCols.includes('VAR.') && <th className={`${styles.miniTableHead} ${styles.textCenter}`}>VAR.</th>}
            {!hiddenCols.includes('CUMPL.') && <th className={`${styles.miniTableHead} ${styles.textRight}`}>CUMPL.</th>}
          </tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => {
            const v = accessor(b);
            const meta = metaAccessor ? metaAccessor(b) : 0;
            const pct = meta > 0 ? (v / meta) * 100 : null;
            const prev = i > 0 ? accessor(buckets[i - 1]) : null;
            const variacion = v > 0 && prev !== null && prev > 0 ? ((v - prev) / prev) * 100 : null;
            const varColor = variacion === null ? '#64748b' : Math.abs(variacion) < 0.5 ? '#8f929d' : variacion > 0 ? '#4ade80' : '#f87171';
            const varBg = variacion === null ? 'transparent' : Math.abs(variacion) < 0.5 ? 'rgba(255,255,255,0.04)' : variacion > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)';
            return (
              <tr key={b.key}>
                <td className={`${styles.miniTableCell} ${styles.miniTableMuted}`}>{b.label}</td>
                {!hiddenCols.includes('OBJETIVO') && <td className={`${styles.miniTableCell} ${styles.miniTableMuted} ${styles.textCenter}`}>{meta > 0 ? fmt(meta) : '—'}</td>}
                {!hiddenCols.includes('ALCANCE') && <td className={`${styles.miniTableCell} ${styles.miniTableValue} ${styles.textCenter}`}>{fmt(v)}</td>}
                {!hiddenCols.includes('VAR.') && <td className={`${styles.miniTableCell} ${styles.textCenter}`}>
                  {variacion !== null ? (
                    <span className={[styles["uDisplayinline-flex"], styles.uAlignItemscenter, styles.uGap4px, styles["uPadding3px-8px"], styles.uBorderRadius6px, styles.uFontSize11px, styles.uFontWeight700].join(' ')} style={{ color: varColor, background: varBg }}>
                      {Math.abs(variacion) < 0.5 ? '—' : variacion > 0 ? '▲' : '▼'} {variacion >= 0 ? '+' : ''}{variacion.toFixed(1)}%
                    </span>
                  ) : (
                    <span className={[styles["uColortext-muted"]].join(' ')}>—</span>
                  )}
                </td>}
                {!hiddenCols.includes('CUMPL.') && <td className={`${styles.miniTableCell} ${styles.textRight}`}>
                  {pct !== null ? (
                    <span className={[styles["uDisplayinline-flex"], styles.uAlignItemscenter, styles.uGap6px, styles["uPadding4px-10px"], styles.uBorderRadius8px, styles.uFontSize11px, styles.uFontWeight700, styles.uColore5e5e5, styles.uBackground141414, styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                      <span className={[styles.uWidth6px, styles.uHeight6px, styles.uBorderRadius50].join(' ')} style={{ background: dotColor(pct), boxShadow: `0 0 6px ${dotColor(pct)}` }} />
                      {pct.toFixed(2)}%
                    </span>
                  ) : (
                    <span className={[styles["uColortext-muted"]].join(' ')}>—</span>
                  )}
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
