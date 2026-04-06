'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Registro, Objetivo, CONFIG } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Save, Plus, Trash2, BarChart3, Users, TrendingUp, Activity, Shield, Target, FileText, Download } from 'lucide-react';

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
}

const EMPTY_RESUMEN = (): ResumenMensual => ({
  logros: '', desvios: '', acciones_clave: '',
  gestiones_realizadas: '', coordinacion_salidas: '', empresas_estrategicas: '',
  analisis_comercial: '',
  dotacion: '', ausentismo: '', capacitacion: '', evaluacion_desempeno: '',
  operacion_procesos: '',
  experiencia_cliente: '',
  plan_acciones: [],
});

interface Props {
  registros: Registro[];
  objetivos: Objetivo[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const now = new Date();

export default function ResumenMensualTab({ registros, objetivos, onSuccess, onError }: Props) {
  const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(now.getFullYear());
  const [resumen, setResumen] = useState<ResumenMensual>(EMPTY_RESUMEN());
  const [auditoriaData, setAuditoriaData] = useState<{ analista: string; accion: string; fecha_hora: string }[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

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
          experiencia_cliente: existing.experiencia_cliente ?? '',
          plan_acciones: existing.plan_acciones ?? [],
        });
      } else {
        setResumen(EMPTY_RESUMEN());
      }
      setAuditoriaData(audit ?? []);
      setLoadingData(false);
    });

    return () => { cancelled = true; };
  }, [selectedMes, selectedAnio]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('resumen_mensual')
      .upsert(
        { anio: selectedAnio, mes: selectedMes, ...resumen, updated_at: new Date().toISOString() },
        { onConflict: 'anio,mes' }
      );
    setSaving(false);
    if (error) onError(`Error al guardar: ${error.message}`);
    else onSuccess(`Resumen de ${CONFIG.MESES_NOMBRES[selectedMes - 1]} ${selectedAnio} guardado`);
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  const handleDescargarPDF = () => {
    const mesNombre = CONFIG.MESES_NOMBRES[selectedMes - 1];
    const titulo = `Resumen ${mesNombre} ${selectedAnio}`;

    const acuerdoColores: Record<string, string> = { 'Bajo Riesgo': '#16a34a', 'Riesgo Medio': '#d97706', 'Premium': '#7c3aed' };
    const totalOpsAcuerdo = Object.values(distribucionAcuerdos).reduce((s, d) => s + d.cantidad, 0);
    const totalMontoAcuerdo = Object.values(distribucionAcuerdos).reduce((s, d) => s + d.monto, 0);

    const fmtPct = (n: number | null) => n !== null ? `${n.toFixed(1)}%` : '—';
    const fmtBar = (pct: number, color: string) =>
      `<div style="height:4px;background:#e5e7eb;border-radius:2px;margin-top:4px"><div style="height:100%;width:${Math.min(pct, 100)}%;background:${color};border-radius:2px"></div></div>`;

    const analistas = [...kpiPorAnalista, {
      analista: 'Total PDV', capital: kpiTotal.capital, ops: kpiTotal.ops,
      ticket: kpiTotal.ticket, conversion: kpiTotal.conversion,
      clientesIngresados: kpiTotal.clientes, cumplCapital: kpiTotal.cumplCapital,
      cumplOps: kpiTotal.cumplOps, tendCapital: kpiTotal.tendCapital,
      tendOps: kpiTotal.tendOps, metaCapital: kpiTotal.metaCapital, metaOps: kpiTotal.metaOps,
    }];

    const seccion = (num: string, titulo: string) =>
      `<h2 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#374151;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin:28px 0 14px">${num}. ${titulo}</h2>`;

    const textarea = (label: string, valor: string) => valor.trim() ? `
      <div style="margin-bottom:12px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;margin-bottom:4px">${label}</div>
        <div style="font-size:12px;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;white-space:pre-wrap;line-height:1.5">${valor}</div>
      </div>` : '';

    const distBlock = (titulo: string, datos: { label: string; monto: number; cantidad: number }[], color: string) => {
      const total = datos.reduce((s, d) => s + d.cantidad, 0);
      if (datos.length === 0) return '';
      return `
        <div style="flex:1;min-width:160px">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#6b7280;margin-bottom:6px">${titulo}</div>
          <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            ${datos.slice(0, 7).map((d, i) => {
              const pct = total > 0 ? (d.cantidad / total) * 100 : 0;
              return `<div style="padding:6px 10px;${i > 0 ? 'border-top:1px solid #f3f4f6' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:11px;color:#374151;font-weight:600">${d.label}</span>
                  <div style="display:flex;gap:8px;align-items:center">
                    <span style="font-size:10px;color:#9ca3af">${formatCurrency(d.monto)}</span>
                    <span style="font-size:11px;font-weight:700;color:${color}">${pct.toFixed(0)}% (${d.cantidad})</span>
                  </div>
                </div>
                <div style="height:2px;background:#f3f4f6;border-radius:2px;margin-top:3px"><div style="height:100%;width:${pct}%;background:${color};opacity:0.5;border-radius:2px"></div></div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    };

    const planAcciones = resumen.plan_acciones.filter(f => f.problema || f.accion);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #fff; padding: 32px 40px; font-size: 13px; }
    @page { margin: 20mm 18mm; size: A4; }
    @media print { body { padding: 0; } .no-print { display: none; } }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
    td { font-size: 12px; padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: #374151; }
    tr:last-child td { border-bottom: none; font-weight: 700; color: #111827; border-top: 2px solid #e5e7eb; }
  </style>
</head>
<body>
  <!-- PORTADA -->
  <div style="margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #111827">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:6px">Informe de Gestión Comercial</div>
    <h1 style="font-size:28px;font-weight:900;color:#111827">${titulo}</h1>
    <div style="font-size:12px;color:#6b7280;margin-top:6px">Generado el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>

  <!-- SECCIÓN 1: TABLERO DE MANDO -->
  ${seccion('1', 'Tablero de Mando')}
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
    ${[
      { label: 'Capital Vendido', valor: formatCurrency(kpiTotal.capital), sub: `Meta: ${kpiTotal.metaCapital > 0 ? formatCurrency(kpiTotal.metaCapital) : '—'}`, pct: kpiTotal.cumplCapital, color: kpiTotal.cumplCapital !== null && kpiTotal.cumplCapital >= 100 ? '#16a34a' : '#dc2626' },
      { label: 'Operaciones', valor: String(kpiTotal.ops), sub: `Meta: ${kpiTotal.metaOps > 0 ? kpiTotal.metaOps : '—'}`, pct: kpiTotal.cumplOps, color: kpiTotal.cumplOps !== null && kpiTotal.cumplOps >= 100 ? '#16a34a' : '#dc2626' },
      { label: 'Ticket Promedio', valor: formatCurrency(kpiTotal.ticket), sub: `Conversión: ${kpiTotal.conversion.toFixed(1)}% · ${kpiTotal.clientes} clientes`, pct: null, color: '#374151' },
    ].map(k => `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;margin-bottom:6px">${k.label}</div>
        <div style="font-size:20px;font-weight:900;color:#111827">${k.valor}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:3px">${k.sub}</div>
        ${k.pct !== null ? `<div style="margin-top:6px;display:flex;align-items:center;gap:6px"><span style="font-size:12px;font-weight:800;color:${k.color}">${fmtPct(k.pct)} cumpl.</span></div>${fmtBar(k.pct, k.color)}` : ''}
      </div>`).join('')}
  </div>
  ${[
    { label: 'Principales Logros', val: resumen.logros },
    { label: 'Principales Desvíos / Problemas', val: resumen.desvios },
    { label: 'Acciones Clave a Seguir', val: resumen.acciones_clave },
  ].map(f => textarea(f.label, f.val)).join('')}

  <!-- SECCIÓN 2: INDICADORES -->
  ${seccion('2', 'Indicadores por Analista')}
  <table style="margin-bottom:20px">
    <thead><tr>
      <th style="text-align:left">Analista</th><th style="text-align:right">Capital</th><th style="text-align:right">vs Obj %</th>
      <th style="text-align:right">Ops</th><th style="text-align:right">vs Obj %</th><th style="text-align:right">Ticket</th><th style="text-align:right">Conversión</th><th style="text-align:right">Clientes</th>
    </tr></thead>
    <tbody>
      ${analistas.map(k => `<tr>
        <td style="font-weight:700">${k.analista}</td>
        <td style="text-align:right">${formatCurrency(k.capital)}</td>
        <td style="text-align:right;color:${k.cumplCapital !== null && k.cumplCapital >= 100 ? '#16a34a' : '#dc2626'};font-weight:700">${fmtPct(k.cumplCapital)}</td>
        <td style="text-align:right">${k.ops}</td>
        <td style="text-align:right;color:${k.cumplOps !== null && k.cumplOps >= 100 ? '#16a34a' : '#dc2626'};font-weight:700">${fmtPct(k.cumplOps)}</td>
        <td style="text-align:right">${formatCurrency(k.ticket)}</td>
        <td style="text-align:right">${k.conversion.toFixed(1)}%</td>
        <td style="text-align:right">${k.clientesIngresados}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:10px">Distribución por Acuerdo de Precios</div>
  <div style="display:flex;gap:10px;margin-bottom:20px">
    ${Object.entries(distribucionAcuerdos).map(([tipo, data]) => {
      const pctOps = totalOpsAcuerdo > 0 ? (data.cantidad / totalOpsAcuerdo) * 100 : 0;
      const pctMonto = totalMontoAcuerdo > 0 ? (data.monto / totalMontoAcuerdo) * 100 : 0;
      const color = acuerdoColores[tipo] ?? '#374151';
      return `<div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;border-left:3px solid ${color}">
        <div style="font-size:10px;font-weight:700;color:${color};margin-bottom:6px">${tipo}</div>
        <div style="font-size:18px;font-weight:900;color:#111827">${data.cantidad}</div>
        <div style="font-size:11px;color:#6b7280">${formatCurrency(data.monto)}</div>
        <div style="margin-top:6px;font-size:11px;font-weight:700;color:${color}">${pctOps.toFixed(0)}% ops · ${pctMonto.toFixed(0)}% $</div>
      </div>`;
    }).join('')}
  </div>

  ${ventasMes.length > 0 ? `
  <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:10px">Ventas por Categoría (${ventasMes.length} ops · ${formatCurrency(ventasMes.reduce((s, r) => s + (Number(r.monto) || 0), 0))})</div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
    ${distBlock('Cuotas', distCuotas, '#2563eb')}
    ${distBlock('Rango Etario', distRangoEtario, '#16a34a')}
    ${distBlock('Sexo', distSexo, '#db2777')}
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
    ${distBlock('Empleador', distEmpleador, '#d97706')}
    ${distBlock('Localidad', distLocalidad, '#7c3aed')}
  </div>` : ''}

  ${[
    { label: 'Gestiones Realizadas', val: resumen.gestiones_realizadas },
    { label: 'Coordinación de Salidas', val: resumen.coordinacion_salidas },
    { label: 'Empresas Estratégicas', val: resumen.empresas_estrategicas },
  ].map(f => textarea(f.label, f.val)).join('')}

  <!-- SECCIÓN 3: ANÁLISIS COMERCIAL -->
  ${seccion('3', 'Análisis Comercial')}
  <div style="display:flex;gap:10px;margin-bottom:14px">
    ${rankingAnalistas.map((k, i) => `
      <div style="flex:1;border:1px solid ${i === 0 ? '#bbf7d0' : '#fecaca'};border-radius:8px;padding:12px 14px;background:${i === 0 ? '#f0fdf4' : '#fef2f2'}">
        <div style="font-size:9px;font-weight:700;color:${i === 0 ? '#16a34a' : '#dc2626'};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">${i === 0 ? '▲ Mejor desempeño' : '▼ Menor desempeño'}</div>
        <div style="font-size:14px;font-weight:800;color:#111827">${k.analista}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:3px">${formatCurrency(k.capital)} · ${k.ops} ops.</div>
      </div>`).join('')}
  </div>
  ${textarea('Interpretación del Período', resumen.analisis_comercial)}

  <!-- SECCIÓN 4: GESTIÓN DEL EQUIPO -->
  ${seccion('4', 'Gestión del Equipo')}
  ${auditoriaData.length > 0 ? `
  <div style="display:flex;gap:10px;margin-bottom:14px">
    ${CONFIG.ANALISTAS_DEFAULT.map(analista => {
      const count = auditoriaData.filter(a => a.analista === analista).length;
      return `<div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px">
        <div style="font-size:10px;font-weight:700;color:#6b7280;margin-bottom:4px">${analista}</div>
        <div style="font-size:20px;font-weight:900;color:#111827">${count}</div>
        <div style="font-size:10px;color:#9ca3af">acciones registradas</div>
      </div>`;
    }).join('')}
  </div>` : ''}
  ${[
    { label: 'Dotación Actual', val: resumen.dotacion },
    { label: 'Ausentismo / Tardanzas', val: resumen.ausentismo },
    { label: 'Capacitación Realizada', val: resumen.capacitacion },
    { label: 'Evaluación de Desempeño', val: resumen.evaluacion_desempeno },
  ].map(f => textarea(f.label, f.val)).join('')}

  <!-- SECCIÓN 5 -->
  ${seccion('5', 'Operación y Procesos')}
  ${textarea('Cumplimiento de Procedimientos / Tiempos / Stock', resumen.operacion_procesos)}

  <!-- SECCIÓN 6 -->
  ${seccion('6', 'Experiencia del Cliente')}
  ${textarea('Reclamos y Satisfacción', resumen.experiencia_cliente)}

  <!-- SECCIÓN 7: PLAN DE ACCIÓN -->
  ${seccion('7', 'Plan de Acción')}
  ${planAcciones.length > 0 ? `
  <table>
    <thead><tr>
      <th style="text-align:left">Problema Detectado</th>
      <th style="text-align:left">Acción Concreta</th>
      <th style="text-align:left">Responsable</th>
      <th style="text-align:left">Fecha</th>
    </tr></thead>
    <tbody>
      ${planAcciones.map(f => `<tr>
        <td>${f.problema}</td>
        <td>${f.accion}</td>
        <td style="font-weight:600">${f.responsable}</td>
        <td style="white-space:nowrap">${f.fecha ? new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p style="font-size:12px;color:#9ca3af;font-style:italic">Sin acciones registradas.</p>'}

  <div style="margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between">
    <span>Obsidiana CRM · ${titulo}</span>
    <span>Generado el ${new Date().toLocaleString('es-AR')}</span>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { onError('El navegador bloqueó la ventana emergente. Permitila para descargar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
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
      const cumplOps = metaOps > 0 ? (ops / metaOps) * 100 : null;

      const ventasAnt = filterByMonth(registros, mesPrev, anioPrev).filter(r => r.analista === analista).filter(isVenta);
      const capitalAnt = ventasAnt.reduce((s, r) => s + (Number(r.monto) || 0), 0);
      const opsAnt = ventasAnt.length;
      const tendCapital = capitalAnt > 0 ? ((capital - capitalAnt) / capitalAnt) * 100 : null;
      const tendOps = opsAnt > 0 ? ((ops - opsAnt) / opsAnt) * 100 : null;

      return { analista, capital, ops, ticket, conversion, metaCapital, metaOps, cumplCapital, cumplOps, tendCapital, tendOps, clientesIngresados: regsAnalista.length };
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
    const cumplOps = metaOps > 0 ? (ops / metaOps) * 100 : null;

    return { capital, ops, ticket, conversion, clientes, tendCapital, tendOps, metaCapital, metaOps, cumplCapital, cumplOps };
  }, [registros, objetivos, selectedMes, selectedAnio, mesPrev, anioPrev]);

  // ── Distribución acuerdo de precios ──────────────────────────────────────
  const distribucionAcuerdos = useMemo(() => {
    const tipos: Record<string, { monto: number; cantidad: number }> = {
      'Bajo Riesgo': { monto: 0, cantidad: 0 },
      'Riesgo Medio': { monto: 0, cantidad: 0 },
      'Premium': { monto: 0, cantidad: 0 },
    };
    for (const r of filterByMonth(registros, selectedMes, selectedAnio).filter(isVenta)) {
      const a = (r.acuerdo_precios ?? '').toLowerCase();
      if (a.includes('bajo') || a === 'bajo riesgo') {
        tipos['Bajo Riesgo'].monto += Number(r.monto) || 0;
        tipos['Bajo Riesgo'].cantidad += 1;
      } else if (a.includes('medio') || a === 'riesgo medio') {
        tipos['Riesgo Medio'].monto += Number(r.monto) || 0;
        tipos['Riesgo Medio'].cantidad += 1;
      } else if (a === 'premium') {
        tipos['Premium'].monto += Number(r.monto) || 0;
        tipos['Premium'].cantidad += 1;
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

  const distCuotas = useMemo(() => distPor('cuotas'), [ventasMes]);
  const distRangoEtario = useMemo(() => distPor('rango_etario'), [ventasMes]);
  const distSexo = useMemo(() => distPor('sexo'), [ventasMes]);
  const distEmpleador = useMemo(() => distPor('empleador'), [ventasMes]);
  const distLocalidad = useMemo(() => distPor('localidad'), [ventasMes]);

  // ── Ranking analistas ─────────────────────────────────────────────────────
  const rankingAnalistas = useMemo(() =>
    [...kpiPorAnalista].sort((a, b) => b.capital - a.capital),
    [kpiPorAnalista]
  );

  // ── Textarea helper ───────────────────────────────────────────────────────
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
        <>
          {/* ── SECCIÓN 1: TABLERO DE MANDO ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('1. Tablero de Mando', <BarChart3 size={15} color="#60a5fa" />)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
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
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Ticket Promedio</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{formatCurrency(kpiTotal.ticket)}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Conversión: {kpiTotal.conversion.toFixed(1)}%</div>
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{kpiTotal.clientes} clientes ingresados</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ManualTextarea label="Principales Logros" value={resumen.logros} onChange={v => setResumen(p => ({ ...p, logros: v }))} placeholder="Describí los principales logros del período..." />
              <ManualTextarea label="Principales Desvíos / Problemas" value={resumen.desvios} onChange={v => setResumen(p => ({ ...p, desvios: v }))} placeholder="Describí los desvíos o problemas detectados..." />
              <ManualTextarea label="Acciones Clave a Seguir" value={resumen.acciones_clave} onChange={v => setResumen(p => ({ ...p, acciones_clave: v }))} placeholder="Acciones prioritarias para el próximo período..." />
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
                cumplCapital: kpiTotal.cumplCapital, cumplOps: kpiTotal.cumplOps,
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
                        {k.cumplCapital !== null && (
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
                        {k.cumplOps !== null && (
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

            {/* Distribución por Acuerdo de Precios */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 3, height: 14, background: '#60a5fa', borderRadius: 4 }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Distribución por Acuerdo de Precios</span>
              </div>
              {(() => {
                const totalOps = Object.values(distribucionAcuerdos).reduce((s, d) => s + d.cantidad, 0);
                const totalMonto = Object.values(distribucionAcuerdos).reduce((s, d) => s + d.monto, 0);
                const colores: Record<string, string> = { 'Bajo Riesgo': '#34d399', 'Riesgo Medio': '#fbbf24', 'Premium': '#a78bfa' };
                return (
                  <>
                    {/* Barra de progreso compuesta */}
                    {totalOps > 0 && (
                      <div style={{ display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', marginBottom: 14, gap: 1 }}>
                        {Object.entries(distribucionAcuerdos).map(([tipo, data]) => (
                          <div key={tipo} style={{ width: `${totalOps > 0 ? (data.cantidad / totalOps) * 100 : 0}%`, background: colores[tipo] ?? '#555', transition: 'width 0.4s' }} />
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {Object.entries(distribucionAcuerdos).map(([tipo, data]) => {
                        const pctOps = totalOps > 0 ? (data.cantidad / totalOps) * 100 : 0;
                        const pctMonto = totalMonto > 0 ? (data.monto / totalMonto) * 100 : 0;
                        const color = colores[tipo] ?? '#555';
                        return (
                          <div key={tipo} style={{ background: `${color}0d`, borderRadius: 10, padding: '14px 16px', border: `1px solid ${color}22` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{tipo}</span>
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

            {/* Ventas por Categoría */}
            {ventasMes.length > 0 && (() => {
              const totalMes = ventasMes.reduce((s, r) => s + (Number(r.monto) || 0), 0);
              const DistBlock = ({ titulo, icon, datos, color }: { titulo: string; icon: React.ReactNode; datos: { label: string; monto: number; cantidad: number }[]; color: string }) => {
                const totalCant = datos.reduce((s, d) => s + d.cantidad, 0);
                return (
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>{titulo}</span>
                    </div>
                    <div style={{ background: '#0d0d0d', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                      {datos.slice(0, 7).map((d, i) => {
                        const pct = totalCant > 0 ? (d.cantidad / totalCant) * 100 : 0;
                        const pctMonto = totalMes > 0 ? (d.monto / totalMes) * 100 : 0;
                        return (
                          <div key={i} style={{ padding: '9px 14px', borderBottom: i < Math.min(datos.length, 7) - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
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
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 3, height: 14, background: '#fb923c', borderRadius: 4 }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Ventas por Categoría</span>
                    <span style={{ fontSize: 11, color: '#333', marginLeft: 4 }}>{ventasMes.length} operaciones · {formatCurrency(totalMes)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                    <DistBlock titulo="Cuotas" icon={<BarChart3 size={12} color="#60a5fa" />} datos={distCuotas} color="#60a5fa" />
                    <DistBlock titulo="Rango Etario" icon={<Users size={12} color="#34d399" />} datos={distRangoEtario} color="#34d399" />
                    <DistBlock titulo="Sexo" icon={<Users size={12} color="#f472b6" />} datos={distSexo} color="#f472b6" />
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <DistBlock titulo="Empleador" icon={<Shield size={12} color="#fbbf24" />} datos={distEmpleador} color="#fbbf24" />
                    <DistBlock titulo="Localidad" icon={<FileText size={12} color="#a78bfa" />} datos={distLocalidad} color="#a78bfa" />
                  </div>
                </div>
              );
            })()}

            {/* Gestiones comerciales */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 3, height: 14, background: '#34d399', borderRadius: 4 }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Gestión Comercial</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <ManualTextarea label="Gestiones Realizadas" value={resumen.gestiones_realizadas} onChange={v => setResumen(p => ({ ...p, gestiones_realizadas: v }))} placeholder="Visitas, llamados, coordinaciones del período..." />
                <ManualTextarea label="Coordinación de Salidas" value={resumen.coordinacion_salidas} onChange={v => setResumen(p => ({ ...p, coordinacion_salidas: v }))} placeholder="Salidas al campo, visitas programadas..." />
                <ManualTextarea label="Empresas Estratégicas" value={resumen.empresas_estrategicas} onChange={v => setResumen(p => ({ ...p, empresas_estrategicas: v }))} placeholder="Empresas clave contactadas o visitadas..." />
              </div>
            </div>
          </div>

          {/* ── SECCIÓN 3: ANÁLISIS COMERCIAL ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('3. Análisis Comercial', <TrendingUp size={15} color="#34d399" />)}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {rankingAnalistas.map((k, i) => (
                <div key={k.analista} style={{ flex: 1, minWidth: 180, background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 18px', border: `1px solid ${i === 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.12)'}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? '#34d399' : '#f87171', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 }}>
                    {i === 0 ? '▲ Mejor desempeño' : '▼ Menor desempeño'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ccc' }}>{k.analista}</div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{formatCurrency(k.capital)} · {k.ops} ops.</div>
                </div>
              ))}
            </div>
            <ManualTextarea
              label="Interpretación del Período"
              value={resumen.analisis_comercial}
              onChange={v => setResumen(p => ({ ...p, analisis_comercial: v }))}
              placeholder="¿Por qué se vendió más o menos? Impacto de campañas, comportamiento del cliente, factores externos..."
            />
          </div>

          {/* ── SECCIÓN 4: GESTIÓN DEL EQUIPO ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('4. Gestión del Equipo', <Activity size={15} color="#fbbf24" />)}
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

          {/* ── SECCIÓN 5: OPERACIÓN Y PROCESOS ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('5. Operación y Procesos', <Shield size={15} color="#818cf8" />)}
            <ManualTextarea
              label="Cumplimiento de Procedimientos / Tiempos / Stock"
              value={resumen.operacion_procesos}
              onChange={v => setResumen(p => ({ ...p, operacion_procesos: v }))}
              placeholder="Cumplimiento de procedimientos, tiempos de atención, stock de merchandising y flyers..."
            />
          </div>

          {/* ── SECCIÓN 6: EXPERIENCIA DEL CLIENTE ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('6. Experiencia del Cliente', <FileText size={15} color="#f472b6" />)}
            <ManualTextarea
              label="Reclamos y Satisfacción"
              value={resumen.experiencia_cliente}
              onChange={v => setResumen(p => ({ ...p, experiencia_cliente: v }))}
              placeholder="Cantidad y tipo de reclamos, nivel de satisfacción, problemas recurrentes..."
            />
          </div>

          {/* ── SECCIÓN 7: PLAN DE ACCIÓN ── */}
          <div className="data-card" style={{ background: '#0a0a0a' }}>
            {sectionHeader('7. Plan de Acción', <Target size={15} color="#fb923c" />)}
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

          {/* ── BOTONES ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 8 }}>
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
        </>
      )}
    </div>
  );
}
