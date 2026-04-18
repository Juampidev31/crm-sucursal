'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Registro, Objetivo, CONFIG } from '@/types';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { formatCurrency } from '@/lib/utils';
import { Save, Plus, Trash2, BarChart3, Users, TrendingUp, Activity, Shield, Target, FileText, Download, Briefcase, PieChart, Tag } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, BarController, LineController,
} from 'chart.js';
import AnalisisTemporalTab from './AnalisisTemporalTab';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, BarController, LineController);

// ── Plugin inline: data labels on bars ───────────────────────────────────
const labelsPlugin: any = {
  id: 'labelsPlugin',
  afterDatasetsDraw(chart: any) {
    const { ctx, scales } = chart;
    const isHorizontal = chart.config.options.indexAxis === 'y';
    const isStacked = chart.config.options.scales?.x?.stacked || chart.config.options.scales?.y?.stacked;

    chart.data.datasets.forEach((ds: any, dsIdx: number) => {
      const meta = chart.getDatasetMeta(dsIdx);
      if (!meta || meta.hidden || meta.type !== 'bar') return;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = isStacked ? 'middle' : 'bottom';

      // Shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,1)';
      ctx.shadowBlur = 5;

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
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const now = new Date();

const ManualTextarea = ({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 260 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{label}</label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? `${label}...`}
      rows={4}
      style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, color: '#ccc', fontFamily: "'Outfit', sans-serif", fontSize: 13,
        padding: '12px 14px', resize: 'vertical', outline: 'none',
        width: '100%', boxSizing: 'border-box' as const,
      }}
    />
  </div>
);

export default function ResumenMensualTab({ registros, objetivos, onSuccess, onError }: Props) {
  const { setRegistrosWindowMonths } = useRegistros();
  const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(now.getFullYear());
  const [resumen, setResumen] = useState<ResumenMensual>(EMPTY_RESUMEN());
  const [auditoriaData, setAuditoriaData] = useState<{ analista: string; accion: string; fecha_hora: string }[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState(''); // Estado para el HTML
  const [saving, setSaving] = useState(false);

  // ── Expandir ventana de registros según mes seleccionado ─────────────────
  useEffect(() => {
    const nowMonth = now.getMonth() + 1;
    const nowYear = now.getFullYear();
    const monthsBack = (nowYear - selectedAnio) * 12 + (nowMonth - selectedMes) + 2;
    setRegistrosWindowMonths(Math.max(6, monthsBack));
  }, [selectedMes, selectedAnio, setRegistrosWindowMonths]);

  // ── Fetch al cambiar mes/año ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);

    const pad = (n: number) => String(n).padStart(2, '0');
    const mesStr = pad(selectedMes);
    const startTs = `${selectedAnio}-${mesStr}-01T00:00:00`;
    const endTs = `${selectedAnio}-${mesStr}-31T23:59:59`;

    Promise.all([
      supabase
        .from('resumen_mensual')
        .select('*')
        .eq('anio', selectedAnio)
        .eq('mes', selectedMes)
        .maybeSingle(),
      supabase
        .from('auditoria')
        .select('analista, accion, fecha_hora')
        .gte('fecha_hora', startTs)
        .lte('fecha_hora', endTs),
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
          } catch (e) { }
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

  // ── Generar Link público para compartir el reporte ──────────────────────
  const handleGenerarLink = async () => {
    try {
      const root = document.getElementById('resumen-reporte-body');
      if (!root) { alert('ERROR: No se encontró el contenido del reporte.'); return; }

      // 1. Esperar render de gráficos
      await new Promise(r => setTimeout(r, 300));

      // 2. Capturar canvas como imágenes
      const canvasImages = new Map<HTMLCanvasElement, string>();
      root.querySelectorAll('canvas').forEach(canvas => {
        try { canvasImages.set(canvas as HTMLCanvasElement, (canvas as HTMLCanvasElement).toDataURL('image/png')); } catch { /* ignorar */ }
      });

      // 3. Clonar
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
        .replace(/var\(--gris\)/g, '#666')
        .replace(/var\(--rojo\)/g, '#f87171');

      // 8. Guardar snapshot en columna existente (Preservando el texto del usuario)
      const snapshotHtml = clone.innerHTML;
      const { error: saveError } = await supabase
        .from('resumen_mensual')
        .update({
          experiencia_cliente: JSON.stringify({
            text: resumen.experiencia_cliente, // Guardamos el texto actual
            html: snapshotHtml // Guardamos el nuevo diseño visual
          })
        })
        .eq('anio', selectedAnio)
        .eq('mes', selectedMes);

      if (saveError) {
        alert(`ERROR al guardar snapshot: ${saveError.message}`);
        return;
      }

      const baseUrl = window.location.origin;
      const publicUrl = `${baseUrl}/publico/resumen-mensual?anio=${selectedAnio}&mes=${selectedMes}`;

      // 9. Copiar link
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
      alert('✅ Link copiado al portapapeles:\n' + publicUrl);
      onSuccess('Link público generado y copiado');
    } catch (err: any) {
      alert('ERROR inesperado: ' + (err?.message || err));
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    setSaving(true);
    // Enriquecer con KPIs calculadas antes de guardar
    const gestionesMap: Record<string, number> = {};
    const presupuestosMap: Record<string, number> = {};
    kpiPorAnalista.forEach(k => {
      gestionesMap[k.analista] = k.clientesIngresados;
      presupuestosMap[k.analista] = k.ops;
    });
    const payload = {
      anio: selectedAnio,
      mes: selectedMes,
      ...resumen,
      // Guardamos como JSON para no perder el snapshot si existe
      experiencia_cliente: JSON.stringify({
        text: resumen.experiencia_cliente,
        html: lastSnapshot // Mantenemos el HTML previo cargado en el useEffect
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

  // ── PDF ───────────────────────────────────────────────────────────────────
  const handleDescargarPDF = async () => {
    const root = document.getElementById('resumen-reporte-body');
    if (!root) { onError('No se encontró el contenido del reporte.'); return; }

    // 1. Esperar render de gráficos
    await new Promise(r => setTimeout(r, 300));

    // 2. Capturar todos los canvas ANTES de clonar
    const canvasImages = new Map<HTMLCanvasElement, string>();
    root.querySelectorAll('canvas').forEach(canvas => {
      try { canvasImages.set(canvas as HTMLCanvasElement, (canvas as HTMLCanvasElement).toDataURL('image/png')); } catch { /* ignorar */ }
    });

    // 3. Clonar el DOM real del reporte
    const clone = root.cloneNode(true) as HTMLElement;

    // 4. Reemplazar cada canvas clonado con su imagen capturada
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

    // 5. Reemplazar textareas por divs con el valor actual
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

    // 6. Reemplazar inputs con su valor como texto; ocultar botones
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

    // 7. Resolver CSS vars residuales + fix grids para print
    clone.innerHTML = clone.innerHTML
      .replace(/var\(--gris\)/g, '#666')
      .replace(/var\(--rojo\)/g, '#f87171')
      .replace(/repeat\(auto-fit,\s*minmax\(\d+px,\s*1fr\)\)/g, 'repeat(2, 1fr)');

    // 8. Agregar break-inside: avoid a cada data-card y tarjeta interna
    clone.querySelectorAll('.data-card').forEach(el => {
      (el as HTMLElement).style.breakInside = 'avoid';
      (el as HTMLElement).style.pageBreakInside = 'avoid';
    });

    const mesNombre = CONFIG.MESES_NOMBRES[selectedMes - 1];
    const titulo = `Resumen ${mesNombre} ${selectedAnio}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background: #0a0a0a; color: #ccc; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }
    body { padding: 32px 40px; }
    @page { margin: 10mm 12mm; size: A4 landscape; background: #0a0a0a; }
    @media print { body { padding: 0; background: #0a0a0a; } }
    /* Ocultar scrollbars, transiciones y cursores interactivos */
    * { scrollbar-width: none; transition: none !important; animation: none !important; cursor: default !important; }
    /* Clases del proyecto */
    .data-card { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; padding: 24px; margin-bottom: 0; break-inside: avoid; page-break-inside: avoid; }
    .data-table { width: 100%; border-collapse: collapse; text-align: left; }
    /* Ocultar el spinner y elementos no imprimibles */
    .spinner, [class*="no-print"] { display: none !important; }
    /* Inputs/botones residuales ocultos */
    input, button { display: none !important; }
    /* ── Print grid fix: auto-fit no funciona en print, forzar columnas fijas ── */
    [style*="grid-template-columns"] { display: grid !important; }
    [style*="repeat(auto-fit"] { grid-template-columns: repeat(2, 1fr) !important; }
    /* Evitar corte dentro de tarjetas y gráficos */
    [style*="border-radius: 10px"], [style*="border-radius: 12px"], [style*="borderRadius"] { break-inside: avoid; page-break-inside: avoid; }
    img { max-width: 100%; height: auto !important; }
    /* Forzar que cada sección principal empiece en nueva página excepto la primera */
    .data-card + .data-card { page-break-before: auto; }
    /* Flex containers: no shrink */
    [style*="display: flex"] { flex-shrink: 0; }
  </style>
</head>
<body>
  <!-- PORTADA -->
  <div style="margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.15)">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#555;margin-bottom:6px">Informe de Gestión Comercial</div>
    <h1 style="font-size:28px;font-weight:900;color:#fff;margin:0">${titulo}</h1>
  </div>

  ${clone.innerHTML}

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { onError('El navegador bloqueó la ventana emergente. Permitila para descargar el PDF.'); return; }
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  // ── Helpers de cálculo ────────────────────────────────────────────────────
  const filterByMonth = (regs: Registro[], mes: number, anio: number) => {
    const key = `${anio}-${String(mes).padStart(2, '0')}`;
    return regs.filter(r => r.fecha?.slice(0, 7) === key);
  };

  const isVenta = (r: Registro) => {
    const e = (r.estado ?? '').toLowerCase();
    return e === 'venta' || e.includes('aprobado cc');
  };

  const cumplColor = (pct: number | null) =>
    pct === null ? '#555' : pct >= 100 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#f87171';

  const tendBadge = (pct: number | null) => {
    if (pct === null) return <span style={{ color: '#333' }}>—</span>;
    const color = pct >= 0 ? '#34d399' : '#f87171';
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, padding: '2px 6px', borderRadius: 4 }}>
        {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  const sectionHeader = (title: string, icon: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{title}</span>
    </div>
  );

  const mesPrev = selectedMes === 1 ? 12 : selectedMes - 1;
  const anioPrev = selectedMes === 1 ? selectedAnio - 1 : selectedAnio;

  // ── KPI por analista ──────────────────────────────────────────────────────
  const kpiPorAnalista = useMemo(() => {
    return CONFIG.ANALISTAS_DEFAULT.map(analista => {
      const regsAnalista = filterByMonth(registros, selectedMes, selectedAnio).filter(r => r.analista === analista);
      const ventas = regsAnalista.filter(isVenta);
      const capital = ventas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const ops = ventas.length;
      const ticket = ops > 0 ? capital / ops : 0;
      const conversion = regsAnalista.length > 0 ? (ops / regsAnalista.length) * 100 : 0;

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

      return { analista, capital, ops, ticket, conversion, metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps, tendCapital, tendOps, clientesIngresados: regsAnalista.length };
    });
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev]);

  // ── KPI total ─────────────────────────────────────────────────────────────
  const kpiTotal = useMemo(() => {
    const regs = filterByMonth(registros, selectedMes, selectedAnio);
    const ventas = regs.filter(isVenta);
    const capital = ventas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const ops = ventas.length;
    const ticket = ops > 0 ? capital / ops : 0;
    const clientes = regs.length;
    const conversion = clientes > 0 ? (ops / clientes) * 100 : 0;

    const ventasAnt = filterByMonth(registros, mesPrev, anioPrev).filter(isVenta);
    const capitalAnt = ventasAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const opsAnt = ventasAnt.length;
    const tendCapital = capitalAnt > 0 ? ((capital - capitalAnt) / capitalAnt) * 100 : null;
    const tendOps = opsAnt > 0 ? ((ops - opsAnt) / opsAnt) * 100 : null;

    const obj = objetivos.find(o => o.analista === 'PDV' && o.mes === selectedMes - 1 && o.anio === selectedAnio);
    const metaCapital = obj?.meta_ventas ?? 0;
    const metaOps = obj?.meta_operaciones ?? 0;
    const cumplCapital = metaCapital > 0 ? (capital / metaCapital) * 100 : null;
    const restanteCapital = metaCapital > 0 ? Math.max(0, 100 - (capital / metaCapital) * 100) : null;
    const cumplOps = metaOps > 0 ? (ops / metaOps) * 100 : null;
    const restanteOps = metaOps > 0 ? Math.max(0, 100 - (ops / metaOps) * 100) : null;

    return { capital, ops, ticket, conversion, clientes, tendCapital, tendOps, metaCapital, metaOps, cumplCapital, restanteCapital, cumplOps, restanteOps };
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev]);

  // ── Distribución acuerdo de precios ──────────────────────────────────────
  const distribucionAcuerdos = useMemo(() => {
    const tipos: Record<string, { monto: number; cantidad: number }> = {
      'Riesgo BAJO': { monto: 0, cantidad: 0 },
      'Riesgo MEDIO': { monto: 0, cantidad: 0 },
      'PREMIUM': { monto: 0, cantidad: 0 },
      'No califica': { monto: 0, cantidad: 0 },
    };
    // Mapeo para match con DB
    const matchTipo = (acuerdo: string): string | null => {
      const a = acuerdo.toLowerCase();
      if (a === 'riesgo bajo') return 'Riesgo BAJO';
      if (a === 'riesgo medio') return 'Riesgo MEDIO';
      if (a === 'premium') return 'PREMIUM';
      if (a === 'no califica') return 'No califica';
      return null;
    };
    for (const r of filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta)) {
      const matched = matchTipo(r.acuerdo_precios ?? '');
      if (matched) {
        tipos[matched].monto += Number(r.monto) || 0;
        tipos[matched].cantidad += 1;
      }
    }
    return tipos;
  }, [registros, selectedMes, selectedAnio]);

  // ── Distribuciones demográficas (ventas del mes) ─────────────────────────
  const ventasMes = useMemo(() =>
    filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta),
    [registros, selectedMes, selectedAnio]
  );

  const distPor = (campo: keyof Registro) => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of ventasMes) {
      const val = (r[campo] as string | undefined)?.trim() || 'Sin dato';
      const prev = map.get(val) ?? { monto: 0, cantidad: 0 };
      map.set(val, { monto: prev.monto + (Number(r.monto) || 0), cantidad: prev.cantidad + 1 });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([label, data]) => ({ label, ...data }));
  };

  // ── Normalización de empleador para agrupar duplicados ────────────────────
  const normalizarEmpleador = (nombre: string): string => {
    if (!nombre) return 'Sin dato';
    let n = nombre.toUpperCase().trim();
    // Quitar acentos
    n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Quitar sufijos legales comunes
    n = n.replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?|E\.?I\.?R\.?L\.?)\.?\b/gi, '').trim();
    // Quitar palabras vacías al final
    n = n.replace(/\b(EL|LA|LOS|LAS|DE|DEL|Y|E)\b\s*$/gi, '').trim();
    // Quitar múltiples espacios
    n = n.replace(/\s+/g, ' ').trim();
    return n || 'Sin dato';
  };

  const distEmpleador = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number; variantes: Map<string, number>; displayLabel: string }>();
    for (const r of ventasMes) {
      const raw = (r.empleador ?? '').trim();
      const key = normalizarEmpleador(raw);
      const prev = map.get(key) ?? { monto: 0, cantidad: 0, variantes: new Map<string, number>(), displayLabel: raw };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      if (raw) {
        prev.variantes.set(raw, (prev.variantes.get(raw) || 0) + 1);
        // Usar la variante más común como displayLabel
        let maxCount = 0;
        let maxVariant = raw;
        for (const [v, c] of prev.variantes) {
          if (c > maxCount) { maxCount = c; maxVariant = v; }
        }
        prev.displayLabel = maxVariant;
      }
      map.set(key, prev);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([_, data]) => ({ label: data.displayLabel, monto: data.monto, cantidad: data.cantidad }));
  }, [ventasMes]);

  const distCuotas = useMemo(() => distPor('cuotas'), [ventasMes]);
  const distRangoEtario = useMemo(() => distPor('rango_etario'), [ventasMes]);
  const distSexo = useMemo(() => distPor('sexo'), [ventasMes]);
  const distLocalidad = useMemo(() => distPor('localidad'), [ventasMes]);

  // ── Distribuciones mes anterior ───────────────────────────────────────────
  const ventasMesAnt = useMemo(() =>
    filterByMonth(registros, mesPrev, anioPrev).filter(isVenta),
    [registros, mesPrev, anioPrev]
  );

  const distPorAnt = (campo: keyof Registro, fuente: typeof ventasMesAnt) => {
    const map = new Map<string, { monto: number; cantidad: number }>();
    for (const r of fuente) {
      const val = (r[campo] as string | undefined)?.trim() || 'Sin dato';
      const prev = map.get(val) ?? { monto: 0, cantidad: 0 };
      map.set(val, { monto: prev.monto + (Number(r.monto) || 0), cantidad: prev.cantidad + 1 });
    }
    return map;
  };

  const distCuotasAnt = useMemo(() => distPorAnt('cuotas', ventasMesAnt), [ventasMesAnt]);
  const distRangoAnt = useMemo(() => distPorAnt('rango_etario', ventasMesAnt), [ventasMesAnt]);
  const distSexoAnt = useMemo(() => distPorAnt('sexo', ventasMesAnt), [ventasMesAnt]);
  const distEmpleadorAnt = useMemo(() => {
    const map = new Map<string, { monto: number; cantidad: number; variantes: Map<string, number>; displayLabel: string }>();
    for (const r of ventasMesAnt) {
      const raw = (r.empleador ?? '').trim();
      const key = normalizarEmpleador(raw);
      const prev = map.get(key) ?? { monto: 0, cantidad: 0, variantes: new Map<string, number>(), displayLabel: raw };
      prev.monto += Number(r.monto) || 0;
      prev.cantidad += 1;
      if (raw) {
        prev.variantes.set(raw, (prev.variantes.get(raw) || 0) + 1);
        let maxCount = 0;
        let maxVariant = raw;
        for (const [v, c] of prev.variantes) {
          if (c > maxCount) { maxCount = c; maxVariant = v; }
        }
        prev.displayLabel = maxVariant;
      }
      map.set(key, prev);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .map(([_, data]) => ({ label: data.displayLabel, monto: data.monto, cantidad: data.cantidad }));
  }, [ventasMesAnt]);
  const distLocalidadAnt = useMemo(() => distPorAnt('localidad', ventasMesAnt), [ventasMesAnt]);
  const distAcuerdosAnt = useMemo(() => distPorAnt('acuerdo_precios', ventasMesAnt), [ventasMesAnt]);

  // ── Config base de gráficos (dark theme) ─────────────────────────────────
  const mesActualLabel = CONFIG.MESES_NOMBRES[selectedMes - 1].slice(0, 3);
  const mesAntLabel = CONFIG.MESES_NOMBRES[mesPrev - 1].slice(0, 3);

  const baseChartOpts = (yLabel = '', horizontal = false, showLabels = false, showLegend = false, stacked = false): any => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' as const : 'x' as const,
    layout: { padding: { top: showLabels ? 50 : 20, bottom: 5 } },
    _isPct: yLabel.includes('%'), // Flag explícito para el plugin
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
        align: 'end' as const,
        labels: { color: '#666', font: { size: 10 }, usePointStyle: true, padding: 10 }
      },
      tooltip: { backgroundColor: '#111', titleColor: '#fff', bodyColor: '#aaa', borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1 },
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
        font: { size: 10, weight: 800 }
      },
    },
    categoryPercentage: 0.8,
    barPercentage: 0.7,
    scales: {
      x: {
        stacked,
        ticks: {
          color: '#555', font: { size: 10 },
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
  const refLine100 = (n: number) => ({
    type: 'line' as const,
    label: 'Meta 100%',
    data: Array(n).fill(100),
    borderColor: '#f87171',
    borderWidth: 1.5,
    borderDash: [5, 4],
    pointRadius: 0,
    fill: false,
    order: 0,
  });

  // ── Datos gráfico cumplimiento por analista ───────────────────────────────
  const chartCumplimiento = useMemo(() => {
    const labels = kpiPorAnalista.map(k => k.analista);
    return {
      labels,
      datasets: [
        {
          label: `Capital ${mesActualLabel}`,
          data: kpiPorAnalista.map(k => k.cumplCapital ?? 0),
          backgroundColor: 'rgba(96,165,250,0.7)', borderRadius: 4, order: 1,
        },
        {
          label: `Capital ${mesAntLabel}`,
          data: kpiPorAnalista.map(k => {
            const ant = filterByMonth(registros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
            const capitalAnt = ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
            const objAnt = objetivos.find(o => o.analista === k.analista && o.mes === mesPrev - 1 && o.anio === anioPrev);
            return objAnt?.meta_ventas ? (capitalAnt / objAnt.meta_ventas) * 100 : 0;
          }),
          backgroundColor: 'rgba(30, 58, 138, 0.9)', borderRadius: 4, order: 1,
        },
        {
          label: `Ops ${mesActualLabel}`,
          data: kpiPorAnalista.map(k => k.cumplOps ?? 0),
          backgroundColor: 'rgba(167,139,250,0.7)', borderRadius: 4, order: 1,
        },
        {
          label: `Ops ${mesAntLabel}`,
          data: kpiPorAnalista.map(k => {
            const ant = filterByMonth(registros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
            const opsAnt = ant.length;
            const objAnt = objetivos.find(o => o.analista === k.analista && o.mes === mesPrev - 1 && o.anio === anioPrev);
            return objAnt?.meta_operaciones ? (opsAnt / objAnt.meta_operaciones) * 100 : 0;
          }),
          backgroundColor: 'rgba(76, 29, 149, 0.9)', borderRadius: 4, order: 1, // Purpura oscuro
        },
        refLine100(labels.length),
      ],
    };
  }, [kpiPorAnalista, registros, objetivos, mesPrev, anioPrev, mesActualLabel, mesAntLabel]);

  // ── Datos gráfico acuerdo de precios ──────────────────────────────────────
  const chartAcuerdos = useMemo(() => {
    const tiposDisplay = ['Riesgo BAJO', 'Riesgo MEDIO', 'PREMIUM', 'No califica'];
    const analistas = CONFIG.ANALISTAS_DEFAULT;
    const colores = ['#60a5fa', '#a78bfa'];

    const matchAcuerdo = (acuerdo: string): string | null => {
      const a = acuerdo.toLowerCase();
      if (a === 'riesgo bajo') return 'Riesgo BAJO';
      if (a === 'riesgo medio') return 'Riesgo MEDIO';
      if (a === 'premium') return 'PREMIUM';
      if (a === 'no califica') return 'No califica';
      return null;
    };

    // DEBUG: Log acuerdo_precios values and match results
    const monthData = filterByMonth(registros, selectedMes, selectedAnio);
    const uniqueValues = [...new Set(monthData.map(r => r.acuerdo_precios ?? ''))];
    const valueCounts: Record<string, number> = {};
    const matchResults: Record<string, string | null> = {};
    uniqueValues.forEach(v => {
      valueCounts[v] = monthData.filter(r => (r.acuerdo_precios ?? '') === v).length;
      matchResults[v] = matchAcuerdo(v);
    });

    // Debug: breakdown by analyst for "No califica"
    const noCalificaRecords = monthData.filter(r => matchAcuerdo(r.acuerdo_precios ?? '') === 'No califica');
    const noCalificaByAnalyst = CONFIG.ANALISTAS_DEFAULT.map(an => ({
      analyst: an,
      total: noCalificaRecords.filter(r => r.analista === an).length,
    }));

    console.log('DEBUG chartAcuerdos - acuerdo_precios values:', {
      uniqueValues,
      valueCounts,
      matchResults,
      totalRecords: monthData.length,
      noCalificaDetail: {
        total: noCalificaRecords.length,
        byAnalyst: noCalificaByAnalyst,
        estados: [...new Set(noCalificaRecords.map(r => r.estado))],
      },
    });

    return {
      labels: tiposDisplay,
      datasets: analistas.map((an, idx) => ({
        label: an,
        data: tiposDisplay.map(t => {
          return filterByMonth(registros, selectedMes, selectedAnio).filter(r =>
            r.analista === an && matchAcuerdo(r.acuerdo_precios ?? '') === t
          ).length;
        }),
        backgroundColor: colores[idx] || '#555',
        borderRadius: 4,
        maxBarThickness: 70,
      }))
    };
  }, [registros, selectedMes, selectedAnio, filterByMonth, isVenta]);

  // ── Helper gráfico horizontal por categoría ───────────────────────────────
  const buildCatChart = (
    actual: { label: string; cantidad: number }[],
    anterior: Map<string, { cantidad: number }>,
    color: string,
    limit = 8
  ) => {
    const top = actual.slice(0, limit);
    return {
      labels: top.map(d => d.label),
      datasets: [
        {
          label: mesActualLabel,
          data: top.map(d => d.cantidad),
          backgroundColor: color,
          borderRadius: 4, order: 1,
        },
        {
          label: mesAntLabel,
          data: top.map(d => anterior.get(d.label)?.cantidad ?? 0),
          backgroundColor: `${color}44`,
          borderRadius: 4, order: 1,
        },
      ],
    };
  };

  const chartSexo = useMemo(() => buildCatChart(distSexo, distSexoAnt, '#f472b6'), [distSexo, distSexoAnt, mesActualLabel, mesAntLabel]);

  // ── Ranking analistas ─────────────────────────────────────────────────────
  const rankingAnalistas = useMemo(() =>
    [...kpiPorAnalista].sort((a, b) => b.capital - a.capital),
    [kpiPorAnalista]
  );

  // ── Chart 1: Capital vs Objetivo ──────────────────────────────────────────
  const chartCapitalVsObjetivo = useMemo(() => {
    const labels = [...CONFIG.ANALISTAS_DEFAULT, 'Total PDV'];
    const capitalAct = [...kpiPorAnalista.map(k => k.capital), kpiTotal.capital];
    const capitalAnt = [
      ...kpiPorAnalista.map(k => {
        const ant = filterByMonth(registros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
        return ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      }),
      ventasMesAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0),
    ];
    const objetivo = [...kpiPorAnalista.map(k => k.metaCapital || 0), kpiTotal.metaCapital || 0];
    return {
      labels,
      datasets: [
        { label: `Capital ${mesActualLabel}`, data: capitalAct, backgroundColor: 'rgba(96,165,250,0.8)', borderRadius: 4, order: 1, maxBarThickness: 70 },
        { label: `Capital ${mesAntLabel}`, data: capitalAnt, backgroundColor: 'rgba(30, 58, 138, 0.9)', borderRadius: 4, order: 1, maxBarThickness: 70 },
        { type: 'line' as const, label: 'Objetivo', data: objetivo, borderColor: '#f87171', borderWidth: 2, borderDash: [5, 4], pointRadius: 4, pointBackgroundColor: '#f87171', fill: false, order: 0 },
      ],
    };
  }, [kpiPorAnalista, kpiTotal, registros, mesPrev, anioPrev, ventasMesAnt, mesActualLabel, mesAntLabel]);

  // ── Chart 2: Ticket Promedio ──────────────────────────────────────────────
  const chartTicketPromedio = useMemo(() => {
    const labels = [...CONFIG.ANALISTAS_DEFAULT, 'Total PDV'];
    const ticketAnt = [
      ...kpiPorAnalista.map(k => {
        const ant = filterByMonth(registros, mesPrev, anioPrev).filter(r => r.analista === k.analista).filter(isVenta);
        const cap = ant.reduce((s, r) => s + (Number(r.monto) || 0), 0);
        return ant.length > 0 ? cap / ant.length : 0;
      }),
      ventasMesAnt.length > 0 ? ventasMesAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0) / ventasMesAnt.length : 0,
    ];
    return {
      labels,
      datasets: [
        { label: `Ticket ${mesActualLabel}`, data: [...kpiPorAnalista.map(k => k.ticket), kpiTotal.ticket], backgroundColor: 'rgba(52,211,153,0.8)', borderRadius: 4, maxBarThickness: 70 },
        { label: `Ticket ${mesAntLabel}`, data: ticketAnt, backgroundColor: 'rgba(6, 78, 59, 0.9)', borderRadius: 4, maxBarThickness: 70 },
      ],
    };
  }, [kpiPorAnalista, kpiTotal, registros, mesPrev, anioPrev, ventasMesAnt, mesActualLabel, mesAntLabel]);

  // ── Chart 4: Variación % vs mes anterior ─────────────────────────────────
  const chartVariacion = useMemo(() => {
    const labels = [...CONFIG.ANALISTAS_DEFAULT, 'Total PDV'];
    const capitalVar = [...kpiPorAnalista.map(k => k.tendCapital ?? 0), kpiTotal.tendCapital ?? 0];
    const opsVar = [...kpiPorAnalista.map(k => k.tendOps ?? 0), kpiTotal.tendOps ?? 0];
    return {
      labels,
      datasets: [
        { label: 'Variación Capital %', data: capitalVar, backgroundColor: capitalVar.map(v => v >= 0 ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.7)'), borderRadius: 4, maxBarThickness: 70 },
        { label: 'Variación Ops %', data: opsVar, backgroundColor: opsVar.map(v => v >= 0 ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.7)'), borderRadius: 4, maxBarThickness: 70 },
      ],
    };
  }, [kpiPorAnalista, kpiTotal]);

  // ── Chart 7: Aperturas vs Renovaciones ───────────────────────────────────
  const apertVsRenData = useMemo(() => {
    const allVentas = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);
    const allAnt = ventasMesAnt;
    return {
      porAnalista: CONFIG.ANALISTAS_DEFAULT.map(analista => {
        const v = allVentas.filter(r => r.analista === analista);
        return { analista, aperturas: v.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: v.filter(r => r.tipo_cliente === 'Renovacion').length };
      }),
      porAnalistaAnt: CONFIG.ANALISTAS_DEFAULT.map(analista => {
        const v = allAnt.filter(r => r.analista === analista);
        return { analista, aperturas: v.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: v.filter(r => r.tipo_cliente === 'Renovacion').length };
      }),
      total: { aperturas: allVentas.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: allVentas.filter(r => r.tipo_cliente === 'Renovacion').length },
      ant: { aperturas: allAnt.filter(r => r.tipo_cliente === 'Apertura').length, renovaciones: allAnt.filter(r => r.tipo_cliente === 'Renovacion').length },
    };
  }, [registros, selectedMes, selectedAnio, ventasMesAnt]);

  const chartAperturas = useMemo(() => {
    const labels = [...CONFIG.ANALISTAS_DEFAULT, 'Total PDV'];
    return {
      labels,
      datasets: [
        { label: `Actual`, data: [...apertVsRenData.porAnalista.map(d => d.aperturas), apertVsRenData.total.aperturas], backgroundColor: '#60a5fa', borderRadius: 4, maxBarThickness: 50 },
        { label: `Anterior`, data: [...apertVsRenData.porAnalistaAnt.map(d => d.aperturas), apertVsRenData.ant.aperturas], backgroundColor: 'rgba(30, 58, 138, 0.9)', borderRadius: 4, maxBarThickness: 50 },
      ],
    };
  }, [apertVsRenData, mesActualLabel, mesAntLabel]);

  const chartRenovaciones = useMemo(() => {
    const labels = [...CONFIG.ANALISTAS_DEFAULT, 'Total PDV'];
    return {
      labels,
      datasets: [
        { label: `Actual`, data: [...apertVsRenData.porAnalista.map(d => d.renovaciones), apertVsRenData.total.renovaciones], backgroundColor: '#a78bfa', borderRadius: 4, maxBarThickness: 50 },
        { label: `Anterior`, data: [...apertVsRenData.porAnalistaAnt.map(d => d.renovaciones), apertVsRenData.ant.renovaciones], backgroundColor: 'rgba(76, 29, 149, 0.9)', borderRadius: 4, maxBarThickness: 50 },
      ],
    };
  }, [apertVsRenData, mesActualLabel, mesAntLabel]);

  // ── Chart 8: % Empleo Público / Privado ──────────────────────────────────
  const empleoPublPrivData = useMemo(() => {
    const PUBLICO = ['municipio', 'municip', 'provincia', 'hospital', 'escuela', 'público', 'gobierno', 'estado', 'policia', 'policía', 'nación', 'nacional', 'ministerio', 'judicial', 'fuerzas'];
    const ventas = filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta);
    const ant = ventasMesAnt;
    const classify = (r: typeof ventas[0]) => {
      const e = (r.empleador ?? '').toLowerCase();
      return PUBLICO.some(k => e.includes(k)) ? 'Público' : e.trim() === '' || e === 'sin dato' ? 'Sin dato' : 'Privado';
    };
    const counts: Record<string, number> = { 'Público': 0, 'Privado': 0, 'Sin dato': 0 };
    const countsAnt: Record<string, number> = { 'Público': 0, 'Privado': 0, 'Sin dato': 0 };
    ventas.forEach(r => counts[classify(r)]++);
    ant.forEach(r => countsAnt[classify(r)]++);
    return { counts, countsAnt };
  }, [registros, selectedMes, selectedAnio, ventasMesAnt]);

  const chartEmpleoPublPriv = useMemo(() => {
    const { counts } = empleoPublPrivData;
    const labels = ['Público', 'Privado', 'Sin dato'];
    const colors = ['rgba(52,211,153,0.8)', 'rgba(96,165,250,0.8)', 'rgba(100,100,100,0.5)'];
    const filtered = labels.filter(l => (counts[l] ?? 0) > 0);
    return {
      labels: filtered,
      datasets: [{
        label: 'Operaciones',
        data: filtered.map(l => counts[l] ?? 0),
        backgroundColor: labels.map(c => colors[labels.indexOf(c)]),
        borderRadius: 4,
      }],
    };
  }, [empleoPublPrivData]);

  // ── Chart 10: % Total Conversión ─────────────────────────────────────────
  const chartConversionTotal = useMemo(() => {
    const labels = [...CONFIG.ANALISTAS_DEFAULT, 'Total PDV'];
    const actual = [...kpiPorAnalista.map(k => k.conversion), kpiTotal.conversion];
    const anterior = [
      ...kpiPorAnalista.map(k => {
        const regsAnt = filterByMonth(registros, mesPrev, anioPrev).filter(r => r.analista === k.analista);
        const ventasAnt = regsAnt.filter(isVenta);
        return regsAnt.length > 0 ? (ventasAnt.length / regsAnt.length) * 100 : 0;
      }),
      (() => {
        const regsAnt = filterByMonth(registros, mesPrev, anioPrev);
        const ventasAnt = regsAnt.filter(isVenta);
        return regsAnt.length > 0 ? (ventasAnt.length / regsAnt.length) * 100 : 0;
      })(),
    ];
    return {
      labels,
      datasets: [
        { label: `Conversión % ${mesActualLabel}`, data: actual, backgroundColor: 'rgba(251,191,36,0.8)', borderRadius: 4, order: 1 },
        { label: `Conversión % ${mesAntLabel}`, data: anterior, backgroundColor: 'rgba(124, 45, 18, 0.8)', borderRadius: 4, order: 1 },
        refLine100(labels.length),
      ],
    };
  }, [kpiPorAnalista, kpiTotal, registros, mesPrev, anioPrev, mesActualLabel, mesAntLabel]);

  // ── Chart 5: Embudo Comercial ─────────────────────────────────────────────
  const chartEmbudo = useMemo(() => {
    const labels = CONFIG.ANALISTAS_DEFAULT;
    const regsMes = filterByMonth(registros, selectedMes, selectedAnio);

    // Todos los estados que cuentan como "clientes ingresados"
    const matchIngresado = (estado: string) => {
      const e = estado.toLowerCase();
      return ['proyeccion', 'score bajo', 'en seguimiento', 'no califica', 'afectaciones', 'aprobado cc', 'rechazado cc', 'venta'].some(est => e.includes(est));
    };

    const ingresados = labels.map(a => {
      const regsAnalista = regsMes.filter(r => r.analista === a);
      return regsAnalista.filter(r => matchIngresado(r.estado)).length;
    });
    const cerradas = labels.map(a => {
      const regsAnalista = regsMes.filter(r => r.analista === a);
      return regsAnalista.filter(isVenta).length;
    });
    const conversion = labels.map((a, i) => {
      return ingresados[i] > 0 ? `${((cerradas[i] / ingresados[i]) * 100).toFixed(1)}%` : '0%';
    });
    const chartLabels = labels.map((l, i) => `${l} (${conversion[i]})`);

    return {
      labels: chartLabels,
      datasets: [
        {
          label: 'Clientes Ingresados', data: ingresados, backgroundColor: 'rgba(96,165,250,0.8)', borderRadius: 4
        },
        {
          label: 'Op. Cerradas', data: cerradas, backgroundColor: 'rgba(167,139,250,0.8)', borderRadius: 4
        },
      ],
    };
  }, [registros, selectedMes, selectedAnio]);

  // ── Chart 6: % Conversión de Presupuesto ─────────────────────────────────
  const chartConversionPresupuesto = useMemo(() => {
    const labels = CONFIG.ANALISTAS_DEFAULT;
    const data = labels.map((a, i) => {
      const pres = resumen.presupuestos_por_analista[a] ?? 0;
      const ops = kpiPorAnalista[i]?.ops ?? 0;
      return pres > 0 ? (ops / pres) * 100 : 0;
    });
    return {
      labels,
      datasets: [
        { label: '% Conv. Presupuesto → Venta', data, backgroundColor: 'rgba(52,211,153,0.7)', borderRadius: 4, order: 1 },
        refLine100(labels.length),
      ],
    };
  }, [resumen.presupuestos_por_analista, kpiPorAnalista]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Selector mes/año */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px', display: 'flex', flexWrap: 'wrap' }}>
          {CONFIG.MESES_NOMBRES.map((nombre, i) => (
            <button key={i} onClick={() => setSelectedMes(i + 1)} style={{
              padding: '6px 14px', borderRadius: '5px', border: 'none',
              background: selectedMes === i + 1 ? '#fff' : 'transparent',
              color: selectedMes === i + 1 ? '#000' : '#555',
              fontFamily: "'Outfit', sans-serif", fontSize: '12px',
              fontWeight: selectedMes === i + 1 ? 700 : 500, cursor: 'pointer',
            }}>{nombre.slice(0, 3)}</button>
          ))}
        </div>
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px', display: 'flex' }}>
          {[now.getFullYear() - 1, now.getFullYear()].map(y => (
            <button key={y} onClick={() => setSelectedAnio(y)} style={{
              padding: '6px 14px', borderRadius: '5px', border: 'none',
              background: selectedAnio === y ? '#fff' : 'transparent',
              color: selectedAnio === y ? '#000' : '#555',
              fontFamily: "'Outfit', sans-serif", fontSize: '12px',
              fontWeight: selectedAnio === y ? 700 : 500, cursor: 'pointer',
            }}>{y}</button>
          ))}
        </div>
      </div>

      {loadingData ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px', gap: 12 }}>
          <div className="spinner" style={{ width: 24, height: 24 }} />
          <span style={{ color: '#555', fontSize: 13 }}>Cargando resumen...</span>
        </div>
      ) : (
        <div id="resumen-reporte-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ── SECCIÓN 1: TABLERO ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('1. Tablero', <BarChart3 size={15} color="#60a5fa" />)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Capital Vendido</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.capital)}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Meta: {kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}</div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {kpiTotal.cumplCapital !== null && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: cumplColor(kpiTotal.cumplCapital) }}>
                      {kpiTotal.cumplCapital.toFixed(1)}% cumpl.
                    </span>
                  )}
                  {tendBadge(kpiTotal.tendCapital)}
                </div>
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Capital vs Objetivo</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(96,165,250,0.8)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                      </div>
                    </div>
                  </div>
                  <div id="chart-capital-objetivo" style={{ height: 180 }}>
                    <Bar data={chartCapitalVsObjetivo as any} options={baseChartOpts('$', false, true, false)} plugins={[labelsPlugin]} />
                  </div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Operaciones</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{kpiTotal.ops}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Meta: {kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}</div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {kpiTotal.cumplOps !== null && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: cumplColor(kpiTotal.cumplOps) }}>
                      {kpiTotal.cumplOps.toFixed(1)}% cumpl.
                    </span>
                  )}
                  {tendBadge(kpiTotal.tendOps)}
                </div>
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Aperturas vs Renovaciones</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#60a5fa', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' }}>Aperturas</div>
                      <div id="chart-aperturas" style={{ height: 140, position: 'relative', width: '100%' }}>
                        <Bar data={chartAperturas} options={baseChartOpts(' ops', false, true, false, false)} plugins={[labelsPlugin]} />
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' }}>Renov.</div>
                      <div id="chart-renovaciones" style={{ height: 140, position: 'relative', width: '100%' }}>
                        <Bar data={chartRenovaciones} options={baseChartOpts(' ops', false, true, false, false)} plugins={[labelsPlugin]} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Ticket Promedio</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.ticket)}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Conversión: {kpiTotal.conversion.toFixed(1)}%</div>
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{kpiTotal.clientes} clientes ingresados</div>
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Análisis vs {mesAntLabel}</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(52,211,153,0.8)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(6, 78, 59, 0.9)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                      </div>
                    </div>
                  </div>
                  <div id="chart-ticket-promedio" style={{ height: 180 }}>
                    <Bar data={chartTicketPromedio as any} options={baseChartOpts('$', false, true, false)} plugins={[labelsPlugin]} />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── SECCIÓN 2: INDICADORES CLAVE ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('2. Indicadores por Analista', <Users size={15} color="#a78bfa" />)}

            {/* Tarjetas por analista */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[...kpiPorAnalista, {
                analista: 'Total PDV',
                capital: kpiTotal.capital, ops: kpiTotal.ops, ticket: kpiTotal.ticket,
                conversion: kpiTotal.conversion, clientesIngresados: kpiTotal.clientes,
                cumplCapital: kpiTotal.cumplCapital, restanteCapital: kpiTotal.restanteCapital, cumplOps: kpiTotal.cumplOps, restanteOps: kpiTotal.restanteOps,
                tendCapital: kpiTotal.tendCapital, tendOps: kpiTotal.tendOps,
                metaCapital: kpiTotal.metaCapital, metaOps: kpiTotal.metaOps,
              }].map((k, idx) => {
                const isTotal = idx === kpiPorAnalista.length;
                return (
                  <div key={k.analista} style={{ background: isTotal ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.02)', borderRadius: 12, border: `1px solid ${isTotal ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)'}`, overflow: 'hidden' }}>
                    {/* Header de la tarjeta */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: isTotal ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Users size={13} color={isTotal ? '#a78bfa' : '#666'} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: isTotal ? '#a78bfa' : '#ccc' }}>{k.analista}</span>
                      </div>
                      {tendBadge(k.tendCapital)}
                    </div>
                    {/* Métricas */}
                    <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Capital</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{formatCurrency(k.capital)}</div>
                        {k.restanteCapital !== null && k.restanteCapital > 0 ? (
                          <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#f87171', whiteSpace: 'nowrap' as const }}>Falta {k.restanteCapital.toFixed(0)}%</span>
                          </div>
                        ) : k.cumplCapital !== null && (
                          <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(k.cumplCapital, 100)}%`, background: cumplColor(k.cumplCapital), borderRadius: 2, transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: cumplColor(k.cumplCapital), whiteSpace: 'nowrap' as const }}>{k.cumplCapital.toFixed(0)}%</span>
                          </div>
                        )}
                        {k.metaCapital > 0 && <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>Meta {formatCurrency(k.metaCapital)}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Operaciones</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{k.ops}</div>
                        {k.restanteOps !== null && k.restanteOps > 0 ? (
                          <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#f87171', whiteSpace: 'nowrap' as const }}>Falta {k.restanteOps.toFixed(0)}%</span>
                          </div>
                        ) : k.cumplOps !== null && (
                          <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(k.cumplOps, 100)}%`, background: cumplColor(k.cumplOps), borderRadius: 2, transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: cumplColor(k.cumplOps), whiteSpace: 'nowrap' as const }}>{k.cumplOps.toFixed(0)}%</span>
                          </div>
                        )}
                        {k.metaOps > 0 && <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>Meta {k.metaOps}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Ticket Prom.</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#888' }}>{formatCurrency(k.ticket)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 }}>Conversión</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#888' }}>{k.conversion.toFixed(1)}% <span style={{ fontSize: 10, color: '#444' }}>({k.clientesIngresados} ing.)</span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── GRÁFICOS PRINCIPALES ── */}
            <div style={{ marginBottom: 28 }}>
              {/* Fila 1: Eliminada y movidos a KPIs */}

              {/* Fila 2: % Cumplimiento + Variación % + Embudo Comercial */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>% Cumplimiento — Actual vs {mesAntLabel}</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(96,165,250,0.8)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.9)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                      </div>
                    </div>
                  </div>
                  <div id="chart-cumplimiento" style={{ height: 280 }}>
                    <Bar data={chartCumplimiento as any} options={baseChartOpts('%', false, true, false)} plugins={[labelsPlugin]} />
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Variación % vs {mesAntLabel}</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(52,211,153,0.7)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Positivo</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(248,113,113,0.7)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Negativo</span>
                      </div>
                    </div>
                  </div>
                  <div id="chart-variacion" style={{ height: 280 }}>
                    <Bar data={chartVariacion} options={baseChartOpts('%', false, true, false)} plugins={[labelsPlugin]} />
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Embudo Comercial por Analista</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(52,211,153,0.8)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Atendidos</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(167,139,250,0.8)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Op. Cerradas</span>
                      </div>
                    </div>
                  </div>
                  <div id="chart-embudo" style={{ height: 280 }}>
                    <Bar data={chartEmbudo} options={baseChartOpts(' registros', false, true)} plugins={[labelsPlugin]} />
                  </div>
                </div>
              </div>
              {/* Fila 3: % Total Conversión + % Empleo Público/Privado + Resumen Acuerdos */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>% Total Conversión</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(251,191,36,0.8)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[selectedMes - 1]}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(124, 45, 18, 0.8)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>{CONFIG.MESES_NOMBRES[mesPrev - 1]}</span>
                      </div>
                    </div>
                  </div>
                  <div id="chart-conversion-total" style={{ height: 280 }}>
                    <Bar data={chartConversionTotal as any} options={baseChartOpts('%', false, true, false)} plugins={[labelsPlugin]} />
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 3, height: 12, background: '#34d399', borderRadius: 2 }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>% Empleo Público / Privado</span>
                  </div>
                  <div id="chart-empleo-publico-privado" style={{ height: 280 }}>
                    <Bar data={chartEmpleoPublPriv} options={baseChartOpts(' ops', false, true)} plugins={[labelsPlugin]} />
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Resumen de acuerdos por analista</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Luciana</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Victoria</span>
                      </div>
                    </div>
                  </div>
                  <div id="chart-acuerdos" style={{ height: 280 }}>
                    <Bar data={chartAcuerdos} options={baseChartOpts(' ops', false, true, false, false)} plugins={[labelsPlugin]} />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── SECCIÓN 3: DISTRIBUCIÓN POR ACUERDO ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('3. Distribución por Acuerdo de Precios', <PieChart size={15} color="#60a5fa" />)}
            {(() => {
              const totalOps = Object.values(distribucionAcuerdos).reduce((s, d) => s + d.cantidad, 0);
              const totalMonto = Object.values(distribucionAcuerdos).reduce((s, d) => s + d.monto, 0);
              const colores: Record<string, string> = { 'Riesgo BAJO': '#34d399', 'Riesgo MEDIO': '#fbbf24', 'PREMIUM': '#a78bfa', 'No califica': '#f97316' };
              return (
                <>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {Object.entries(distribucionAcuerdos).map(([tipo, data]) => {
                      const pctOps = totalOps > 0 ? (data.cantidad / totalOps) * 100 : 0;
                      const pctMonto = totalMonto > 0 ? (data.monto / totalMonto) * 100 : 0;
                      const color = colores[tipo] ?? '#555';

                      // Desglose por analista
                      const desglose = CONFIG.ANALISTAS_DEFAULT.map(an => ({
                        nombre: an,
                        ops: ventasMes.filter(r => {
                          const val = (r.acuerdo_precios ?? '').toLowerCase();
                          const mapVal: Record<string, string> = { 'riesgo bajo': 'Riesgo BAJO', 'riesgo medio': 'Riesgo MEDIO', 'premium': 'PREMIUM', 'no califica': 'No califica' };
                          return mapVal[val] === tipo && r.analista === an;
                        }).length
                      }));

                      return (
                        <div key={tipo} style={{ background: `${color}0d`, borderRadius: 10, padding: '14px 16px', border: `1px solid ${color}22` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{tipo}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {desglose.map((d, i) => (
                                <div key={d.nombre} style={{ fontSize: 9, fontWeight: 800, color: i === 0 ? '#60a5fa' : '#a78bfa', background: 'rgba(255,255,255,0.03)', padding: '1px 4px', borderRadius: 3 }}>
                                  {d.nombre.slice(0, 1)}: {d.ops}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 2 }}>{data.cantidad}</div>
                          <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>{formatCurrency(data.monto)}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color, background: `${color}18`, padding: '2px 7px', borderRadius: 4 }}>{pctOps.toFixed(0)}% ops</span>
                            <span style={{ fontSize: 11, color: '#444' }}>{pctMonto.toFixed(0)}% $</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>

          {/* ── SECCIÓN 4: VENTAS POR CATEGORÍA ── */}
          {ventasMes.length > 0 && (() => {
            const totalMes = ventasMes.reduce((s, r) => s + (Number(r.monto) || 0), 0);
            const DistBlock = ({ titulo, icon, datos, color, maxItems = 7 }: { titulo: string; icon: React.ReactNode; datos: { label: string; monto: number; cantidad: number }[]; color: string; maxItems?: number }) => {
              const totalCant = datos.reduce((s, d) => s + d.cantidad, 0);
              const displayData = datos.slice(0, maxItems);
              return (
                <div style={{ flex: 1, minWidth: 220, maxHeight: 320, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexShrink: 0 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>{titulo}</span>
                  </div>
                  <div style={{ background: '#0d0d0d', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', flex: 1, overflowY: 'auto' }}>
                    {displayData.map((d, i) => {
                      const pct = totalCant > 0 ? (d.cantidad / totalCant) * 100 : 0;
                      const pctMonto = totalMes > 0 ? (d.monto / totalMes) * 100 : 0;
                      return (
                        <div key={i} style={{ padding: '9px 14px', borderBottom: i < displayData.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{d.label}</span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: '#444' }}>{formatCurrency(d.monto)}</span>
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#aaa', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 4 }}>{d.cantidad}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: 'right' as const }}>{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pctMonto}%`, background: color, opacity: 0.6, borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };
            return (
              <div className="data-card" style={{ background: '#0a0a0a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                  <div style={{ flex: 1 }}>{sectionHeader('4. Ventas por Categoría', <Tag size={15} color="#fb923c" />)}</div>
                  <span style={{ fontSize: 11, color: '#444', marginBottom: 20 }}>{ventasMes.length} ops · {formatCurrency(totalMes)}</span>
                </div>
                {/* Cuotas + Rango Etario — horizontales */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                  <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} datos={distCuotas} color="#60a5fa" />
                  <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={distRangoEtario} color="#34d399" />
                  <DistBlock titulo="Sexo" icon={<Users size={12} color="#f472b6" />} datos={distSexo} color="#f472b6" />
                  <DistBlock titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={distEmpleador} color="#fbbf24" maxItems={Infinity} />
                  <DistBlock titulo="Localidad" icon={<FileText size={12} color="#a78bfa" />} datos={distLocalidad} color="#a78bfa" />
                </div>
              </div>
            );
          })()}
          {/* ── SECCIÓN 5: ANÁLISIS COMERCIAL ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('5. Análisis Comercial', <TrendingUp size={15} color="#34d399" />)}
            <ManualTextarea
              label="Interpretación del Período"
              value={resumen.analisis_comercial}
              onChange={v => setResumen(p => ({ ...p, analisis_comercial: v }))}
              placeholder="¿Por qué se vendió más o menos? Impacto de campañas, comportamiento del cliente, factores externos..."
            />
          </div>

          {/* ── SECCIÓN 6: OPERACIÓN Y PROCESOS ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('6. Operación y Procesos', <Shield size={15} color="#818cf8" />)}
            <ManualTextarea
              label="Cumplimiento de Procedimientos / Tiempos / Stock"
              value={resumen.operacion_procesos}
              onChange={v => setResumen(p => ({ ...p, operacion_procesos: v }))}
              placeholder="Cumplimiento de procedimientos, tiempos de atención, stock de merchandising y flyers..."
            />
          </div>

          {/* ── SECCIÓN 7: GESTIÓN COMERCIAL ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('7. Gestión Comercial', <Briefcase size={15} color="#34d399" />)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <ManualTextarea label="Gestiones Realizadas" value={resumen.gestiones_realizadas} onChange={v => setResumen(p => ({ ...p, gestiones_realizadas: v }))} placeholder="Visitas, llamados, coordinaciones del período..." />
              <ManualTextarea label="Coordinación de Salidas" value={resumen.coordinacion_salidas} onChange={v => setResumen(p => ({ ...p, coordinacion_salidas: v }))} placeholder="Salidas al campo, visitas programadas..." />
              <ManualTextarea label="Empresas Estratégicas" value={resumen.empresas_estrategicas} onChange={v => setResumen(p => ({ ...p, empresas_estrategicas: v }))} placeholder="Empresas clave contactadas o visitadas..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
              <ManualTextarea label="Principales Logros" value={resumen.logros} onChange={v => setResumen(p => ({ ...p, logros: v }))} placeholder="Describí los principales logros del período..." />
              <ManualTextarea label="Principales Desvíos / Problemas" value={resumen.desvios} onChange={v => setResumen(p => ({ ...p, desvios: v }))} placeholder="Describí los desvíos o problemas detectados..." />
              <ManualTextarea label="Acciones Clave a Seguir" value={resumen.acciones_clave} onChange={v => setResumen(p => ({ ...p, acciones_clave: v }))} placeholder="Acciones prioritarias para el próximo período..." />
            </div>
          </div>

          {/* ── SECCIÓN 8: EXPERIENCIA DEL CLIENTE ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('8. Experiencia del Cliente', <FileText size={15} color="#f472b6" />)}
            <ManualTextarea
              label="Reclamos y Satisfacción"
              value={resumen.experiencia_cliente}
              onChange={v => setResumen(p => ({ ...p, experiencia_cliente: v }))}
              placeholder="Cantidad y tipo de reclamos, nivel de satisfacción, problemas recurrentes..."
            />
          </div>

          {/* ── SECCIÓN 9: GESTIÓN DEL EQUIPO ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('9. Gestión del Equipo', <Activity size={15} color="#fbbf24" />)}
            {auditoriaData.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>Actividad en Sistema</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {CONFIG.ANALISTAS_DEFAULT.map(analista => {
                    const count = auditoriaData.filter(a => a.analista === analista).length;
                    return (
                      <div key={analista} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 4 }}>{analista}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#aaa' }}>{count}</div>
                        <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>acciones registradas</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ManualTextarea label="Dotación Actual" value={resumen.dotacion} onChange={v => setResumen(p => ({ ...p, dotacion: v }))} />
              <ManualTextarea label="Ausentismo / Tardanzas" value={resumen.ausentismo} onChange={v => setResumen(p => ({ ...p, ausentismo: v }))} />
              <ManualTextarea label="Capacitación Realizada" value={resumen.capacitacion} onChange={v => setResumen(p => ({ ...p, capacitacion: v }))} />
              <ManualTextarea label="Evaluación de Desempeño" value={resumen.evaluacion_desempeno} onChange={v => setResumen(p => ({ ...p, evaluacion_desempeno: v }))} />
            </div>
          </div>

          {/* ── SECCIÓN 10: PLAN DE ACCIÓN ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('10. Plan de Acción', <Target size={15} color="#fb923c" />)}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
              <thead>
                <tr>
                  {['Problema Detectado', 'Acción Concreta', 'Responsable', 'Fecha Ejecución', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#444', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.plan_acciones.map((fila, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    {(['problema', 'accion', 'responsable'] as const).map(campo => (
                      <td key={campo} style={{ padding: '6px 8px' }}>
                        <input
                          value={fila[campo]}
                          onChange={e => {
                            const updated = resumen.plan_acciones.map((f, i) => i === idx ? { ...f, [campo]: e.target.value } : f);
                            setResumen(p => ({ ...p, plan_acciones: updated }));
                          }}
                          placeholder={campo === 'problema' ? 'Describí el problema...' : campo === 'accion' ? 'Acción concreta...' : 'Responsable'}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#ccc', fontFamily: "'Outfit', sans-serif", fontSize: 12, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' as const }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="date"
                        value={fila.fecha}
                        onChange={e => {
                          const updated = resumen.plan_acciones.map((f, i) => i === idx ? { ...f, fecha: e.target.value } : f);
                          setResumen(p => ({ ...p, plan_acciones: updated }));
                        }}
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#ccc', fontFamily: "'Outfit', sans-serif", fontSize: 12, padding: '7px 10px', outline: 'none', colorScheme: 'dark' as const }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <button
                        onClick={() => setResumen(p => ({ ...p, plan_acciones: p.plan_acciones.filter((_, i) => i !== idx) }))}
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6, color: '#f87171', cursor: 'pointer', padding: '7px 10px', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setResumen(p => ({ ...p, plan_acciones: [...p.plan_acciones, { problema: '', accion: '', responsable: '', fecha: '' }] }))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#888', fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '8px 14px' }}
            >
              <Plus size={13} /> Agregar fila
            </button>
          </div>

          {/* ── SECCIÓN 11: ANÁLISIS TEMPORAL ── */}
          <AnalisisTemporalTab registros={registros} />

          {/* ── BOTONES ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 0, paddingBottom: 0 }}>
            <button
              onClick={handleGenerarLink}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.08)', color: '#34d399', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              Generar Link
            </button>
            <button
              onClick={handleDescargarPDF}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#aaa', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <Download size={14} />
              Descargar PDF
            </button>
            <button
              className="btn-primary"
              onClick={handleGuardar}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Save size={14} />
              {saving ? 'Guardando...' : `Guardar Resumen — ${CONFIG.MESES_NOMBRES[selectedMes - 1]} ${selectedAnio}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
