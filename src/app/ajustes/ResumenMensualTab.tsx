'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Registro, Objetivo, CONFIG } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Save, Plus, Trash2, BarChart3, Users, TrendingUp, Activity, Shield, Target, FileText } from 'lucide-react';

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
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Analista', 'Capital', 'vs Obj.', 'Tendencia', 'Ops', 'vs Obj.', 'Ticket', 'Conversión', 'Clientes'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Analista' ? 'left' : 'right', color: '#444', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpiPorAnalista.map(k => (
                    <tr key={k.analista} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#ccc' }}>{k.analista}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#aaa' }}>{formatCurrency(k.capital)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {k.cumplCapital !== null ? <span style={{ color: cumplColor(k.cumplCapital), fontWeight: 800, fontSize: 12 }}>{k.cumplCapital.toFixed(0)}%</span> : <span style={{ color: '#333' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{tendBadge(k.tendCapital)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#aaa' }}>{k.ops}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {k.cumplOps !== null ? <span style={{ color: cumplColor(k.cumplOps), fontWeight: 800, fontSize: 12 }}>{k.cumplOps.toFixed(0)}%</span> : <span style={{ color: '#333' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{formatCurrency(k.ticket)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{k.conversion.toFixed(1)}%</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{k.clientesIngresados}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: '#fff' }}>Total PDV</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>{formatCurrency(kpiTotal.capital)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {kpiTotal.cumplCapital !== null ? <span style={{ color: cumplColor(kpiTotal.cumplCapital), fontWeight: 800 }}>{kpiTotal.cumplCapital.toFixed(0)}%</span> : <span style={{ color: '#333' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{tendBadge(kpiTotal.tendCapital)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>{kpiTotal.ops}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {kpiTotal.cumplOps !== null ? <span style={{ color: cumplColor(kpiTotal.cumplOps), fontWeight: 800 }}>{kpiTotal.cumplOps.toFixed(0)}%</span> : <span style={{ color: '#333' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>{formatCurrency(kpiTotal.ticket)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>{kpiTotal.conversion.toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>{kpiTotal.clientes}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12 }}>Distribución por Acuerdo de Precios</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(distribucionAcuerdos).map(([tipo, data]) => (
                  <div key={tipo} style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 }}>{tipo}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#aaa' }}>{formatCurrency(data.monto)}</div>
                    <div style={{ fontSize: 11, color: '#444', marginTop: 3 }}>{data.cantidad} operaciones</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribuciones demográficas */}
            {ventasMes.length > 0 && (() => {
              const DistTable = ({ titulo, datos }: { titulo: string; datos: { label: string; monto: number; cantidad: number }[] }) => (
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>{titulo}</div>
                  <div style={{ background: '#0d0d0d', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    {datos.slice(0, 8).map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderBottom: i < datos.slice(0, 8).length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                        <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{d.label}</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#555' }}>{formatCurrency(d.monto)}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#aaa', background: 'rgba(255,255,255,0.04)', padding: '1px 7px', borderRadius: 4 }}>{d.cantidad}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              return (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#444', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 16 }}>Ventas por Categoría</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                    <DistTable titulo="Cuotas" datos={distCuotas} />
                    <DistTable titulo="Rango Etario" datos={distRangoEtario} />
                    <DistTable titulo="Sexo" datos={distSexo} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <DistTable titulo="Empleador" datos={distEmpleador} />
                    <DistTable titulo="Localidad" datos={distLocalidad} />
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24 }}>
              <ManualTextarea label="Gestiones Realizadas" value={resumen.gestiones_realizadas} onChange={v => setResumen(p => ({ ...p, gestiones_realizadas: v }))} placeholder="Visitas, llamados, coordinaciones del período..." />
              <ManualTextarea label="Coordinación de Salidas" value={resumen.coordinacion_salidas} onChange={v => setResumen(p => ({ ...p, coordinacion_salidas: v }))} />
              <ManualTextarea label="Empresas Estratégicas" value={resumen.empresas_estrategicas} onChange={v => setResumen(p => ({ ...p, empresas_estrategicas: v }))} />
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

          {/* ── BOTÓN GUARDAR ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8 }}>
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
