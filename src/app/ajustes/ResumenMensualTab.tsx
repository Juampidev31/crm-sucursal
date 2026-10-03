'use client';

import styles from './ResumenMensualTab.module.css';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Registro, Objetivo, CONFIG } from '@/types';
import { formatCurrency, hexToRgba } from '@/lib/utils';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { tasaCierrePct, conversionTotalPct } from '@/lib/kpi-cierre';
import { Save, Plus, Trash2, BarChart3, Users, TrendingUp, Activity, Shield, Target, FileText, Briefcase, PieChart, Tag, ChevronDown, Clock } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement
} from 'chart.js';
import MetricasTab from './MetricasTab';
import NuevaSeccionSheets from '@/app/analistas/NuevaSeccionSheets';
import SeccionGraficosResumen from './SeccionGraficosResumen';
import { filterByMonth, isVenta, TIPOS_ACUERDO, emptyTiposAcuerdo, matchTipoAcuerdo, buildDistEmpleador, cumplColor, distPor } from '@/lib/registro-stats';
import DistBlock from '@/components/charts/DistBlock';
import { detectResumenSnapshotVersion, RESUMEN_SNAPSHOT_VERSION, wrapResumenSnapshot } from '@/lib/resumenSnapshot';
import { fetchAllRows } from '@/lib/supabase-paginate';
import { UI_FONT_FAMILY } from '@/app/fonts';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController, ArcElement);

