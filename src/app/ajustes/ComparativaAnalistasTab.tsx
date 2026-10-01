'use client';

import React, { useState, useMemo } from 'react';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { useObjetivos } from '@/features/objetivos/ObjetivosProvider';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { formatCurrency } from '@/lib/utils';
import { filterByMonth, isVenta, emptyTiposAcuerdo, matchTipoAcuerdo, buildDistEmpleador, cumplColor } from '@/lib/registro-stats';
import { tasaCierrePct, conversionTotalPct } from '@/lib/kpi-cierre';
import { CONFIG } from '@/types';
import CustomSelect from '@/components/CustomSelect';
import DistBlock from '@/components/charts/DistBlock';
import ModernDoughnut from '@/components/charts/ModernDoughnut';
import {
  Users, BarChart3, PieChart, Shield, Tag
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, ArcElement
} from 'chart.js';
import styles from './ComparativaAnalistasTab.module.css';
import { UI_FONT_FAMILY } from '@/app/fonts';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, ArcElement);

// ── Plugin inline: data labels on bars (idéntico a analistas/page.tsx) ────
const labelsPlugin: any = {
  id: 'comparativaLabelsPlugin',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    const isHorizontal = chart.config.options.indexAxis === 'y';
    const isStacked = chart.config.options.scales?.x?.stacked || chart.config.options.scales?.y?.stacked;

    chart.data.datasets.forEach((ds: any, dsIdx: number) => {
      const meta = chart.getDatasetMeta(dsIdx);
      if (!meta || meta.hidden || meta.type !== 'bar') return;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 11px ${UI_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = isStacked ? 'middle' : 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;

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

// ── Helper: degradado para barras (idéntico a analistas/page.tsx) ─────────
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

const now = new Date();

export default function ComparativaAnalistasTab() {
  const { registros, loading: loadingRegs } = useRegistros();
  const { objetivos } = useObjetivos();
  const { nombres, analistasAll } = useAnalistas();

  const [selectedAnio, setSelectedAnio] = useState<number | 'TODOS'>(now.getFullYear());
  const [selectedMes, setSelectedMes] = useState<number | 'TODOS'>(now.getMonth() + 1);
  const [modoOp, setModoOp] = useState<'ventas' | 'todos'>('ventas');
  const [selectedAnalista, setSelectedAnalista] = useState<string | null>(null);

  // Años disponibles
  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const r of registros) {
      const y = r.fecha?.slice(0, 4);
      if (y && !isNaN(Number(y))) set.add(Number(y));
    }
    for (const o of objetivos) set.add(o.anio);
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [registros, objetivos]);

  // Filtrado temporal
  const regsPeriodo = useMemo(() => {
    if (selectedAnio === 'TODOS') return registros;
    if (selectedMes === 'TODOS') {
      const prefix = `${selectedAnio}-`;
      return registros.filter(r => r.fecha?.startsWith(prefix));
    }
    return filterByMonth(registros, selectedMes, selectedAnio);
  }, [registros, selectedAnio, selectedMes]);

  const analistasActivos = useMemo(() => {
    return nombres.length > 0 ? nombres : ['Luciana', 'Victoria'];
  }, [nombres]);

  // Color map
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    analistasAll.forEach(a => map.set(a.nombre, a.color || '#3b82f6'));
    return map;
  }, [analistasAll]);

  // Paleta estética de gráficos coherente con analistas/page.tsx
  const palette = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#38bdf8', '#fb923c'];

  // Métricas por analista y Total PDV
  const filas = useMemo(() => {
    const porAnalista = analistasActivos.map((analista, idx) => {
      const regsA = regsPeriodo.filter(r => r.analista === analista);
      const ventas = regsA.filter(isVenta);
      const ventasQ = ventas.length;
      const capitalK = ventas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const ticket = ventasQ > 0 ? capitalK / ventasQ : 0;
      const tasaCierre = tasaCierrePct(regsA);
      const conversionTotal = conversionTotalPct(regsA);
      const renovQ = ventas.filter(r => r.es_re).length;
      const pctRenov = ventasQ > 0 ? (renovQ / ventasQ) * 100 : 0;

      // Metas según período seleccionado
      let metaCapital = 0;
      let metaOps = 0;
      if (selectedAnio !== 'TODOS' && selectedMes !== 'TODOS') {
        const obj = objetivos.find(o => o.analista === analista && o.mes === (selectedMes as number) - 1 && o.anio === selectedAnio);
        metaCapital = obj?.meta_ventas ?? 0;
        metaOps = obj?.meta_operaciones ?? 0;
      } else if (selectedAnio !== 'TODOS' && selectedMes === 'TODOS') {
        const objs = objetivos.filter(o => o.analista === analista && o.anio === selectedAnio);
        metaCapital = objs.reduce((s, o) => s + (o.meta_ventas || 0), 0);
        metaOps = objs.reduce((s, o) => s + (o.meta_operaciones || 0), 0);
      } else {
        const objs = objetivos.filter(o => o.analista === analista);
        metaCapital = objs.reduce((s, o) => s + (o.meta_ventas || 0), 0);
        metaOps = objs.reduce((s, o) => s + (o.meta_operaciones || 0), 0);
      }

      const cumplCapital = metaCapital > 0 ? (capitalK / metaCapital) * 100 : null;
      const cumplOps = metaOps > 0 ? (ventasQ / metaOps) * 100 : null;

      return {
        analista,
        color: colorMap.get(analista) || palette[idx % palette.length],
        ingresados: regsA.length,
        ventasQ,
        capitalK,
        ticket,
        tasaCierre,
        conversionTotal,
        pctRenov,
        metaCapital,
        metaOps,
        cumplCapital,
        cumplOps,
      };
    });

    // Fila Total PDV
    const ventasPDV = regsPeriodo.filter(isVenta);
    const totalVentasQ = ventasPDV.length;
    const totalCapitalK = ventasPDV.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const totalTicket = totalVentasQ > 0 ? totalCapitalK / totalVentasQ : 0;
    const totalTasaCierre = tasaCierrePct(regsPeriodo);
    const totalConversionTotal = conversionTotalPct(regsPeriodo);
    const totalRenovQ = ventasPDV.filter(r => r.es_re).length;
    const totalPctRenov = totalVentasQ > 0 ? (totalRenovQ / totalVentasQ) * 100 : 0;

    const totalMetaCapital = porAnalista.reduce((s, a) => s + a.metaCapital, 0);
    const totalMetaOps = porAnalista.reduce((s, a) => s + a.metaOps, 0);
    const totalCumplCapital = totalMetaCapital > 0 ? (totalCapitalK / totalMetaCapital) * 100 : null;
    const totalCumplOps = totalMetaOps > 0 ? (totalVentasQ / totalMetaOps) * 100 : null;

    const total = {
      analista: 'PDV',
      color: '#10b981',
      ingresados: regsPeriodo.length,
      ventasQ: totalVentasQ,
      capitalK: totalCapitalK,
      ticket: totalTicket,
      tasaCierre: totalTasaCierre,
      conversionTotal: totalConversionTotal,
      pctRenov: totalPctRenov,
      metaCapital: totalMetaCapital,
      metaOps: totalMetaOps,
      cumplCapital: totalCumplCapital,
      cumplOps: totalCumplOps,
    };

    return { porAnalista, total };
  }, [analistasActivos, regsPeriodo, objetivos, selectedAnio, selectedMes, colorMap]);

  // Ranking y líderes
  const liderCapital = useMemo(() => {
    if (filas.porAnalista.length === 0) return null;
    return [...filas.porAnalista].sort((a, b) => b.capitalK - a.capitalK)[0];
  }, [filas.porAnalista]);

  const liderEfectividad = useMemo(() => {
    if (filas.porAnalista.length === 0) return null;
    return [...filas.porAnalista].sort((a, b) => (b.tasaCierre ?? 0) - (a.tasaCierre ?? 0))[0];
  }, [filas.porAnalista]);

  // Opciones de gráfico base
  const chartOpts = (yLabel = '$') => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 30, bottom: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#ffffff',
        titleFont: { size: 13, weight: 700, family: UI_FONT_FAMILY },
        titleAlign: 'center' as const,
        bodyColor: '#f1f5f9',
        bodyFont: { size: 12, weight: 600, family: UI_FONT_FAMILY },
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw;
            if (yLabel === '$') return ` ${ctx.dataset.label}: ${formatCurrency(val)}`;
            return ` ${ctx.dataset.label}: ${val} ops`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#8f929d', font: { size: 11, weight: 700, family: UI_FONT_FAMILY } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#555', font: { size: 10, family: UI_FONT_FAMILY },
          callback: (v: any) => {
            if (yLabel === '$') {
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
              if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
              return `$${v}`;
            }
            return v;
          },
        },
      },
    },
  });

  // Gráfico 1: Capital Vendido vs Meta
  const chartCapitalData = useMemo(() => {
    const labels = filas.porAnalista.map(a => a.analista);
    const capitales = filas.porAnalista.map(a => a.capitalK);
    const metas = filas.porAnalista.map(a => a.metaCapital);

    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Capital Vendido',
          data: capitales,
          backgroundColor: (context: any) => getGradient(context, 'rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.85)'),
          borderColor: '#10b981',
          borderWidth: 0,
          borderRadius: 4,
          order: 2,
          maxBarThickness: 60,
        },
        {
          type: 'line' as const,
          label: 'Meta Capital',
          data: metas,
          borderColor: '#f87171',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 4,
          pointBackgroundColor: '#f87171',
          fill: false,
          order: 1,
        },
      ],
    };
  }, [filas.porAnalista]);

  // Gráfico 2: Operaciones vs Meta
  const chartOpsData = useMemo(() => {
    const labels = filas.porAnalista.map(a => a.analista);
    const ops = filas.porAnalista.map(a => a.ventasQ);
    const metas = filas.porAnalista.map(a => a.metaOps);

    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Operaciones Cerradas',
          data: ops,
          backgroundColor: (context: any) => getGradient(context, 'rgba(96, 165, 250, 0.05)', 'rgba(96, 165, 250, 0.85)'),
          borderColor: '#60a5fa',
          borderWidth: 0,
          borderRadius: 4,
          order: 2,
          maxBarThickness: 60,
        },
        {
          type: 'line' as const,
          label: 'Meta Operaciones',
          data: metas,
          borderColor: '#fb923c',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 4,
          pointBackgroundColor: '#fb923c',
          fill: false,
          order: 1,
        },
      ],
    };
  }, [filas.porAnalista]);

  // Gráfico 3: ModernDoughnut Share
  const doughnutShareData = useMemo(() => {
    const labels = filas.porAnalista.map(a => a.analista);
    const data = filas.porAnalista.map(a => a.capitalK);
    const bgColors = filas.porAnalista.map(a => a.color);

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 10,
        borderRadius: 4,
        spacing: 4,
      }],
    };
  }, [filas.porAnalista]);

  // Desglose de categoría del analista seleccionado o PDV
  const targetAnalista = selectedAnalista || 'PDV';
  const fuenteRegistros = useMemo(() => {
    const base = targetAnalista === 'PDV' ? regsPeriodo : regsPeriodo.filter(r => r.analista === targetAnalista);
    return modoOp === 'ventas' ? base.filter(isVenta) : base;
  }, [regsPeriodo, targetAnalista, modoOp]);

  const totalBase = useMemo(() => {
    return fuenteRegistros.reduce((s, r) => s + (Number(r.monto) || 0), 0);
  }, [fuenteRegistros]);

  const distAcuerdo = useMemo(() => {
    const acc = emptyTiposAcuerdo();
    const isV = modoOp === 'ventas';
    for (const r of fuenteRegistros) {
      const match = matchTipoAcuerdo(r.acuerdo_precios || '', r.estado || '', isV);
      if (match && acc[match]) {
        acc[match].monto += Number(r.monto) || 0;
        acc[match].cantidad += 1;
      }
    }
    return Object.entries(acc).map(([label, d]) => ({ label, ...d }));
  }, [fuenteRegistros, modoOp]);

  const distCuotas = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of fuenteRegistros) {
      const c = r.cuotas ? `${r.cuotas} cuotas` : 'No especificado';
      const prev = map.get(c) || { monto: 0, cantidad: 0 };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      map.set(c, prev);
    }
    return Array.from(map.entries()).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.cantidad - a.cantidad);
  }, [fuenteRegistros]);

  const distRango = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of fuenteRegistros) {
      const re = r.rango_etario || 'No especificado';
      const prev = map.get(re) || { monto: 0, cantidad: 0 };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      map.set(re, prev);
    }
    return Array.from(map.entries()).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.cantidad - a.cantidad);
  }, [fuenteRegistros]);

  const distSexo = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of fuenteRegistros) {
      const s = r.sexo ? (r.sexo.toUpperCase() === 'M' ? 'Masculino' : r.sexo.toUpperCase() === 'F' ? 'Femenino' : r.sexo) : 'No especificado';
      const prev = map.get(s) || { monto: 0, cantidad: 0 };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      map.set(s, prev);
    }
    return Array.from(map.entries()).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.cantidad - a.cantidad);
  }, [fuenteRegistros]);

  const distEmpleador = useMemo(() => buildDistEmpleador(fuenteRegistros), [fuenteRegistros]);

  const sectionHeader = (title: string, icon: React.ReactNode) => (
    <div className={styles.sectionHeader}>
      <div className={styles.sectionTitle}>{icon}<span>{title}</span></div>
    </div>
  );

  if (loadingRegs) {
    return (
      <div className={`loading-container ${styles.loading}`}>
        <div className="spinner" />
        <span className={styles.loadingText}>Cargando métricas de analistas...</span>
      </div>
    );
  }

  const headers = ['Analista', 'Ingresados', 'Vendido ($)', 'Meta ($)', 'Cumpl. ($)', 'Ventas (Q)', 'Meta (Q)', 'Cumpl. (Q)', 'Ticket Prom.', 'Tasa Cierre', 'Conv. Total', '% Renov.'];

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarContent}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon}><BarChart3 size={24} /></div>
            <div>
              <h3 className={styles.pageTitle}>Comparativa de Analistas</h3>
              <p className={styles.pageSubtitle}>Rendimiento y Cartera Cruzada</p>
            </div>
          </div>
          <div className={styles.filters}>
            <CustomSelect value={selectedMes} onChange={val => setSelectedMes(val === 'TODOS' ? 'TODOS' : Number(val))} options={[{ label: 'Todo el año', value: 'TODOS' }, ...CONFIG.MESES_NOMBRES.map((m, i) => ({ label: m, value: i + 1 }))]} width="150px" />
            <CustomSelect value={selectedAnio} onChange={val => setSelectedAnio(val === 'TODOS' ? 'TODOS' : Number(val))} options={[{ label: 'Histórico', value: 'TODOS' }, ...aniosDisponibles.map(a => ({ label: String(a), value: a }))]} width="110px" />
          </div>
        </div>
      </div>

      <section className={`data-card ${styles.reportCard}`}>
        {sectionHeader('1. Tablero de Rendimiento', <BarChart3 size={15} color="#60a5fa" />)}
        <div className={styles.metricsGrid}>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Capital Vendido (PDV)</span>
            <strong className={styles.metricValue}>{formatCurrency(filas.total.capitalK)}</strong>
            <span className={styles.metricMeta}>Meta: {filas.total.metaCapital > 0 ? formatCurrency(filas.total.metaCapital) : '—'}</span>
            {filas.total.cumplCapital !== null && <span className={styles.metricResult}><i style={{ '--metric-color': cumplColor(filas.total.cumplCapital) } as React.CSSProperties}>●</i>{filas.total.cumplCapital.toFixed(1)}% Cumplimiento</span>}
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Operaciones Cerradas</span>
            <strong className={styles.metricValue}>{filas.total.ventasQ} ops</strong>
            <span className={styles.metricMeta}>Meta: {filas.total.metaOps > 0 ? `${filas.total.metaOps} ops` : '—'}</span>
            {filas.total.cumplOps !== null && <span className={styles.metricResult}><i style={{ '--metric-color': cumplColor(filas.total.cumplOps) } as React.CSSProperties}>●</i>{filas.total.cumplOps.toFixed(1)}% Cumplimiento</span>}
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Líder en Ventas</span>
            <strong className={`${styles.metricValue} ${styles.warningValue}`}>{liderCapital?.analista ?? '—'}</strong>
            <span className={styles.metricMeta}>{liderCapital ? formatCurrency(liderCapital.capitalK) : '$0'}</span>
            {liderCapital?.cumplCapital != null && <span className={styles.metricResult}><i style={{ '--metric-color': cumplColor(liderCapital.cumplCapital) } as React.CSSProperties}>●</i>{liderCapital.cumplCapital.toFixed(1)}% de su meta</span>}
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Mayor Efectividad de Cierre</span>
            <strong className={`${styles.metricValue} ${styles.successValue}`}>{liderEfectividad?.tasaCierre ? `${liderEfectividad.tasaCierre.toFixed(1)}%` : '—'}</strong>
            <span className={styles.metricMeta}>Analista: <b>{liderEfectividad?.analista ?? '—'}</b></span>
            <span className={styles.metricMeta}>Conversión embudo: {liderEfectividad?.conversionTotal ? `${liderEfectividad.conversionTotal.toFixed(1)}%` : '—'}</span>
          </article>
        </div>
      </section>

      <section className={`data-card ${styles.reportCard}`}>
        {sectionHeader('2. Gráficos Comparativos', <BarChart3 size={15} color="#a78bfa" />)}
        <div className={styles.chartsGrid}>
          <article className={styles.chartCard}>
            <div className={styles.chartHeader}><span>Capital Vendido vs Meta ($)</span><div className={styles.chartLegend}><span><i className={styles.soldDot} />Vendido</span><span><i className={styles.targetLine} />Meta</span></div></div>
            <div className={styles.chart}><Bar data={chartCapitalData as any} options={chartOpts('$') as any} plugins={[labelsPlugin]} /></div>
          </article>
          <article className={styles.chartCard}>
            <div className={styles.chartHeader}><span>Operaciones Cerradas vs Meta</span><div className={styles.chartLegend}><span><i className={styles.opsDot} />Ops</span><span><i className={styles.opsTargetLine} />Meta</span></div></div>
            <div className={styles.chart}><Bar data={chartOpsData as any} options={chartOpts('ops') as any} plugins={[labelsPlugin]} /></div>
          </article>
          <article className={styles.chartCard}>
            <div className={styles.chartHeader}><span>Distribución de Ventas (% Capital)</span></div>
            <div className={`${styles.chart} ${styles.doughnutChart}`}>
              <ModernDoughnut data={doughnutShareData} label="Total PDV" value={formatCurrency(filas.total.capitalK)} padding={36} height="220px" width="220px" labelSize={8} valueSize={15} />
              <div className={styles.analystLegend}>
                {filas.porAnalista.map(a => {
                  const pct = filas.total.capitalK > 0 ? ((a.capitalK / filas.total.capitalK) * 100).toFixed(1) : '0';
                  return <span key={a.analista}><i style={{ '--metric-color': a.color } as React.CSSProperties} />{a.analista} ({pct}%)</span>;
                })}
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className={`data-card ${styles.reportCard}`}>
        <div className={styles.tableSectionHeader}>
          <div className={styles.sectionTitle}><Users size={15} color="#38bdf8" /><span>3. Rendimiento por Analista</span></div>
          {selectedAnalista && <button onClick={() => setSelectedAnalista(null)} className={styles.resetButton}>Restablecer a PDV</button>}
        </div>
        <div className={styles.tableViewport}>
          <table className={styles.performanceTable}>
            <thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {filas.porAnalista.map(k => {
                const isSelected = selectedAnalista === k.analista;
                return (
                  <tr key={k.analista} onClick={() => setSelectedAnalista(k.analista)} className={`${styles.analystRow} ${isSelected ? styles.isSelected : ''}`} style={{ '--analyst-color': k.color } as React.CSSProperties}>
                    <td className={styles.analystCell}><i />{k.analista.toUpperCase()}</td>
                    <td>{k.ingresados}</td>
                    <td className={styles.strongCell}>{formatCurrency(k.capitalK)}</td>
                    <td className={styles.mutedCell}>{k.metaCapital > 0 ? formatCurrency(k.metaCapital) : '—'}</td>
                    <td className={styles.metricCell} style={{ '--metric-color': cumplColor(k.cumplCapital) } as React.CSSProperties}>{k.cumplCapital !== null ? `${k.cumplCapital.toFixed(1)}%` : '—'}</td>
                    <td className={styles.opsCell}>{k.ventasQ}</td>
                    <td className={styles.mutedCell}>{k.metaOps > 0 ? k.metaOps : '—'}</td>
                    <td className={styles.metricCell} style={{ '--metric-color': cumplColor(k.cumplOps) } as React.CSSProperties}>{k.cumplOps !== null ? `${k.cumplOps.toFixed(1)}%` : '—'}</td>
                    <td className={styles.strongCell}>{formatCurrency(k.ticket)}</td>
                    <td className={styles.metricCell} style={{ '--metric-color': cumplColor(k.tasaCierre) } as React.CSSProperties}>{k.tasaCierre !== null ? `${k.tasaCierre.toFixed(1)}%` : '—'}</td>
                    <td className={styles.metricCell} style={{ '--metric-color': cumplColor(k.conversionTotal) } as React.CSSProperties}>{k.conversionTotal !== null ? `${k.conversionTotal.toFixed(1)}%` : '—'}</td>
                    <td className={styles.mutedCell}>{k.pctRenov.toFixed(0)}%</td>
                  </tr>
                );
              })}
              <tr onClick={() => setSelectedAnalista('PDV')} className={styles.totalRow}>
                <td className={styles.analystCell}><i />TOTAL GENERAL</td>
                <td>{filas.total.ingresados}</td>
                <td className={styles.totalValue}>{formatCurrency(filas.total.capitalK)}</td>
                <td className={styles.mutedCell}>{filas.total.metaCapital > 0 ? formatCurrency(filas.total.metaCapital) : '—'}</td>
                <td className={styles.metricCell} style={{ '--metric-color': cumplColor(filas.total.cumplCapital) } as React.CSSProperties}>{filas.total.cumplCapital !== null ? `${filas.total.cumplCapital.toFixed(1)}%` : '—'}</td>
                <td className={styles.totalOps}>{filas.total.ventasQ}</td>
                <td className={styles.mutedCell}>{filas.total.metaOps > 0 ? filas.total.metaOps : '—'}</td>
                <td className={styles.metricCell} style={{ '--metric-color': cumplColor(filas.total.cumplOps) } as React.CSSProperties}>{filas.total.cumplOps !== null ? `${filas.total.cumplOps.toFixed(1)}%` : '—'}</td>
                <td>{formatCurrency(filas.total.ticket)}</td>
                <td className={styles.metricCell} style={{ '--metric-color': cumplColor(filas.total.tasaCierre) } as React.CSSProperties}>{filas.total.tasaCierre !== null ? `${filas.total.tasaCierre.toFixed(1)}%` : '—'}</td>
                <td className={styles.metricCell} style={{ '--metric-color': cumplColor(filas.total.conversionTotal) } as React.CSSProperties}>{filas.total.conversionTotal !== null ? `${filas.total.conversionTotal.toFixed(1)}%` : '—'}</td>
                <td>{filas.total.pctRenov.toFixed(0)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={`data-card ${styles.reportCard}`}>
        <div className={`${styles.sectionHeader} ${styles.compositionHeader}`}>
          <div className={styles.sectionTitle}><Tag size={15} color="#fb923c" /><span>4. Composición de Cartera — <strong>{targetAnalista === 'PDV' ? 'PDV (General)' : targetAnalista}</strong></span></div>
          <div className={styles.compositionActions}>
            <span className={styles.operationCount}>{fuenteRegistros.length} ops · {formatCurrency(totalBase)}</span>
            <div className={styles.modeToggle}>
              <button onClick={() => setModoOp('ventas')} className={modoOp === 'ventas' ? styles.isActive : ''}>Ventas</button>
              <button onClick={() => setModoOp('todos')} className={modoOp === 'todos' ? styles.isActive : ''}>Todos</button>
            </div>
          </div>
        </div>
        <div className={styles.distributionGrid}>
          <DistBlock titulo="Acuerdo de Precios" icon={<PieChart size={12} color="#f97316" />} datos={distAcuerdo} color="#f97316" totalMes={totalBase} theme="elevated" />
          <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} datos={distCuotas} color="#60a5fa" totalMes={totalBase} theme="elevated" />
          <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={distRango} color="#34d399" totalMes={totalBase} theme="elevated" />
          <DistBlock titulo="Sexo" icon={<Users size={12} color="#f472b6" />} datos={distSexo} color="#f472b6" totalMes={totalBase} theme="elevated" />
          <DistBlock titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={distEmpleador} color="#fbbf24" totalMes={totalBase} theme="elevated" />
        </div>
      </section>
    </div>
  );
}