const REPORT_ANALYST_PALETTE = ['#315b7d', '#4f8275', '#6d6f91', '#8a704b'];

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
      ctx.fillStyle = '#314158';
      ctx.font = `700 11px ${UI_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = isStacked ? 'middle' : 'bottom';

      // Shadow for readability
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 2;

      // Detección de porcentaje: solo mediante flag explícito
      const isPct = chart.config.options?._isPct === true;

      meta.data.forEach((bar: any, idx: number) => {
        const val = ds.data[idx];
        if (val === null || val === undefined || (val === 0 && !isPct)) return;

        let label = '';
        const v = Math.abs(val);

        if (isPct) {
          label = Math.round(val) + '%';
        } else if (v >= 1000) {
          label = val.toLocaleString('es-AR');
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

// Dibuja líneas horizontales de referencia (objetivo) de extremo a extremo.
// Necesario porque con una sola categoría una línea de datos quedaría como un punto.
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

// Línea de referencia 100% para gráficos de cumplimiento
const refLine100 = (n: number) => ({
  type: 'line' as const,
  label: 'Meta 100%',
  data: Array(n).fill(100),
  borderColor: '#ff3366',
  borderWidth: 0,
  borderDash: [5, 4],
  pointRadius: 0,
  fill: false,
  order: 0,
});

interface PlanAccion {
  problema: string;
  accion: string;
  responsable: string;
  fecha: string;
}

interface ResumenMensual {
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
  gestiones_por_analista: Record<string, number>;
  presupuestos_por_analista: Record<string, number>;
}

const EMPTY_RESUMEN = (): ResumenMensual => ({
  logros: '', desvios: '', acciones_clave: '',
  gestiones_realizadas: '', coordinacion_salidas: '', empresas_estrategicas: '',
  analisis_comercial: '',
  dotacion: '', ausentismo: '', capacitacion: '', evaluacion_desempeno: '',
  operacion_procesos: '',
  experiencia_cliente: '',
  plan_acciones: [],
  gestiones_por_analista: {},
  presupuestos_por_analista: {},
});

interface Props {
  registros: Registro[];
  objetivos: Objetivo[];
  diasConfig: { analista: string; dias_habiles: number; dias_transcurridos: number }[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  /** Vista actualmente visible. Default true para no alterar consumidores existentes. */
  active?: boolean;
}

const now = new Date();

const ManualTextarea = ({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) => (
  <div data-snapshot-fragment className="monthly-note-field">
    <label>{label}</label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? `${label}...`}
      rows={4}
      className="monthly-note-field__input"
    />
  </div>
);

export default function ResumenMensualTab({ registros, objetivos, diasConfig, onSuccess, onError, active = true }: Props) {
  const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(now.getFullYear());
  const [resumen, setResumen] = useState<ResumenMensual>(EMPTY_RESUMEN());
  const [auditoriaData, setAuditoriaData] = useState<{ analista: string; accion: string; fecha_hora: string }[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState(''); // Estado para el HTML
  const [saving, setSaving] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [periodoSec3, setPeriodoSec3] = useState<'mensual' | 'total'>('mensual');
  const [filtroActividad, setFiltroActividad] = useState<string>('PDV');
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
    8: true,
    9: true,
    10: true,
  });

  const toggleSection = (id: number) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Analistas dinámicos ───────────────────────────────────────────────────
  const { analistas, nombres } = useAnalistas();
  const ANALISTA_COLORES = useMemo(
    () => analistas.map((a, index) => {
      const color = REPORT_ANALYST_PALETTE[index % REPORT_ANALYST_PALETTE.length];
      return { nombre: a.nombre, color, bg: hexToRgba(color, 0.1) };
    }),
    [analistas],
  );
  const FILTROS_ACTIVIDAD = useMemo(
    () => ['PDV', ...analistas.map(a => a.nombre), 'Comparativa'],
    [analistas],
  );

  // ── Fetch al cambiar mes/año ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);

    const pad = (n: number) => String(n).padStart(2, '0');
    const mesStr = pad(selectedMes);
    const lastDay = new Date(selectedAnio, selectedMes, 0).getDate();
    
    // Fetch desde el inicio del mes anterior para permitir comparaciones en el análisis temporal
    const prevDate = new Date(selectedAnio, selectedMes - 2, 1);
    const startTs = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-01T00:00:00`;
    const endTs = `${selectedAnio}-${mesStr}-${pad(lastDay)}T23:59:59`;

    Promise.all([
      supabase
        .from('resumen_mensual')
        .select('*')
        .eq('anio', selectedAnio)
        .eq('mes', selectedMes)
        .maybeSingle(),
      // Debe paginar: un mes puede superar las 1000 filas de auditoría y
      // Supabase truncaba en silencio (medido: 1675 filas reales → 1000
      // recibidas en 2026-08), con lo que `auditCounts` — las gestiones por
      // analista del resumen mensual y del link público — quedaba corto.
      fetchAllRows<{ analista: string; accion: string; fecha_hora: string }>(
        (from, to) =>
          supabase
            .from('auditoria')
            .select('analista, accion, fecha_hora')
            .gte('fecha_hora', startTs)
            .lte('fecha_hora', endTs)
            .order('fecha_hora', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        { isCancelled: () => cancelled },
      ).then(({ rows }) => ({ data: rows })),
    ]).then(([{ data: existing }, { data: audit }]) => {
      if (cancelled) return;
      if (existing) {
        // Intentar parsear el JSON de experiencia_cliente
        let textPart = existing.experiencia_cliente || '';
        let htmlPart = '';

        if (textPart.startsWith('{')) {
          try {
            const parsed = JSON.parse(textPart);
            textPart = parsed.text || '';
            htmlPart = parsed.html || '';
          } catch { }
        } else if (textPart.trim().startsWith('<div')) {
          htmlPart = textPart;
          textPart = '';
        }

        setResumen({
          logros: existing.logros ?? '',
          desvios: existing.desvios ?? '',
          acciones_clave: existing.acciones_clave ?? '',
          gestiones_realizadas: existing.gestiones_realizadas ?? '',
          coordinacion_salidas: existing.coordinacion_salidas ?? '',
          empresas_estrategicas: existing.empresas_estrategicas ?? '',
          analisis_comercial: existing.analisis_comercial ?? '',
          dotacion: existing.dotacion ?? '',
          ausentismo: existing.ausentismo ?? '',
          capacitacion: existing.capacitacion ?? '',
          evaluacion_desempeno: existing.evaluacion_desempeno ?? '',
          operacion_procesos: existing.operacion_procesos ?? '',
          experiencia_cliente: textPart, // Cargamos solo el texto
          plan_acciones: existing.plan_acciones ?? [],
          gestiones_por_analista: existing.gestiones_por_analista ?? {},
          presupuestos_por_analista: existing.presupuestos_por_analista ?? {},
        });
        setLastSnapshot(htmlPart); // Guardamos el HTML en el estado oculto
      } else {
        setResumen(EMPTY_RESUMEN());
      }
      setAuditoriaData(audit ?? []);
      setLoadingData(false);
    });

    return () => { cancelled = true; };
  }, [selectedMes, selectedAnio]);

  // ── Datos compartidos para el reporte público (link y guardado) ─────────
  const buildDatosParaCompartir = (auditSoloMesActual: boolean) => {
    const auditCounts: Record<string, number> = {};
    const currentMonthPrefix = `${selectedAnio}-${String(selectedMes).padStart(2, '0')}`;
    nombres.forEach(a => {
      auditCounts[a] = auditoriaData.filter(ad =>
        ad.analista === a && (!auditSoloMesActual || ad.fecha_hora.startsWith(currentMonthPrefix))
      ).length;
    });

    // Registros "seguros" para el análisis temporal público (sin datos sensibles)
    const safeRecords = registros.map(r => ({
      fecha: r.fecha,
      monto: r.monto,
      analista: r.analista,
      estado: r.estado,
      acuerdo_precios: r.acuerdo_precios,
      empleador: r.empleador,
      dependencia: r.dependencia
    }));

    return {
      kpiTotal,
      kpiPorAnalista,
      registros: safeRecords,
      mesActual: CONFIG.MESES_NOMBRES[selectedMes - 1],
      mesAnterior: CONFIG.MESES_NOMBRES[mesPrev - 1],
      year: selectedAnio,
      month: selectedMes,
      experienciaCliente: resumen.experiencia_cliente,
      analisisComercial: resumen.analisis_comercial,
      operacionProcesos: resumen.operacion_procesos,
      gestionesRealizadas: resumen.gestiones_realizadas,
      coordinacionSalidas: resumen.coordinacion_salidas,
      empresasEstrategicas: resumen.empresas_estrategicas,
      logros: resumen.logros,
      desvios: resumen.desvios,
      accionesClave: resumen.acciones_clave,
      dotacion: resumen.dotacion,
      ausentismo: resumen.ausentismo,
      capacitacion: resumen.capacitacion,
      evaluacionDesempeno: resumen.evaluacion_desempeno,
      planAcciones: resumen.plan_acciones,
      auditCounts,
      collapsedSections,
      chartCapitalVsObjetivo,
      chartTicketPromedio,
      chartVariacion,
      chartEmbudo,
      chartAperturas,
      chartRenovaciones,
      chartEmpleoPublPriv,
      chartConversionTotal,
      chartConversionPresupuesto,
      chartCumplimiento,
      chartAcuerdos,
      distSexo,
      distCuotas,
      distRangoEtario,
      distLocalidad,
      distEmpleador,
      distAcuerdos,
      distEstados,
      distSexoTotal,
      distCuotasTotal,
      distRangoEtarioTotal,
      distLocalidadTotal,
      distEmpleadorTotal,
      distAcuerdosTotal,
    };
  };

  // ── Generar Link público para compartir el reporte ──────────────────────
  const handleGenerarLink = async () => {
    try {
      const root = document.getElementById('resumen-reporte-body');
      if (!root) { alert('ERROR: No se encontró el contenido del reporte.'); return; }

      // 1. Esperar render de gráficos
      await new Promise(r => setTimeout(r, 300));

      // 2. Capturar canvas como imágenes (para fallback HTML)
      const canvasImages = new Map<HTMLCanvasElement, string>();
      root.querySelectorAll('canvas').forEach(canvas => {
        try { canvasImages.set(canvas as HTMLCanvasElement, (canvas as HTMLCanvasElement).toDataURL('image/png')); } catch { /* ignorar */ }
      });

      // 3. Clonar
      // cloneNode conserva markup, class y `style=`, pero NO las hojas de estilo: el HTML
      // persistido solo es fiel si el subárbol lleva sus estilos inline. Ver SNAPSHOT STYLE
      // BOUNDARY en #resumen-reporte-body.
      const clone = root.cloneNode(true) as HTMLElement;

      // 4. Canvas → img
      const origCanvases = Array.from(root.querySelectorAll('canvas')) as HTMLCanvasElement[];
      const cloneCanvases = Array.from(clone.querySelectorAll('canvas')) as HTMLCanvasElement[];
      origCanvases.forEach((orig, i) => {
        const src = canvasImages.get(orig);
        const clonedCanvas = cloneCanvases[i];
        if (src && clonedCanvas) {
          const img = document.createElement('img');
          img.src = src;
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
          clonedCanvas.parentNode?.replaceChild(img, clonedCanvas);
        }
      });

      // 5. Textareas → divs
      const origTextareas = Array.from(root.querySelectorAll('textarea')) as HTMLTextAreaElement[];
      const cloneTextareas = Array.from(clone.querySelectorAll('textarea')) as HTMLTextAreaElement[];
      origTextareas.forEach((orig, i) => {
        const cloned = cloneTextareas[i];
        if (!cloned) return;
        const computed = window.getComputedStyle(orig);
        const div = document.createElement('div');
        div.style.cssText = cloned.style.cssText;
        div.style.whiteSpace = 'pre-wrap';
        div.style.overflow = 'visible';
        div.style.resize = 'none';
        div.style.minHeight = computed.height !== 'auto' ? computed.height : '72px';
        div.style.display = 'block';
        div.textContent = orig.value;
        cloned.parentNode?.replaceChild(div, cloned);
      });

      // 6. Inputs → texto; ocultar botones
      clone.querySelectorAll('button').forEach(el => (el as HTMLElement).style.display = 'none');
      const origInputs = Array.from(root.querySelectorAll('input')) as HTMLInputElement[];
      const cloneInputs = Array.from(clone.querySelectorAll('input')) as HTMLInputElement[];
      origInputs.forEach((orig, i) => {
        const cloned = cloneInputs[i];
        if (!cloned) return;
        const computed = window.getComputedStyle(orig);
        const span = document.createElement('div');
        span.style.cssText = cloned.style.cssText;
        span.style.minHeight = computed.height !== 'auto' ? computed.height : '32px';
        span.style.display = 'flex';
        span.style.alignItems = 'center';
        span.textContent = orig.value || orig.placeholder || '—';
        if (!orig.value) span.style.color = '#333';
        cloned.parentNode?.replaceChild(span, cloned);
      });

      // 7. CSS vars fix
      clone.innerHTML = clone.innerHTML
        .replace(/var\(--text-primary\)/g, '#344054')
        .replace(/var\(--state-danger\)/g, '#ff3366');

      // 8. Preparar datos para interactividad
      const datosParaCompartir = buildDatosParaCompartir(true);

      // 9. Guardar snapshot y datos
      const snapshotHtml = wrapResumenSnapshot(clone.innerHTML);
      const { error: saveError } = await supabase
        .from('resumen_mensual')
        .upsert({
          anio: selectedAnio,
          mes: selectedMes,
          experiencia_cliente: JSON.stringify({
            text: resumen.experiencia_cliente,
            html: snapshotHtml,
            datos: datosParaCompartir,
            snapshotVersion: RESUMEN_SNAPSHOT_VERSION,
          }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'anio,mes' });

      if (saveError) {
        alert(`ERROR al guardar snapshot: ${saveError.message}`);
        return;
      }

      const baseUrl = window.location.origin;
      const publicUrl = `${baseUrl}/publico/resumen-mensual?anio=${selectedAnio}&mes=${selectedMes}`;

      // 10. Copiar link
      try {
        await navigator.clipboard.writeText(publicUrl);
      } catch {
        const inp = document.createElement('input');
        inp.value = publicUrl;
        document.body.appendChild(inp);
        inp.select();
        document.execCommand('copy');
        document.body.removeChild(inp);
      }
      setPublicLink(publicUrl);
      onSuccess('Link público generado y copiado');
    } catch (err: any) {
      alert('ERROR inesperado: ' + (err?.message || err));
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    setSaving(true);
    const gestionesMap: Record<string, number> = {};
    const presupuestosMap: Record<string, number> = {};
    kpiPorAnalista.forEach(k => {
      gestionesMap[k.analista] = k.clientesIngresados;
      presupuestosMap[k.analista] = k.ops;
    });

    const datosParaCompartir = buildDatosParaCompartir(false);

    const payload = {
      anio: selectedAnio,
      mes: selectedMes,
      ...resumen,
      experiencia_cliente: JSON.stringify({
        text: resumen.experiencia_cliente,
        html: lastSnapshot,
        datos: datosParaCompartir,
        snapshotVersion: detectResumenSnapshotVersion(lastSnapshot),
      }),
      gestiones_por_analista: gestionesMap,
      presupuestos_por_analista: presupuestosMap,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('resumen_mensual')
      .upsert(payload, { onConflict: 'anio,mes' });
    setSaving(false);
    if (error) onError(`Error al guardar: ${error.message}`);
    else onSuccess(`Resumen de ${CONFIG.MESES_NOMBRES[selectedMes - 1]} ${selectedAnio} guardado`);
  };

  const tendBadge = (pct: number | null, showLabel = false) => {
    if (pct === null) return <span data-snapshot-fragment style={{ color: '#333' }}>—</span>;
    return (
      <div data-snapshot-fragment title="Variación vs mes anterior" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {showLabel && <span style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>vs mes anterior</span>}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#263550', background: '#f4f7fa', border: '1px solid #d9e2ea', padding: '2px 6px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 3, minWidth: '60px', justifyContent: 'center' }}>
          <span className={`report-trend-direction ${pct >= 0 ? 'is-positive' : 'is-negative'}`}>{pct >= 0 ? '▲' : '▼'}</span> {Math.abs(pct).toFixed(2)}%
        </span>
      </div>
    );
  };

  const sectionHeader = (id: number, title: string, icon: React.ReactNode, extra?: React.ReactNode) => {
    const isCollapsed = !!collapsedSections[id];
    return (
      <div data-snapshot-fragment style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCollapsed ? 0 : 16, paddingBottom: isCollapsed ? 0 : 10, borderBottom: isCollapsed ? 'none' : '1px solid #dde5ee', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 700, color: '#314158', textTransform: 'uppercase' as const, letterSpacing: '0.65px' }}>{title}</span>
          {extra}
        </div>
        <button 
          onClick={() => toggleSection(id)}
          style={{ background: isCollapsed ? '#ffffff' : '#edf3f8', border: '1px solid #d7e0e9', borderRadius: '8px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#315b7d', transition: 'background 0.18s ease' }}
        >
          <ChevronDown size={14} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
        </button>
      </div>
    );
  };

  const mesPrev = selectedMes === 1 ? 12 : selectedMes - 1;
  const anioPrev = selectedMes === 1 ? selectedAnio - 1 : selectedAnio;

  // ── KPI por analista ──────────────────────────────────────────────────────
  const kpiPorAnalista = useMemo(() => {
    // `filterByMonth` no depende del analista, pero se llamaba dentro del `.map`:
    // recorría los ~7.000 registros dos veces por cada nombre. Se sube fuera del
    // loop — mismo resultado, 2 pasadas en total en vez de 2 × nombres.
    const regsMes = filterByMonth(registros, selectedMes, selectedAnio);
    const regsMesAnt = filterByMonth(registros, mesPrev, anioPrev);
    return nombres.map(analista => {
      const regsAnalista = regsMes.filter(r => r.analista === analista);
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

      const ventasAnt = regsMesAnt.filter(r => r.analista === analista).filter(isVenta);
      const capitalAnt = ventasAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const opsAnt = ventasAnt.length;
      const tendCapital = capitalAnt > 0 ? ((capital - capitalAnt) / capitalAnt) * 100 : null;
      const tendOps = opsAnt > 0 ? ((ops - opsAnt) / opsAnt) * 100 : null;

      const esMesActual = selectedAnio === now.getFullYear() && selectedMes === (now.getMonth() + 1);
      const diasCfg = diasConfig.find(d => d.analista === analista) || { dias_habiles: 22, dias_transcurridos: 0 };
      const diasHabiles = Number(diasCfg.dias_habiles) || 22;
      const diasTrans = Number(diasCfg.dias_transcurridos) || 0;
      const diasRestantes = Math.max(0, diasHabiles - diasTrans);

      // Ticket promedio = total vendido (Venta + Aprob. CC) / dias transcurridos
      const ticket = diasTrans > 0 ? capital / diasTrans : 0;

      // Proyección
      const ventaPorDia = diasTrans > 0 ? capital / diasTrans : null;
      const opsPorDia = diasTrans > 0 ? ops / diasTrans : null;

      const proyeccionCapital = ventaPorDia !== null ? ventaPorDia * diasHabiles : null;
      const proyeccionOps = opsPorDia !== null ? opsPorDia * diasHabiles : null;

      const metaDiariaCapital = diasRestantes > 0 ? (metaCapital - capital) / diasRestantes : null;
      const metaDiariaOps = diasRestantes > 0 ? (metaOps - ops) / diasRestantes : null;

      return { 
        analista, capital, ops, ticket, conversion, conversionGlobal, metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps, tendCapital, tendOps,
        clientesIngresados: regsAnalista.length,
        montoVenta,
        montoAprobCC,
        // Projection
        esMesActual,
        proyeccionCapital,
        proyeccionOps,
        ventaPorDia,
        opsPorDia,
        metaDiariaCapital,
        metaDiariaOps,
        diasHabilesAdmin: diasHabiles,
        diasTransAdmin: diasTrans,
        tieneDiasAdmin: diasHabiles > 0
      };
    });
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev, diasConfig, nombres]);

  // ── KPI total ─────────────────────────────────────────────────────────────
  const kpiTotal = useMemo(() => {
    // Dias transcurridos del mes: usa el entry 'Todos' como fuente canonica; fallback al max
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

    const regsAnt = filterByMonth(registros, mesPrev, anioPrev);
    const ventasAnt = regsAnt.filter(isVenta);
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

    const obj = objetivos.find(o => o.analista === 'PDV' && o.mes === selectedMes - 1 && o.anio === selectedAnio);
    const metaCapital = obj?.meta_ventas ?? 0;
    const metaOps = obj?.meta_operaciones ?? 0;
    const cumplCapital = metaCapital > 0 ? (capital / metaCapital) * 100 : null;
    const restanteCapital = metaCapital > 0 ? Math.max(0, 100 - (capital / metaCapital) * 100) : null;
    const cumplOps = metaOps > 0 ? (ops / metaOps) * 100 : null;
    const restanteOps = metaOps > 0 ? Math.max(0, 100 - (ops / metaOps) * 100) : null;

    return { capital, ops, ticket, conversion, conversionGlobal, clientes, tendCapital, tendOps, tendTicket, tendClientes, tendConversion, tendConversionGlobal, metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps, montoVenta, montoAprobCC };
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev, diasConfig]);

  // ── Días restantes del período para el badge en Tablero ───────────────────
  const diasRestantesCalculados = useMemo(() => {
    const hoy = new Date();
    const esMesActual = selectedMes === (hoy.getMonth() + 1) && selectedAnio === hoy.getFullYear();
    const esMesPasado = selectedAnio < hoy.getFullYear() || (selectedAnio === hoy.getFullYear() && selectedMes < (hoy.getMonth() + 1));

    if (esMesPasado) {
      return 0;
    }

    const cfgTodos = diasConfig.find(d => d.analista === 'Todos');
    const diasHabilesAdmin = cfgTodos ? (Number(cfgTodos.dias_habiles) || 0) : 0;
    const diasTransAdmin = cfgTodos ? (Number(cfgTodos.dias_transcurridos) || 0) : 0;

    if (diasHabilesAdmin > 0) {
      if (esMesActual) {
        return Math.max(0, diasHabilesAdmin - diasTransAdmin);
      }
      return diasHabilesAdmin;
    }

    return 0;
  }, [selectedMes, selectedAnio, diasConfig]);

  const badgeDiasRestantes = useMemo(() => {
    const num = diasRestantesCalculados;
    const displayNum = num % 1 === 0 ? num : num.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const texto = num === 1 ? `${displayNum} día restante` : `${displayNum} días restantes`;

    return (
      <div
        data-snapshot-fragment
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 8, background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.22)', color: '#93c5fd', fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', fontFamily: UI_FONT_FAMILY, boxShadow: '0 0 14px rgba(59, 130, 246, 0.08)', textTransform: 'none' }}
        title={`Días hábiles restantes: ${texto}`}
      >
        <Clock size={12} strokeWidth={2.5} style={{ color: '#60a5fa' }} />
        <span>{texto}</span>
      </div>
    );
  }, [diasRestantesCalculados]);

  // ── Distribuciones demográficas (ventas del mes) ─────────────────────────
  const ventasMes = useMemo(() =>
    filterByMonth(registros, selectedMes, selectedAnio),
    [registros, selectedMes, selectedAnio]
  );


  // Las cinco distribuciones de abajo más `distAcuerdos` recorrían cada una
  // `ventasMes` con el mismo predicado: 6 pasadas idénticas por cada cambio de
  // mes/año. Se calcula una sola vez; el resultado es el mismo array.
  const ventasMesVendidas = useMemo(() => ventasMes.filter(isVenta), [ventasMes]);

  const distEmpleador = useMemo(() => buildDistEmpleador(ventasMesVendidas), [ventasMesVendidas]);

  const distCuotas = useMemo(() => distPor('cuotas', ventasMesVendidas), [ventasMesVendidas]);
  const distRangoEtario = useMemo(() => distPor('rango_etario', ventasMesVendidas), [ventasMesVendidas]);
  const distSexo = useMemo(() => distPor('sexo', ventasMesVendidas), [ventasMesVendidas]);
  const distLocalidad = useMemo(() => distPor('localidad', ventasMesVendidas), [ventasMesVendidas]);
  const distEstados = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of ventasMes) {
      const raw = (r.estado || '').toLowerCase().trim();
      let label = '';

      if (raw.includes('derivado') || raw.includes('aprobado cc')) {
        label = 'Aprob. CC';
      } else if (raw.includes('rechazado')) {
        label = 'Rechaz. CC';
      } else if (raw === 'venta') {
        label = 'Venta';
      } else if (raw === 'proyeccion') {
        label = 'Proyección';
      } else if (raw === 'en seguimiento') {
        label = 'En Seguimiento';
      } else if (raw === 'no califica') {
        label = 'No califica';
      } else if (raw === 'score bajo') {
        label = 'Score Bajo';
      } else if (raw === 'afectaciones') {
        label = 'Afectaciones';
      } else {
        label = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'No especificado';
      }

      const prev = map.get(label) ?? { monto: 0, cantidad: 0 };
      map.set(label, { monto: prev.monto + (Number(r.monto) || 0), cantidad: prev.cantidad + 1 });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([label, data]) => ({ label, ...data }));
  }, [ventasMes]);
  const distAcuerdos = useMemo(() => {
    const tipos = emptyTiposAcuerdo();
    for (const r of ventasMesVendidas) {
      const matched = matchTipoAcuerdo(r.acuerdo_precios ?? '', r.estado ?? '', true);
      if (matched) {
        tipos[matched].monto += Number(r.monto) || 0;
        tipos[matched].cantidad += 1;
      }
    }
    return Object.entries(tipos)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [ventasMesVendidas]);

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
      if (matched) {
        tipos[matched].monto += Number(r.monto) || 0;
        tipos[matched].cantidad += 1;
      }
    }
    return Object.entries(tipos)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [registros]);

  // ── Distribuciones mes anterior ───────────────────────────────────────────
  const ventasMesAnt = useMemo(() =>
    filterByMonth(registros, mesPrev, anioPrev),
    [registros, mesPrev, anioPrev]
  );

  // ── Config base de gráficos (dark theme) ─────────────────────────────────
  const mesActualLabel = CONFIG.MESES_NOMBRES[selectedMes - 1].slice(0, 3);
  const mesAntLabel = CONFIG.MESES_NOMBRES[mesPrev - 1].slice(0, 3);

  const baseChartOpts = (yLabel = '', horizontal = false, showLabels = false, showLegend = false, stacked = false): any => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' as const : 'x' as const,
    layout: { padding: { top: showLabels ? 30 : 12, bottom: 0 } },
    _isPct: yLabel.includes('%'), // Flag explícito para el plugin
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
        align: 'end' as const,
        labels: { color: '#667085', font: { size: 10, family: UI_FONT_FAMILY }, usePointStyle: true, padding: 10 }
      },
      tooltip: {
        backgroundColor: 'rgba(23, 32, 51, 0.96)',
        titleColor: '#ffffff',
        titleFont: { size: 13, weight: 700, family: UI_FONT_FAMILY },
        titleAlign: 'center' as const,
        titleMarginBottom: 8,
        bodyColor: '#f1f5f9',
        bodyFont: { size: 12, weight: 600, family: UI_FONT_FAMILY },
        bodySpacing: 6,
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 9,
        boxPadding: 5,
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
    categoryPercentage: 0.85,
    barPercentage: 0.9,
    scales: {
      x: {
        stacked,
        ticks: {
          color: '#667085', font: { size: 9, family: UI_FONT_FAMILY },
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
          color: '#667085', font: { size: 9, family: UI_FONT_FAMILY },
          precision: yLabel.includes('ops') || yLabel.includes('reg') ? 0 : undefined,
          callback: function (this: any, val: any) {
            const n = Number(val);
            if (isNaN(n)) return val;
            if (horizontal) return val; // Generalmente labels de analistas
            if (yLabel.includes('%')) return n.toFixed(0) + '%';
            if (yLabel.includes('$') && n >= 1_000_000) return '$ ' + (n / 1_000_000).toFixed(0) + 'M';
            if (yLabel.includes('$') && n >= 1000) return '$ ' + (n / 1000).toFixed(0) + 'K';
            if (n >= 1000) return n.toLocaleString('es-AR') + yLabel;
            return n + yLabel;
          }
        },
        grid: { color: 'rgba(49,91,125,0.08)' }, border: { display: false }, beginAtZero: true,
      },
    },
  });

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

  // ── Datos gráfico cumplimiento por analista ───────────────────────────────
  const chartCumplimiento = useMemo(() => {
    const labels = kpiPorAnalista.map(k => k.analista);
    return {
      labels,
      datasets: [
        {
          label: `Capital ${mesActualLabel}`,
          data: kpiPorAnalista.map(k => k.cumplCapital ?? 0),
          backgroundColor: 'rgba(49, 91, 125, .78)',
          borderColor: '#315b7d',
          borderWidth: 0,
          order: 1,
        },
        {
          label: `Capital ${mesAntLabel}`,
          data: kpiPorAnalista.map(k => {
            const ant = ventasMesAnt.filter(r => r.analista === k.analista).filter(isVenta);
            const capitalAnt = ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
            const objAnt = objetivos.find(o => o.analista === k.analista && o.mes === mesPrev - 1 && o.anio === anioPrev);
            return objAnt?.meta_ventas ? (capitalAnt / objAnt.meta_ventas) * 100 : 0;
          }),
          backgroundColor: 'rgba(153, 170, 184, .55)',
          borderColor: '#99aab8',
          borderWidth: 0,
          order: 1,
        },
        {
          label: `Ops ${mesActualLabel}`,
          data: kpiPorAnalista.map(k => k.cumplOps ?? 0),
                    backgroundColor: (context: any) => getGradient(context, 'rgba(6, 182, 212, 0.05)', 'rgba(6, 182, 212, 0.85)'),
          borderColor: '#06b6d4',
          borderWidth: 0,
          order: 1,
        },
        {
          label: `Ops ${mesAntLabel}`,
          data: kpiPorAnalista.map(k => {
            const ant = ventasMesAnt.filter(r => r.analista === k.analista).filter(isVenta);
            const opsAnt = ant.length;
            const objAnt = objetivos.find(o => o.analista === k.analista && o.mes === mesPrev - 1 && o.anio === anioPrev);
            return objAnt?.meta_operaciones ? (opsAnt / objAnt.meta_operaciones) * 100 : 0;
          }),
                    backgroundColor: (context: any) => getGradient(context, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'),
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 0,
          order: 1, // Purpura oscuro
        },
        refLine100(labels.length),
      ],
    };
  }, [kpiPorAnalista, ventasMesAnt, objetivos, mesPrev, anioPrev, mesActualLabel, mesAntLabel]);

  // ── Datos gráfico acuerdo de precios ──────────────────────────────────────
  const chartAcuerdos = useMemo(() => {
    const analistas = nombres;
    const colores = ['rgba(96, 165, 250, 0.15)', 'rgba(167, 139, 250, 0.15)'];
    const borderColores = ['rgba(96, 165, 250, 0.5)', 'rgba(167, 139, 250, 0.5)'];

    return {
      labels: TIPOS_ACUERDO,
      datasets: analistas.map((an, idx) => ({
        label: an,
        data: TIPOS_ACUERDO.map(t => {
          return filterByMonth(registros, selectedMes, selectedAnio).filter(r => {
            const matched = matchTipoAcuerdo(r.acuerdo_precios ?? '', r.estado ?? '', isVenta(r));
            return r.analista === an && matched === t;
          }).length;
        }),
        backgroundColor: colores[idx] || 'rgba(255,255,255,0.05)',
        borderColor: borderColores[idx] || 'rgba(255,255,255,0.2)',
        borderWidth: 0,
      }))
    };
  }, [registros, selectedMes, selectedAnio, nombres]);

  // ── Chart 1: Capital vs Objetivo ──────────────────────────────────────────
  const chartCapitalVsObjetivo = useMemo(() => {
    const labels = ['Total PDV'];
    const capitalAct = [kpiTotal.capital];
    const capitalAnt = [
      ventasMesAnt.filter(isVenta).reduce((s, r) => s + (Number(r.monto) || 0), 0),
    ];
    const objetivo = [kpiTotal.metaCapital || 0];
    return {
      labels,
      datasets: [
        { 
          label: `Capital ${mesActualLabel}`, 
          data: capitalAct, 
                    backgroundColor: (context: any) => getGradient(context, 'rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.85)'),
          borderColor: '#10b981',
          borderWidth: 0, 
          order: 1, 
          maxBarThickness: 120 
        },
        { 
          label: `Capital ${mesAntLabel}`, 
          data: capitalAnt, 
                    backgroundColor: (context: any) => getGradient(context, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'),
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 0, 
          order: 1, 
          maxBarThickness: 120 
        },
        { type: 'line' as const, label: 'Objetivo', data: objetivo, borderColor: '#b05260', borderWidth: 2, borderDash: [5, 4], pointRadius: 0, pointBackgroundColor: '#b05260', fill: false, order: 0, horizontalReferenceValue: objetivo[0] },
      ],
    };
  }, [kpiTotal, ventasMesAnt, mesActualLabel, mesAntLabel]);

  // ── Chart 2: Ticket Promedio ──────────────────────────────────────────────
  const chartTicketPromedio = useMemo(() => {
    const labels = ['Total PDV'];
    const ticketAnt = [
      (() => {
        const vAnt = ventasMesAnt.filter(isVenta);
        return vAnt.length > 0 ? vAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0) / vAnt.length : 0;
      })(),
    ];
    return {
      labels,
      datasets: [
        {
          label: `Ticket ${mesActualLabel}`,
          data: [kpiTotal.ticket],
          backgroundColor: 'rgba(189, 137, 62, .72)',
          borderColor: '#bd893e',
          borderWidth: 0, borderRadius: 4, maxBarThickness: 120 
        },
        { 
          label: `Ticket ${mesAntLabel}`, 
          data: ticketAnt, 
          backgroundColor: 'rgba(153, 170, 184, .55)',
          borderColor: '#99aab8',
          borderWidth: 0, borderRadius: 4, maxBarThickness: 120 
        },
      ],
    };
  }, [kpiTotal, ventasMesAnt, mesActualLabel, mesAntLabel]);

  // ── Chart 4: Variación % vs mes anterior ─────────────────────────────────
  const chartVariacion = useMemo(() => {
    const labels = [...nombres, 'Total PDV'];
    const capitalVar = [...kpiPorAnalista.map(k => k.tendCapital ?? 0), kpiTotal.tendCapital ?? 0];
    const opsVar = [...kpiPorAnalista.map(k => k.tendOps ?? 0), kpiTotal.tendOps ?? 0];
    return {
      labels,
      datasets: [
        { 
          label: 'Variación Capital %', 
          data: capitalVar, 
          backgroundColor: capitalVar.map(v => v >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'), 
          borderColor: capitalVar.map(v => v >= 0 ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)'), 
          borderWidth: 0, borderRadius: 4, maxBarThickness: 120 
        },
        { 
          label: 'Variación Ops %', 
          data: opsVar, 
          backgroundColor: opsVar.map(v => v >= 0 ? 'rgba(167,139,250,0.15)' : 'rgba(248,113,113,0.15)'), 
          borderColor: opsVar.map(v => v >= 0 ? 'rgba(167,139,250,0.5)' : 'rgba(248,113,113,0.5)'), 
          borderWidth: 0, borderRadius: 4, maxBarThickness: 120 
        },
      ],
    };
  }, [kpiPorAnalista, kpiTotal, nombres]);

  // ── Chart 7: Aperturas vs Renovaciones ───────────────────────────────────
  const apertVsRenData = useMemo(() => {
    const allVentas = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);
    const allAnt = ventasMesAnt.filter(isVenta);
    return {
      porAnalista: nombres.map(analista => {
        const v = allVentas.filter(r => r.analista === analista);
        return { analista, aperturas: v.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: v.filter(r => r.tipo_cliente === 'Renovacion').length };
      }),
      porAnalistaAnt: nombres.map(analista => {
        const v = allAnt.filter(r => r.analista === analista);
        return { analista, aperturas: v.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: v.filter(r => r.tipo_cliente === 'Renovacion').length };
      }),
      total: { aperturas: allVentas.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: allVentas.filter(r => r.tipo_cliente === 'Renovacion').length },
      ant: { aperturas: allAnt.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: allAnt.filter(r => r.tipo_cliente === 'Renovacion').length },
    };
  }, [registros, selectedMes, selectedAnio, ventasMesAnt, nombres]);

  const chartAperturas = useMemo(() => {
    const labels = ['Total PDV'];
    return {
      labels,
      datasets: [
        {
          label: `Actual`,
          data: [apertVsRenData.total.aperturas],
          backgroundColor: 'rgba(82, 145, 124, .72)',
          borderColor: '#528f7c',
          borderWidth: 0, borderRadius: 4, maxBarThickness: 120
        },
        {
          label: `Anterior`,
          data: [apertVsRenData.ant.aperturas],
          backgroundColor: 'rgba(153, 170, 184, .55)',
          borderColor: '#99aab8',
          borderWidth: 0, borderRadius: 4, maxBarThickness: 120 
        },
      ],
    };
  }, [apertVsRenData]);

  const chartRenovaciones = useMemo(() => {
    const labels = ['Total PDV'];
    return {
      labels,
      datasets: [
        {
          label: `Actual`,
          data: [apertVsRenData.total.renovaciones],
          backgroundColor: 'rgba(96, 125, 168, .72)',
          borderColor: '#607da8',
          borderWidth: 0, borderRadius: 4, maxBarThickness: 120
        },
        {
          label: `Anterior`,
          data: [apertVsRenData.ant.renovaciones],
          backgroundColor: 'rgba(153, 170, 184, .55)',
          borderColor: '#99aab8',
          borderWidth: 0, borderRadius: 4, maxBarThickness: 120 
        },
      ],
    };
  }, [apertVsRenData]);

  // ── Chart 8: % Empleo Público / Privado ──────────────────────────────────
  const empleoPublPrivData = useMemo(() => {
    const PUBLICO = ['municipio', 'municip', 'provincia', 'hospital', 'escuela', 'público', 'gobierno', 'estado', 'policia', 'policía', 'nación', 'nacional', 'ministerio', 'judicial', 'fuerzas'];
    const ventas = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);
    
    const classify = (r: Registro) => {
      const e = (r.empleador ?? '').toLowerCase();
      if (PUBLICO.some(k => e.includes(k))) return 'Público';
      if (e.trim() === '' || e === 'sin dato') return 'Sin dato';
      return 'Privado';
    };

    const labels = ['Público', 'Privado', 'Sin dato'];
    const dataPorAnalista = nombres.map(analista => {
      const counts: Record<string, number> = { 'Público': 0, 'Privado': 0, 'Sin dato': 0 };
      ventas.filter(r => r.analista === analista).forEach(r => counts[classify(r)]++);
      return { analista, counts };
    });

    return { dataPorAnalista, labels };
  }, [registros, selectedMes, selectedAnio, nombres]);

  const chartEmpleoPublPriv = useMemo(() => {
    const { labels, dataPorAnalista } = empleoPublPrivData;
    const analistas = nombres;
    const colores = ['rgba(96, 165, 250, 0.15)', 'rgba(167, 139, 250, 0.15)'];
    const borderColores = ['rgba(96, 165, 250, 0.5)', 'rgba(167, 139, 250, 0.5)'];

    return {
      labels,
      datasets: analistas.map((an, idx) => ({
        label: an,
        data: labels.map(l => dataPorAnalista.find(d => d.analista === an)?.counts[l] || 0),
        backgroundColor: colores[idx] || 'rgba(255, 255, 255, 0.05)',
        borderColor: borderColores[idx] || 'rgba(255, 255, 255, 0.2)',
        borderWidth: 0,
      }))
    };
  }, [empleoPublPrivData, nombres]);

  // ── Chart 10: % Total Conversión ─────────────────────────────────────────
  const chartConversionTotal = useMemo(() => {
    const labels = [...nombres, 'Total PDV'];
    const actual = [...kpiPorAnalista.map(k => k.conversionGlobal), kpiTotal.conversionGlobal];
    const anterior = [
      ...kpiPorAnalista.map(k => {
        const regsAnt = ventasMesAnt.filter(r => r.analista === k.analista);
        return conversionTotalPct(regsAnt) ?? 0;
      }),
      conversionTotalPct(ventasMesAnt) ?? 0,
    ];
    return {
      labels,
      datasets: [
        { 
          label: `Conversión % ${mesActualLabel}`, 
          data: actual, 
          backgroundColor: (context: any) => getGradient(context, 'rgba(139, 92, 246, 0.05)', 'rgba(139, 92, 246, 0.85)'),
          borderColor: '#8b5cf6',
          borderWidth: 0, 
          order: 1 
        },
        { 
          label: `Conversión % ${mesAntLabel}`, 
          data: anterior, 
                    backgroundColor: (context: any) => getGradient(context, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'),
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 0, 
          order: 1 
        },
        refLine100(labels.length),
      ],
    };
  }, [kpiPorAnalista, kpiTotal, ventasMesAnt, mesActualLabel, mesAntLabel, nombres]);

  // ── Chart 5: Embudo Comercial ────────────────────────────────────────────
  const chartEmbudo = useMemo(() => {
    const labels = nombres;
    const regsMes = filterByMonth(registros, selectedMes, selectedAnio);
    const cerradas = labels.map(a => regsMes.filter(r => r.analista === a && isVenta(r)).length);
    
    return {
      labels,
      datasets: [
        {
          data: cerradas,
          backgroundColor: [
            'rgba(0, 255, 136, 0.15)', 
            'rgba(255, 170, 0, 0.15)', 
            'rgba(139, 92, 246, 0.15)', 
            'rgba(236, 72, 153, 0.15)', 
            'rgba(245, 158, 11, 0.15)', 
            'rgba(239, 68, 68, 0.15)'
          ],
          borderColor: [
            'rgba(0, 255, 136, 0.8)', 
            'rgba(255, 170, 0, 0.8)', 
            'rgba(139, 92, 246, 0.4)', 
            'rgba(236, 72, 153, 0.4)', 
            'rgba(245, 158, 11, 0.4)', 
            'rgba(239, 68, 68, 0.4)'
          ],
          borderWidth: 0,
          hoverOffset: 10,
          borderRadius: 4,
          spacing: 4
        }
      ],
    };
  }, [registros, selectedMes, selectedAnio, nombres]);

  // ── Chart 6: % Conversión de Presupuesto ──────────────────────────────────
  const chartConversionPresupuesto = useMemo(() => {
    const labels = nombres;
    const data = labels.map((a, i) => {
      const pres = resumen.presupuestos_por_analista[a] ?? 0;
      const ops = kpiPorAnalista[i]?.ops ?? 0;
      return pres > 0 ? (ops / pres) * 100 : 0;
    });
    return {
      labels,
      datasets: [
        { 
          label: '% Conv. Presupuesto → Venta', 
          data, 
          backgroundColor: 'rgba(52, 211, 153, 0.15)', 
          borderColor: 'rgba(52, 211, 153, 0.5)',
          borderWidth: 0, 
          order: 1 
        },
        refLine100(labels.length),
      ],
    };
  }, [resumen.presupuestos_por_analista, kpiPorAnalista, nombres]);

  // ── Chart Venta Diaria Pura ──────────────────────────────────────────────────
  const chartVentaDiaria = useMemo(() => {
    const regsMes = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);

    const daysInMonth = new Date(selectedAnio, selectedMes, 0).getDate();
    const isCurrentMonth = selectedMes === (now.getMonth() + 1) && selectedAnio === now.getFullYear();
    const maxDay = isCurrentMonth ? now.getDate() : daysInMonth;

    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    
    if (filtroActividad === 'Comparativa') {
      return {
        labels,
        datasets: ANALISTA_COLORES.map(({ nombre, color, bg }) => ({
          label: nombre,
          data: labels.map((_, i) => {
            const day = i + 1;
            if (day > maxDay) return null;
            const dayStr = `${selectedAnio}-${String(selectedMes).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayRegs = regsMes.filter(r => r.fecha?.slice(0, 10) === dayStr && r.analista === nombre);
            return dayRegs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
          }),
          backgroundColor: bg,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: color,
          fill: true,
          tension: 0.3
        }))
      };
    }

    const realData = labels.map((_, i) => {
      const day = i + 1;
      if (day > maxDay) return null;
      const dayStr = `${selectedAnio}-${String(selectedMes).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayRegs = regsMes.filter(r => {
        if (r.fecha?.slice(0, 10) !== dayStr) return false;
        if (filtroActividad === 'PDV') return true; // PDV = Total
        return r.analista === filtroActividad;
      });
      return dayRegs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    });

    let color = '#315b7d';
    let bgColor = 'rgba(49, 91, 125, 0.1)';
    const matchAnalista = ANALISTA_COLORES.find(a => a.nombre === filtroActividad);
    if (matchAnalista) { color = matchAnalista.color; bgColor = matchAnalista.bg; }

    return {
      labels,
      datasets: [
        {
          label: filtroActividad === 'PDV' ? 'Venta Total PDV' : `Venta ${filtroActividad}`,
          data: realData,
          backgroundColor: bgColor,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: color,
          fill: true,
          tension: 0.3
        }
      ]
    };
  }, [registros, selectedMes, selectedAnio, filtroActividad, ANALISTA_COLORES]);

  const chartVentaDiariaOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { bottom: 0 } },
    plugins: {
      legend: { 
        display: filtroActividad === 'Comparativa',
        labels: { color: '#667085', boxWidth: 10, boxHeight: 10, font: { size: 10, weight: 700, family: UI_FONT_FAMILY } }
      },
      tooltip: {
        backgroundColor: 'rgba(24, 38, 58, 0.96)',
        titleColor: '#ffffff',
        titleFont: { size: 12, weight: 700, family: UI_FONT_FAMILY },
        bodyColor: '#fff',
        bodyFont: { size: 12, weight: 700, family: UI_FONT_FAMILY },
        padding: 12,
        cornerRadius: 9,
        callbacks: {
          title: (items: any[]) => `Día ${items[0].label}`,
          label: (ctx: any) => {
            return filtroActividad === 'Comparativa' 
              ? `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
              : formatCurrency(ctx.raw);
          }
        }
      }
    },
    scales: {
      x: { 
        offset: false,
        grid: { color: 'rgba(49,91,125,0.08)' },
        ticks: { color: '#667085', font: { size: 9 } }
      },
      y: { 
        beginAtZero: true,
        min: 0,
        grace: 0,
        grid: { color: 'rgba(49,91,125,0.08)' },
        ticks: { color: '#667085', font: { size: 9 }, callback: (v: any) => formatCurrency(v), padding: 0 }
      }
    },
    interaction: { mode: 'index' as const, intersect: false }
  };

  const heatmapData = useMemo(() => {
    const daysInMonth = new Date(selectedAnio, selectedMes, 0).getDate();
    const firstDay = new Date(selectedAnio, selectedMes - 1, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Lunes = 0

    const rawData = chartVentaDiaria.datasets[0].data.map((v, i) => {
      let sum = Number(v) || 0;
      if (chartVentaDiaria.datasets[1]) {
        sum += Number(chartVentaDiaria.datasets[1].data[i]) || 0;
      }
      return sum;
    });
    const maxVal = Math.max(...rawData, 1);

    const weeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];
    for (let i = 0; i < offset; i++) currentWeek.push(null);
    
    for (let d = 1; d <= daysInMonth; d++) {
      currentWeek.push(d);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    const weekTotals = weeks.map(week => {
      return week.reduce((sum: number, day) => {
        if (day === null) return sum;
        return sum + rawData[day - 1];
      }, 0);
    });

    const totalPeriodo = rawData.reduce((s, v) => s + v, 0);

    const daySums = [0, 0, 0, 0, 0, 0, 0];
    for (let d = 1; d <= daysInMonth; d++) {
      const dObj = new Date(selectedAnio, selectedMes - 1, d);
      const idx = dObj.getDay() === 0 ? 6 : dObj.getDay() - 1;
      daySums[idx] += rawData[d - 1];
    }
    const maxDayIdx = daySums.indexOf(Math.max(...daySums));
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const diaMasActivo = totalPeriodo > 0 ? dayNames[maxDayIdx] : '—';

    return { offset, data: rawData, maxVal, daysInMonth, weeks, weekTotals, totalPeriodo, diaMasActivo };
  }, [chartVentaDiaria, selectedMes, selectedAnio]);

  const formatK = (val: number) => {
    if (!val) return '';
    return '$' + (val / 1000).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + 'K';
  };

  return (
    <div className={styles.page}>

      {/* Toolbar Superior: Control de Reporte */}
      <div className={styles.toolbar}>
        {/* Fila 1: Título y Acciones */}
        <div className={styles.toolbarTop}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon}>
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className={styles.pageTitle}>
                Resumen Mensual
              </h1>
              <div className={styles.pageSubtitle}>
                Panel de gestión estratégica
              </div>
            </div>
          </div>

          <div className={styles.toolbarActions}>
            
            <button
              onClick={handleGenerarLink}
              className={styles.secondaryButton}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              Generar Link
            </button>
            <button
              onClick={handleGuardar}
              disabled={saving}
              className={styles.primaryButton}
            >
              <Save size={16} strokeWidth={2.5} />
              {saving ? 'Guardando...' : `Guardar Resumen`}
            </button>
          </div>
        </div>

        {/* Divisor interno */}
        <div className={styles.toolbarDivider} />

        {/* Fila 2: Selectores de Período */}
        <div className={styles.periodRow}>
          <div className={styles.periodGroup}>
            <div className={styles.periodLabel}>
              Seleccionar período
            </div>
            <div className={styles.periodControl}>
              <div className={styles.periodOptions}>
                {CONFIG.MESES_NOMBRES.map((nombre, i) => (
                  <button key={i} onClick={() => setSelectedMes(i + 1)} className={`${styles.periodButton} ${selectedMes === i + 1 ? styles.isSelected : ''}`}
                  >{nombre.slice(0, 3)}</button>
                ))}
              </div>
              
              <div className={styles.periodDivider} />
              
              <div className={styles.periodOptions}>
                {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                  <button key={y} onClick={() => setSelectedAnio(y)} className={`${styles.periodButton} ${selectedAnio === y ? styles.isSelected : ''}`}
                  >{y}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BANNER DE LINK GENERADO (A LO ANCHO) */}
      {publicLink && (
        <div className={styles.liveStyle035}>
          <div className={styles.liveStyle036}>
            <div className={styles.liveStyle037}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ff88" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            </div>
            <div className={styles.liveStyle038}>
              <span className={styles.liveStyle039}>
                Link Público del Reporte Generado
              </span>
              <a href={publicLink} target="_blank" rel="noopener noreferrer" className={styles.liveStyle040}>
                {publicLink}
              </a>
            </div>
          </div>
          <div className={styles.liveStyle041}>

            <button
              onClick={() => {
                navigator.clipboard.writeText(publicLink);
                setCopied(true);
                setTimeout(() => {
                  setCopied(false);
                  setPublicLink('');
                }, 2000);
              }}
              className={styles.liveStyle042} style={{ background: copied ? 'rgba(16, 185, 129, 0.2)' : '#00ff88', color: copied ? '#00ff88' : '#000', boxShadow: copied ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.3)' }}
            >
              {copied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
              {copied ? 'Copiado' : 'Copiar Link'}
            </button>
          </div>
        </div>
      )}

      {loadingData ? (
        <div className={styles.liveStyle043}>
          <div className={`spinner ${styles.liveStyle044}`}  />
          <span className={styles.liveStyle045}>Cargando Datos del Reporte...</span>
        </div>
      ) : (
        // SNAPSHOT STYLE BOUNDARY — todo lo que cuelga de #resumen-reporte-body se serializa
        // con clone.innerHTML (ver handleGenerarLink) y se persiste como HTML en Supabase.
        // Los estilos de este subárbol deben quedar autocontenidos en `style=`: no migrar
        // estos inline a clases (y jamás a CSS Modules, cuyo hash cambia entre builds) sin
        // actualizar antes el pipeline de snapshot. Guardado por tests/snapshot-boundary.test.mjs.
        <div id="resumen-reporte-body" className="snapshot-producer" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── SECCIÓN 1: TABLERO ── */}
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {sectionHeader(1, '1. Tablero', <BarChart3 size={15} color="#315b7d" />, badgeDiasRestantes)}
            {!collapsedSections[1] && (
              <>
              <div className="monthly-kpi-grid">
                <div className="monthly-kpi-card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Capital Vendido</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div className="monthly-kpi-value">{formatCurrency(kpiTotal.capital)}</div>
                    {tendBadge(kpiTotal.tendCapital)}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>
                    Meta: {kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}
                  </div>
                  {kpiTotal.cumplCapital !== null && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  <span style={{ color: cumplColor(kpiTotal.cumplCapital), marginRight: 4 }}>●</span>
                  {kpiTotal.cumplCapital.toFixed(1)}% Cumpl.
                </div>
              )}
                  <div className="monthly-kpi-chart">
                    <div className="monthly-progress-head"><span>Avance del objetivo</span><strong>{(kpiTotal.cumplCapital ?? 0).toFixed(1)}%</strong></div>
                    <div className="monthly-progress-track"><span style={{ width: `${Math.min(kpiTotal.cumplCapital ?? 0, 100)}%` }} /></div>
                    <div className="monthly-goal-values"><span>Vendido <b>{formatCurrency(kpiTotal.capital)}</b></span><span>Objetivo <b>{formatCurrency(kpiTotal.metaCapital)}</b></span></div>
                  </div>
                </div>
                <div className="monthly-kpi-card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Operaciones</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div className="monthly-kpi-value">{kpiTotal.ops}</div>
                    {tendBadge(kpiTotal.tendOps)}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>
                    Meta: {kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}
                  </div>
                  {kpiTotal.cumplOps !== null && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  <span style={{ color: cumplColor(kpiTotal.cumplOps), marginRight: 4 }}>●</span>
                  {kpiTotal.cumplOps.toFixed(1)}% Cumpl.
                </div>
              )}
                  <div className="monthly-kpi-chart">
                    <div className="monthly-stat-pair">
                      <div><span>Aperturas</span><strong>{apertVsRenData.total.aperturas}</strong><small>Anterior: {apertVsRenData.ant.aperturas}</small></div>
                      <div><span>Renovaciones</span><strong>{apertVsRenData.total.renovaciones}</strong><small>Anterior: {apertVsRenData.ant.renovaciones}</small></div>
                    </div>
                  </div>
                </div>
                <div className="monthly-kpi-card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Ticket Promedio</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div className="monthly-kpi-value">{formatCurrency(kpiTotal.ticket)}</div>
                    {tendBadge(kpiTotal.tendTicket)}
                  </div>
                  <div className="monthly-kpi-chart">
                    <div className="monthly-health-list">
                      <div><span>Conversión total</span><strong>{kpiTotal.conversionGlobal.toFixed(1)}%</strong></div>
                      <div><span>Tasa de cierre</span><strong>{kpiTotal.conversion.toFixed(1)}%</strong></div>
                      <div><span>Clientes ingresados</span><strong>{kpiTotal.clientes}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="monthly-dashboard-extra">
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
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
              <div style={{ flex: 1 }}>{sectionHeader(2, '2. Ventas por Categoría', <Tag size={15} color="#315b7d" />)}</div>
              {!collapsedSections[2] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <span style={{ fontSize: 11, color: '#444', fontWeight: 600 }}>
                    {periodoSec3 === 'mensual'
                      ? (() => {
                          const v = ventasMesVendidas;
                          return `MES: Solo Venta y Aprob. CC (${v.length} ops · ${formatCurrency(v.reduce((s, r) => s + (Number(r.monto) || 0), 0))})`;
                        })()
                      : `TOTAL: Todos los estados (${registros.length} ops · ${formatCurrency(registros.reduce((s, r) => s + (Number(r.monto) || 0), 0))})`}
                  </span>
                  <div className="monthly-period-toggle">
                    {(['mensual', 'total'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPeriodoSec3(p)}
                        style={{
                          padding: '4px 14px',
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.8px',
                          background: periodoSec3 === p ? '#315b7d' : 'transparent',
                          color: periodoSec3 === p ? '#fff' : '#667085',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {p === 'mensual' ? 'Mes' : 'Total'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {!collapsedSections[2] && (
              <div className="monthly-category-grid">
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
                      <DistBlock titulo="Acuerdo" icon={<PieChart size={12} color="#315b7d" />} datos={ac} color="#315b7d" totalMes={base} />
                      <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#4f708c" />} datos={cu} color="#4f708c" totalMes={base} />
                      <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#4f8275" />} datos={re} color="#4f8275" totalMes={base} />
                      <DistBlock titulo="Sexo" icon={<Users size={12} color="#6d6f91" />} datos={sx} color="#6d6f91" totalMes={base} />
                      <DistBlock titulo="Empleador" icon={<Shield size={12} color="#8a704b" />} datos={em} color="#8a704b" totalMes={base} />
                      <DistBlock titulo="Localidad" icon={<FileText size={12} color="#607d8b" />} datos={lo} color="#607d8b" totalMes={base} />
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── SECCIÓN 3: DISTRIBUCIÓN POR ESTADO Y CATEGORÍAS ── */}
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {sectionHeader(3, '3. Distribución por estado y categorías', <PieChart size={15} color="#315b7d" />)}
            {!collapsedSections[3] && (
              <div className="monthly-analysis-grid analistas-report">
                <MetricasTab selectedMes={selectedMes} selectedAnio={selectedAnio} registros={registros} analista="PDV" analistas={nombres} hideSelector reportAppearance />
                <NuevaSeccionSheets analista="PDV" active={active} reportAppearance />
              </div>
            )}
          </div>

          {/* ── SECCIÓN 4: ANÁLISIS COMERCIAL ── */}
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {sectionHeader(4, '4. Análisis Comercial', <TrendingUp size={15} color="#315b7d" />)}
            {!collapsedSections[4] && (
              <ManualTextarea
                label="Interpretación del Período"
                value={resumen.analisis_comercial}
                onChange={v => setResumen(p => ({ ...p, analisis_comercial: v }))}
                placeholder="¿Por qué se vendió más o menos? Impacto de campañas, comportamiento del cliente, factores externos..."
              />
            )}
          </div>

          {/* ── SECCIÓN 5: OPERACIÓN Y PROCESOS ── */}
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {sectionHeader(5, '5. Operación y Procesos', <Shield size={15} color="#315b7d" />)}
            {!collapsedSections[5] && (
              <ManualTextarea
                label="Cumplimiento de Procedimientos / Tiempos / Stock"
                value={resumen.operacion_procesos}
                onChange={v => setResumen(p => ({ ...p, operacion_procesos: v }))}
                placeholder="Cumplimiento de procedimientos, tiempos de atención, stock de merchandising y flyers..."
              />
            )}
          </div>

          {/* ── SECCIÓN 6: GESTIÓN COMERCIAL ── */}
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {sectionHeader(6, '6. Gestión Comercial', <Briefcase size={15} color="#315b7d" />)}
            {!collapsedSections[6] && (
              <>
                <div className="monthly-note-grid">
                  <ManualTextarea label="Gestiones Realizadas" value={resumen.gestiones_realizadas} onChange={v => setResumen(p => ({ ...p, gestiones_realizadas: v }))} placeholder="Visitas, llamados, coordinaciones del período..." />
                  <ManualTextarea label="Coordinación de Salidas" value={resumen.coordinacion_salidas} onChange={v => setResumen(p => ({ ...p, coordinacion_salidas: v }))} placeholder="Salidas al campo, visitas programadas..." />
                  <ManualTextarea label="Empresas Estratégicas" value={resumen.empresas_estrategicas} onChange={v => setResumen(p => ({ ...p, empresas_estrategicas: v }))} placeholder="Empresas clave contactadas o visitadas..." />
                </div>
                <div className="monthly-note-grid" style={{ marginTop: 14 }}>
                  <ManualTextarea label="Principales Logros" value={resumen.logros} onChange={v => setResumen(p => ({ ...p, logros: v }))} placeholder="Describí los principales logros del período..." />
                  <ManualTextarea label="Principales Desvíos / Problemas" value={resumen.desvios} onChange={v => setResumen(p => ({ ...p, desvios: v }))} placeholder="Describí los desvíos o problemas detectados..." />
                  <ManualTextarea label="Acciones Clave a Seguir" value={resumen.acciones_clave} onChange={v => setResumen(p => ({ ...p, acciones_clave: v }))} placeholder="Acciones prioritarias para el próximo período..." />
                </div>
              </>
            )}
          </div>

          {/* ── SECCIÓN 7: EXPERIENCIA DEL CLIENTE ── */}
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {sectionHeader(7, '7. Experiencia del Cliente', <FileText size={15} color="#315b7d" />)}
            {!collapsedSections[7] && (
              <ManualTextarea
                label="Reclamos y Satisfacción"
                value={resumen.experiencia_cliente}
                onChange={v => setResumen(p => ({ ...p, experiencia_cliente: v }))}
                placeholder="Cantidad y tipo de reclamos, nivel de satisfacción, problemas recurrentes..."
              />
            )}
          </div>

          {/* ── SECCIÓN 8: GESTIÓN DEL EQUIPO ── */}
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {sectionHeader(8, '8. Gestión del Equipo', <Activity size={15} color="#315b7d" />)}
            {!collapsedSections[8] && (
              <>
                {auditoriaData.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>Actividad en Sistema</div>
                    <div className="monthly-team-activity">
                      {nombres.map(analista => {
                        const count = auditoriaData.filter(a => a.analista === analista).length;
                        return (
                          <div key={analista} className="monthly-team-stat">
                            <div>{analista}</div>
                            <strong>{count}</strong>
                            <small>acciones registradas</small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="monthly-note-grid monthly-note-grid--four">
                  <ManualTextarea label="Dotación Actual" value={resumen.dotacion} onChange={v => setResumen(p => ({ ...p, dotacion: v }))} />
                  <ManualTextarea label="Ausentismo / Tardanzas" value={resumen.ausentismo} onChange={v => setResumen(p => ({ ...p, ausentismo: v }))} />
                  <ManualTextarea label="Capacitación Realizada" value={resumen.capacitacion} onChange={v => setResumen(p => ({ ...p, capacitacion: v }))} />
                  <ManualTextarea label="Evaluación de Desempeño" value={resumen.evaluacion_desempeno} onChange={v => setResumen(p => ({ ...p, evaluacion_desempeno: v }))} />
                </div>
              </>
            )}
          </div>

          {/* ── SECCIÓN 9: PLAN DE ACCIÓN ── */}
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {sectionHeader(9, '9. Plan de Acción', <Target size={15} color="#315b7d" />)}
            {!collapsedSections[9] && (
              <>
                <div className="monthly-action-table-wrap">
                <table className="monthly-action-table">
                  <thead>
                    <tr>
                      {['Problema Detectado', 'Acción Concreta', 'Responsable', 'Fecha Ejecución', ''].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.plan_acciones.map((fila, idx) => (
                      <tr key={idx}>
                        {(['problema', 'accion', 'responsable'] as const).map(campo => (
                          <td key={campo}>
                            <input
                              value={fila[campo]}
                              onChange={e => {
                                const updated = resumen.plan_acciones.map((f, i) => i === idx ? { ...f, [campo]: e.target.value } : f);
                                setResumen(p => ({ ...p, plan_acciones: updated }));
                              }}
                              placeholder={campo === 'problema' ? 'Describí el problema...' : campo === 'accion' ? 'Acción concreta...' : 'Responsable'}
                              className="monthly-action-input"
                            />
                          </td>
                        ))}
                        <td>
                          <input
                            type="date"
                            value={fila.fecha}
                            onChange={e => {
                              const updated = resumen.plan_acciones.map((f, i) => i === idx ? { ...f, fecha: e.target.value } : f);
                              setResumen(p => ({ ...p, plan_acciones: updated }));
                            }}
                            className="monthly-action-input"
                          />
                        </td>
                        <td>
                          <button
                            onClick={() => setResumen(p => ({ ...p, plan_acciones: p.plan_acciones.filter((_, i) => i !== idx) }))}
                            className="monthly-action-delete"
                          >
                            <Trash2 size={13} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <button
                  onClick={() => setResumen(p => ({ ...p, plan_acciones: [...p.plan_acciones, { problema: '', accion: '', responsable: '', fecha: '' }] }))}
                  className="monthly-action-add"
                >
                  <Plus size={14} strokeWidth={2.5} /> Agregar fila
                </button>
              </>
            )}
          </div>

          {/* ── SECCIÓN 10: VENTA DIARIA PURA ── */}
          <div className="data-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {sectionHeader(10, '10. Venta Diaria y Actividad', <BarChart3 size={15} color="#315b7d" />)}

            {!collapsedSections[10] && (
              <div className="monthly-activity-section">
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div className="monthly-activity-filter">
                    {FILTROS_ACTIVIDAD.map(f => (
                    <button
                      key={f}
                      onClick={() => setFiltroActividad(f as any)}
                      style={{
                        padding: '4px 14px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        background: filtroActividad === f ? '#315b7d' : 'transparent',
                        color: filtroActividad === f ? '#fff' : '#667085',
                        transition: 'all 0.2s ease',
                        fontFamily: UI_FONT_FAMILY
                      }}
                    >
                      {f}
                    </button>
                  ))}
                  </div>
                </div>

                <div className="monthly-activity-grid">
                  
                  {/* Gráfico de Líneas */}
                  <div className="monthly-activity-card monthly-activity-card--chart">
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 16 }}>
                    Venta Diaria {filtroActividad === 'PDV' ? 'Pura (Total PDV)' : `— ${filtroActividad}`}
                  </div>
                  <div className="monthly-daily-chart">
                    <Line data={chartVentaDiaria} options={chartVentaDiariaOptions as any} />
                  </div>
                </div>

                {/* Mapa de Actividad (Diseño Screenshot) */}
                <div className="monthly-activity-card">
                  
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ width: 3, height: 16, background: '#10b981', marginRight: 8, borderRadius: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#263550', textTransform: 'uppercase', letterSpacing: 0.5 }}>Mapa de actividad</div>
                      <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>Ventas por día — mes actual</div>
                    </div>
                  </div>

                  {/* Grid de Actividad */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    {/* Headers de Días */}
                    <div style={{ display: 'grid', gridTemplateColumns: '24px repeat(6, 1fr) 80px', gap: 6, marginBottom: 4 }}>
                      <div />
                      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                        <div key={d} style={{ fontSize: 10, color: '#667085', textAlign: 'center', fontWeight: 700 }}>{d}</div>
                      ))}
                      <div style={{ fontSize: 10, color: '#667085', textAlign: 'right', fontWeight: 700 }}>TOTAL</div>
                    </div>

                    {/* Semanas */}
                    {heatmapData.weeks.map((week, wIdx) => (
                      <div key={wIdx} style={{ display: 'grid', gridTemplateColumns: '24px repeat(6, 1fr) 80px', gap: 6 }}>
                        {/* Label de semana */}
                        <div style={{ fontSize: 10, color: '#667085', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          S{wIdx + 1}
                        </div>
                        
                        {/* Días (solo Lun a Sáb = índices 0 a 5) */}
                        {week.slice(0, 6).map((day, dIdx) => {
                          if (day === null) {
                            return <div key={dIdx} className="monthly-heatmap-cell is-empty" />;
                          }
                          
                          const val = heatmapData.data[day - 1];
                          const isFuture = day > (selectedMes === (now.getMonth() + 1) && selectedAnio === now.getFullYear() ? now.getDate() : heatmapData.daysInMonth);
                          
                          if (isFuture) {
                            return <div key={dIdx} className="monthly-heatmap-cell is-empty" />;
                          }

                          const intensity = val === 0 ? 0 : Math.max(0.15, val / heatmapData.maxVal);
                          const bg = val === 0 ? '#f1f4f7' : `rgba(79, 130, 114, ${Math.max(.2, intensity)})`;
                          const textColor = val === 0 ? 'transparent' : '#fff';
                          
                          return (
                            <div
                              key={dIdx}
                              title={`Día ${day}: ${formatCurrency(val)}`}
                              style={{
                                background: bg,
                                borderRadius: 6,
                                height: 44,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                color: textColor,
                                boxShadow: val > 0 ? `inset 0 0 0 1px rgba(49,91,125,.08)` : 'none',
                                transition: 'transform 0.2s',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={e => { if (val > 0) e.currentTarget.style.transform = 'scale(1.05)'; }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                              {formatK(val)}
                            </div>
                          );
                        })}

                        {/* Total de la Semana */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 12, fontWeight: 700, color: '#263550' }}>
                          {formatK(heatmapData.weekTotals[wIdx]) || '$0K'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Stats Footer */}
                  <div className="monthly-activity-stats">
                    <div>
                      <div style={{ fontSize: 10, color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>DÍA MÁS ACTIVO</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#263550' }}>{heatmapData.diaMasActivo}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>TOTAL PERÍODO</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#263550' }}>{formatCurrency(heatmapData.totalPeriodo)}</div>
                    </div>
                  </div>
                </div>

                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
