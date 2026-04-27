'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Registro, CONFIG } from '@/types';
import { formatCurrency } from '@/lib/utils';
import CustomSelect from '@/components/CustomSelect';
import { Line, Bar } from 'react-chartjs-2';
import { BarChart2, ChevronDown } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement,
  BarElement, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, Tooltip, Legend, Filler);

export interface AnalisisTemporalState {
  periodo: number;
  analistaFil: string;
  analistaFil2: string;
  metrica: string;
  compararPeriodo: boolean;
  fechaDesde: string;
  fechaHasta: string;
  collapsedSections: Record<number, boolean>;
}

interface Props {
  registros: Registro[];
  isPublic?: boolean;
  initialMonth?: number;
  initialYear?: number;
  initialState?: AnalisisTemporalState;
  onStateChange?: (state: AnalisisTemporalState) => void;
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const toLocalKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toLocalDate = (fecha: string): Date => new Date(fecha.length === 10 ? `${fecha}T00:00:00` : fecha);
const getISOWeek = (d: Date): number => {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  const day = target.getDay();
  const week = Math.ceil((((firstThursday - target.getTime()) / 86400000) + 1) / 7);
  return week;
};

const VariacionBadge = ({ valor }: { valor: number }) => {
  const esPositivo = valor > 0;
  const esCero = Math.abs(valor) < 0.5;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 700,
      padding: '1px 6px',
      borderRadius: 4,
      marginTop: 2,
      color: esCero ? '#888' : esPositivo ? '#4ade80' : '#f87171',
      background: esCero ? 'rgba(255,255,255,0.05)' : esPositivo ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
    }}>
      {esCero ? '— 0%' : `${esPositivo ? '▲' : '▼'} ${valor >= 0 ? '+' : ''}${valor.toFixed(1)}%`}
    </span>
  );
};

export default function AnalisisTemporalTab({ registros, isPublic, initialMonth, initialYear, initialState, onStateChange }: Props) {
  const [periodo, setPeriodo] = useState(initialState?.periodo ?? -1);
  const [analistaFil, setAnalistaFil] = useState(initialState?.analistaFil ?? 'todos');
  const [analistaFil2, setAnalistaFil2] = useState(initialState?.analistaFil2 ?? 'ninguno');
  const [metrica, setMetrica] = useState(initialState?.metrica ?? 'ventas');

  const baseDate = useMemo(() => {
    if (initialYear && initialMonth) {
      // Usamos el último día del mes/año especificado como referencia
      return new Date(initialYear, initialMonth, 0, 23, 59, 59);
    }
    return new Date();
  }, [initialYear, initialMonth]);
  const [compararPeriodo, setCompararPeriodo] = useState(initialState?.compararPeriodo ?? true);
  const [fechaDesde, setFechaDesde] = useState(initialState?.fechaDesde ?? '');
  const [fechaHasta, setFechaHasta] = useState(initialState?.fechaHasta ?? '');
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>(
    initialState?.collapsedSections ?? { 11: false }
  );

  useEffect(() => {
    if (onStateChange) {
      onStateChange({ periodo, analistaFil, analistaFil2, metrica, compararPeriodo, fechaDesde, fechaHasta, collapsedSections });
    }
  }, [periodo, analistaFil, analistaFil2, metrica, compararPeriodo, fechaDesde, fechaHasta, collapsedSections, onStateChange]);

  const toggleSection = (id: number) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const sectionHeader = (id: number, title: string, icon: React.ReactNode) => {
    const isCollapsed = !!collapsedSections[id];
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: isCollapsed ? 0 : 16, 
        paddingBottom: 10, 
        borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
        width: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{title}</span>
        </div>
        <button 
          onClick={() => toggleSection(id)}
          style={{ 
            background: 'rgba(255,255,255,0.04)', 
            border: '1px solid rgba(255,255,255,0.06)', 
            borderRadius: '6px', 
            width: 24, 
            height: 24, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer', 
            color: '#666',
            transition: 'all 0.2s'
          }}
        >
          <ChevronDown size={14} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>
    );
  };

  const isVenta = (r: { estado: string }) => {
    const e = (r.estado ?? '').toLowerCase();
    return e === 'venta' || e.includes('aprobado cc');
  };

  const filterByMonth = (regs: Registro[], mes: number, anio: number) =>
    regs.filter(r => {
      if (!r.fecha) return false;
      const d = toLocalDate(r.fecha);
      return d.getMonth() + 1 === mes && d.getFullYear() === anio;
    });

  const analisisAnios = useMemo(() =>
    Array.from(new Set(
      registros.filter(r => r.fecha).map(r => parseInt(r.fecha!.slice(0, 4)))
    )).sort(),
    [registros]
  );

  const analisisAnalistas = useMemo(() =>
    Array.from(new Set(registros.map(r => r.analista).filter(Boolean) as string[])),
    [registros]
  );

  const PERIODOS = useMemo(() => {
    const list: { label: string; value: number; disabled?: boolean }[] = [
      { label: 'Mes actual', value: -1 },
      { label: 'Mes anterior', value: -2 },
    ];
    
    // Agregamos los meses restantes para completar 12 meses individuales
    for (let i = 2; i < 12; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      list.push({
        label: `${CONFIG.MESES_NOMBRES[d.getMonth()]} ${d.getFullYear()}`,
        value: -(100 + i)
      });
    }

    list.push({ label: '───', value: -998, disabled: true });
    list.push({ label: 'Últimos 7 días', value: 7 });
    list.push({ label: 'Últimos 15 días', value: 15 });
    list.push({ label: 'Últimos 30 días', value: 30 });
    list.push({ label: 'Últimos 60 días', value: 60 });
    list.push({ label: 'Últimos 90 días', value: 90 });
    list.push({ label: 'Últimos 12 meses', value: 365 });
    list.push({ label: '───', value: -997, disabled: true });
    
    list.push({ label: 'Este año', value: baseDate.getFullYear() });
    analisisAnios.filter(y => y !== baseDate.getFullYear()).forEach(y => {
      list.push({ label: `Año ${y}`, value: y });
    });
    
    list.push({ label: 'Histórico completo', value: 0 });
    list.push({ label: '───', value: -999, disabled: true });
    list.push({ label: 'Rango personalizado', value: -10 });
    
    return list;
  }, [analisisAnios, baseDate]);


  const METRICAS = [
    { value: 'ventas', label: 'Ventas ($)' },
    { value: 'operaciones', label: 'Operaciones (N)' },
    { value: 'ticket', label: 'Ticket Promedio ($)' },
  ];

  const analistaOpts = useMemo(() => [
    { value: 'todos', label: 'Todos' },
    ...analisisAnalistas.map(a => ({ value: a, label: a })),
  ], [analisisAnalistas]);

  const analistaOpts2 = useMemo(() => [
    { value: 'ninguno', label: '---' },
    ...analisisAnalistas.map(a => ({ value: a, label: a })),
  ], [analisisAnalistas]);

  const dateRange = useMemo(() => {
    const ref = baseDate;
    if (periodo === -1) {
      const from = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
      const to = (initialYear && initialMonth) ? new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59) : ref;
      const nDays = to.getDate();
      return { from, to, nDays };
    }
    if (periodo === -2) {
      const from = new Date(ref.getFullYear(), ref.getMonth() - 1, 1, 0, 0, 0, 0);
      const to = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
      return { from, to, nDays: to.getDate() };
    }
    if (periodo === -10 && fechaDesde && fechaHasta) {
      const from = new Date(`${fechaDesde}T00:00:00`);
      const to = new Date(`${fechaHasta}T23:59:59.999`);
      const nDays = Math.max(Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1, 1);
      return { from, to, nDays };
    }
    if (periodo <= -100) {
      const index = Math.abs(periodo) - 100;
      const from = new Date(ref.getFullYear(), ref.getMonth() - index, 1, 0, 0, 0, 0);
      const to = new Date(ref.getFullYear(), ref.getMonth() - index + 1, 0, 23, 59, 59, 999);
      const nDays = to.getDate();
      return { from, to, nDays };
    }

    if (periodo === 0) {
      const minYear = analisisAnios[0] ?? ref.getFullYear();
      const from = new Date(minYear, 0, 1, 0, 0, 0, 0);
      return { from, to: ref, nDays: Math.ceil((ref.getTime() - from.getTime()) / 86400000) };
    }
    if (periodo >= 2000 && periodo <= 2100) {
      const from = new Date(periodo, 0, 1, 0, 0, 0, 0);
      const end = new Date(periodo, 11, 31, 23, 59, 59, 999);
      const to = end > ref ? ref : end;
      return { from, to, nDays: Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1 };
    }
    const from = new Date(ref);
    from.setDate(from.getDate() - periodo);
    from.setHours(0, 0, 0, 0);
    return { from, to: ref, nDays: periodo };
  }, [periodo, analisisAnios, fechaDesde, fechaHasta, baseDate, initialYear, initialMonth]);

  const dateRangeAnterior = useMemo(() => {
    if (!compararPeriodo) return null;
    const ref = baseDate;
    const duracionMs = dateRange.to.getTime() - dateRange.from.getTime();
    if (periodo === -1) {
      const to = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
      const from = new Date(ref.getFullYear(), ref.getMonth() - 1, 1, 0, 0, 0, 0);
      return { from, to, nDays: to.getDate() };
    }
    if (periodo === -2) {
      const to = new Date(ref.getFullYear(), ref.getMonth() - 1, 0, 23, 59, 59, 999);
      const from = new Date(ref.getFullYear(), ref.getMonth() - 2, 1, 0, 0, 0, 0);
      return { from, to, nDays: to.getDate() - from.getDate() + 1 };
    }
    if (periodo === -10) {
      const to = new Date(dateRange.from);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      const from = new Date(to);
      from.setTime(from.getTime() - duracionMs);
      from.setHours(0, 0, 0, 0);
      const nDays = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
      return { from, to, nDays };
    }
    if (periodo <= -100) {
      const index = Math.abs(periodo) - 100;
      const from = new Date(ref.getFullYear(), ref.getMonth() - index - 1, 1, 0, 0, 0, 0);
      const to = new Date(ref.getFullYear(), ref.getMonth() - index, 0, 23, 59, 59, 999);
      return { from, to, nDays: to.getDate() };
    }

    if (periodo === 0) return null;
    if (periodo >= 2000) {
      const prevYear = periodo - 1;
      const from = new Date(prevYear, 0, 1, 0, 0, 0, 0);
      const to = new Date(prevYear, 11, 31, 23, 59, 59, 999);
      const nDays = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
      return { from, to, nDays };
    }
    const to = new Date(dateRange.from);
    to.setDate(to.getDate() - 1);
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setTime(from.getTime() - duracionMs);
    from.setHours(0, 0, 0, 0);
    const nDays = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
    return { from, to, nDays };
  }, [compararPeriodo, dateRange, periodo]);

  const periodoLabel = useMemo(() => {
    if (periodo === -1) return 'mes actual';
    if (periodo === -2) return 'mes anterior';
    if (periodo === 0) return 'histórico completo';
    if (periodo === -10 && fechaDesde && fechaHasta) return `${fechaDesde} → ${fechaHasta}`;
    if (periodo === -10) return 'rango personalizado';
    if (periodo >= 2000) return `año ${periodo}`;
    if (periodo === 365) return 'últimos 12 meses';
    if (periodo <= -100) {
      const index = Math.abs(periodo) - 100;
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - index, 1);
      return `${CONFIG.MESES_NOMBRES[d.getMonth()]} ${d.getFullYear()}`;
    }
    return `últimos ${periodo} días`;
  }, [periodo, fechaDesde, fechaHasta, baseDate]);

  const vsLabel = useMemo(() => {
    if (periodo === -1 || periodo === -2 || periodo <= -100) return 'vs MES ANT.';
    if (periodo >= 2000) return 'vs AÑO ANT.';
    return 'vs PER. ANT.';
  }, [periodo]);


  const ventasFiltradas = useMemo(() => {
    const { from, to } = dateRange;
    const fromStr = toLocalKey(from);
    const toStr = toLocalKey(to);
    return registros.filter(r => {
      if (!r.fecha) return false;
      const estado = (r.estado ?? '').toLowerCase();
      if (!isVenta(r)) return false;
      const dateStr = r.fecha.slice(0, 10);
      if (dateStr < fromStr || dateStr > toStr) return false;
      if (analistaFil !== 'todos' && r.analista !== analistaFil) return false;
      return true;
    });
  }, [registros, dateRange, analistaFil]);

  const calcVal = useCallback((regs: typeof registros): number => {
    if (metrica === 'operaciones') return regs.length;
    const total = regs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    return metrica === 'ticket' && regs.length > 0 ? total / regs.length : total;
  }, [metrica]);

  const fmt = useCallback((v: number) =>
    metrica === 'operaciones' ? String(v) : formatCurrency(v),
    [metrica]
  );

  const fmtK = useCallback((v: number) =>
    metrica === 'operaciones' ? String(v) : `$${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 }).format(v / 1_000)}K`,
    [metrica]
  );

  const tendenciaData = useMemo(() => {
    const byDate = new Map<string, typeof ventasFiltradas>();
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      const key = r.fecha.slice(0, 10);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(r);
      else byDate.set(key, [r]);
    }
    const labels: string[] = [];
    const dailyS: number[] = [];
    const dailyO: number[] = [];
    const cur = new Date(dateRange.from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.to);
    end.setHours(23, 59, 59, 999);
    while (cur <= end) {
      const key = toLocalKey(cur);
      labels.push(`${cur.getDate()}/${cur.getMonth() + 1}`);
      const regs = byDate.get(key) ?? [];
      dailyS.push(regs.reduce((s, r) => s + (Number(r.monto) || 0), 0));
      dailyO.push(regs.length);
      cur.setDate(cur.getDate() + 1);
    }

    let accS = 0;
    let accO = 0;
    const values = dailyS.map((s, i) => {
      accS += s;
      accO += dailyO[i];
      if (metrica === 'ventas') return accS;
      if (metrica === 'operaciones') return accO;
      return accO > 0 ? accS / accO : 0;
    });

    const daily = dailyS.map((s, i) => {
      if (metrica === 'ventas') return s;
      if (metrica === 'operaciones') return dailyO[i];
      return dailyO[i] > 0 ? s / dailyO[i] : 0;
    });

    return { labels, values, daily };
  }, [ventasFiltradas, dateRange, metrica]);

  const ventasFiltradasAnterior = useMemo(() => {
    if (!dateRangeAnterior) return [];
    const { from, to } = dateRangeAnterior;
    const fromStr = toLocalKey(from);
    const toStr = toLocalKey(to);
    return registros.filter(r => {
      if (!r.fecha) return false;
      if (!isVenta(r)) return false;
      const dateStr = r.fecha.slice(0, 10);
      if (dateStr < fromStr || dateStr > toStr) return false;
      if (analistaFil !== 'todos' && r.analista !== analistaFil) return false;
      return true;
    });
  }, [registros, dateRangeAnterior, analistaFil]);

  const tendenciaDataAnterior = useMemo(() => {
    if (!dateRangeAnterior || ventasFiltradasAnterior.length === 0) return null;
    const byDate = new Map<string, typeof ventasFiltradasAnterior>();
    for (const r of ventasFiltradasAnterior) {
      if (!r.fecha) continue;
      const key = r.fecha.slice(0, 10);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(r);
      else byDate.set(key, [r]);
    }
    const labels: string[] = [];
    const dailyS: number[] = [];
    const dailyO: number[] = [];
    const cur = new Date(dateRangeAnterior.from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(dateRangeAnterior.to);
    end.setHours(23, 59, 59, 999);
    while (cur <= end) {
      const key = toLocalKey(cur);
      labels.push(`${cur.getDate()}/${cur.getMonth() + 1}`);
      const regs = byDate.get(key) ?? [];
      dailyS.push(regs.reduce((s, r) => s + (Number(r.monto) || 0), 0));
      dailyO.push(regs.length);
      cur.setDate(cur.getDate() + 1);
    }

    let accS = 0;
    let accO = 0;
    const values = dailyS.map((s, i) => {
      accS += s;
      accO += dailyO[i];
      if (metrica === 'ventas') return accS;
      if (metrica === 'operaciones') return accO;
      return accO > 0 ? accS / accO : 0;
    });

    const daily = dailyS.map((s, i) => {
      if (metrica === 'ventas') return s;
      if (metrica === 'operaciones') return dailyO[i];
      return dailyO[i] > 0 ? s / dailyO[i] : 0;
    });

    return { labels, values, daily };
  }, [ventasFiltradasAnterior, dateRangeAnterior, metrica]);

  const summary = useMemo(() => ({
    total: calcVal(ventasFiltradas),
    avg: dateRange.nDays > 0 ? calcVal(ventasFiltradas) / dateRange.nDays : 0,
    maxDay: tendenciaData.daily.length ? Math.max(...tendenciaData.daily) : 0,
  }), [ventasFiltradas, tendenciaData.daily, dateRange.nDays, calcVal]);

  const summaryAnterior = useMemo(() => {
    if (!dateRangeAnterior || !tendenciaDataAnterior) return null;
    return {
      total: calcVal(ventasFiltradasAnterior),
      avg: dateRangeAnterior.nDays > 0 ? calcVal(ventasFiltradasAnterior) / dateRangeAnterior.nDays : 0,
      maxDay: tendenciaDataAnterior.daily.length ? Math.max(...tendenciaDataAnterior.daily) : 0,
    };
  }, [ventasFiltradasAnterior, tendenciaDataAnterior, dateRangeAnterior, calcVal]);

  const ventasFiltradasAnalista2 = useMemo(() => {
    if (analistaFil2 === 'ninguno') return [];
    const { from, to } = dateRange;
    const fromStr = toLocalKey(from);
    const toStr = toLocalKey(to);
    return registros.filter(r => {
      if (!r.fecha) return false;
      const estado = (r.estado ?? '').toLowerCase();
      if (!isVenta(r)) return false;
      const dateStr = r.fecha.slice(0, 10);
      if (dateStr < fromStr || dateStr > toStr) return false;
      if (r.analista !== analistaFil2) return false;
      return true;
    });
  }, [registros, dateRange, analistaFil2]);

  const tendenciaDataAnalista2 = useMemo(() => {
    if (analistaFil2 === 'ninguno' || ventasFiltradasAnalista2.length === 0) return null;
    const byDate = new Map<string, typeof ventasFiltradasAnalista2>();
    for (const r of ventasFiltradasAnalista2) {
      if (!r.fecha) continue;
      const key = r.fecha.slice(0, 10);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(r);
      else byDate.set(key, [r]);
    }
    const labels: string[] = [];
    const dailyS: number[] = [];
    const dailyO: number[] = [];
    const cur = new Date(dateRange.from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.to);
    end.setHours(23, 59, 59, 999);
    while (cur <= end) {
      const key = toLocalKey(cur);
      labels.push(`${cur.getDate()}/${cur.getMonth() + 1}`);
      const regs = byDate.get(key) ?? [];
      dailyS.push(regs.reduce((s, r) => s + (Number(r.monto) || 0), 0));
      dailyO.push(regs.length);
      cur.setDate(cur.getDate() + 1);
    }

    let accS = 0;
    let accO = 0;
    const values = dailyS.map((s, i) => {
      accS += s;
      accO += dailyO[i];
      if (metrica === 'ventas') return accS;
      if (metrica === 'operaciones') return accO;
      return accO > 0 ? accS / accO : 0;
    });

    const daily = dailyS.map((s, i) => {
      if (metrica === 'ventas') return s;
      if (metrica === 'operaciones') return dailyO[i];
      return dailyO[i] > 0 ? s / dailyO[i] : 0;
    });

    return { labels, values, daily };
  }, [ventasFiltradasAnalista2, dateRange, metrica]);

  const summaryAnalista2 = useMemo(() => {
    if (analistaFil2 === 'ninguno' || !tendenciaDataAnalista2) return null;
    return {
      total: calcVal(ventasFiltradasAnalista2),
      avg: dateRange.nDays > 0 ? calcVal(ventasFiltradasAnalista2) / dateRange.nDays : 0,
      maxDay: tendenciaDataAnalista2.daily.length ? Math.max(...tendenciaDataAnalista2.daily) : 0,
    };
  }, [ventasFiltradasAnalista2, tendenciaDataAnalista2, dateRange.nDays, calcVal]);

  const summaryAnalista2Anterior = useMemo(() => {
    if (analistaFil2 === 'ninguno' || !dateRangeAnterior) return null;
    const { from, to } = dateRangeAnterior;
    const fromStr = toLocalKey(from);
    const toStr = toLocalKey(to);
    const regsAnterior = registros.filter(r => {
      if (!r.fecha) return false;
      if (!isVenta(r)) return false;
      const dateStr = r.fecha.slice(0, 10);
      if (dateStr < fromStr || dateStr > toStr) return false;
      if (r.analista !== analistaFil2) return false;
      return true;
    });
    
    if (regsAnterior.length === 0) return null;

    const byDate = new Map<string, typeof regsAnterior>();
    for (const r of regsAnterior) {
      if (!r.fecha) continue;
      const key = r.fecha.slice(0, 10);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(r);
      else byDate.set(key, [r]);
    }

    const daily: number[] = [];
    const cur = new Date(from);
    const end_d = new Date(to);
    while (cur <= end_d) {
      const key = toLocalKey(cur);
      daily.push(calcVal(byDate.get(key) ?? []));
      cur.setDate(cur.getDate() + 1);
    }

    return {
      total: calcVal(regsAnterior),
      avg: dateRangeAnterior.nDays > 0 ? calcVal(regsAnterior) / dateRangeAnterior.nDays : 0,
      maxDay: daily.length ? Math.max(...daily) : 0,
    };
  }, [registros, dateRangeAnterior, analistaFil2, calcVal]);

  const variacionAnalista2 = useMemo(() => {
    if (!summaryAnalista2 || !summaryAnalista2Anterior) return null;
    const calc = (act: number, prev: number) => {
      if (prev > 0) return ((act - prev) / prev) * 100;
      return act > 0 ? 100 : 0;
    };
    return {
      total: calc(summaryAnalista2.total, summaryAnalista2Anterior.total),
      avg: calc(summaryAnalista2.avg, summaryAnalista2Anterior.avg),
      maxDay: calc(summaryAnalista2.maxDay, summaryAnalista2Anterior.maxDay),
    };
  }, [summaryAnalista2, summaryAnalista2Anterior]);

  const variacion = useMemo(() => {
    if (!summaryAnterior) return null;
    const calc = (act: number, prev: number) => {
      if (prev > 0) return ((act - prev) / prev) * 100;
      return act > 0 ? 100 : 0;
    };
    return {
      total: calc(summary.total, summaryAnterior.total),
      avg: calc(summary.avg, summaryAnterior.avg),
      maxDay: calc(summary.maxDay, summaryAnterior.maxDay),
    };
  }, [summary, summaryAnterior]);

  const mapaActividad = useMemo(() => {
    const byDate = new Map<string, typeof ventasFiltradas>();
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      const key = r.fecha.slice(0, 10);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(r);
      else byDate.set(key, [r]);
    }
    const start = new Date(dateRange.from);
    const dow0 = (start.getDay() + 6) % 7;
    const weeks: { key: string; valor: number; regs: typeof ventasFiltradas }[][] = [];
    let week: { key: string; valor: number; regs: typeof ventasFiltradas }[] = [];
    const cur = new Date(start);
    const end = new Date(dateRange.to);
    for (let i = 0; i < dow0; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - (dow0 - i));
      week.push({ key: toLocalKey(d), valor: 0, regs: [] });
    }
    while (cur <= end) {
      const key = toLocalKey(cur);
      const regs = byDate.get(key) || [];
      week.push({ key, valor: calcVal(regs), regs });
      if (week.length === 7) { weeks.push(week); week = []; }
      cur.setDate(cur.getDate() + 1);
    }
    if (week.length > 0) {
      while (week.length < 7) week.push({ key: '', valor: 0, regs: [] });
      weeks.push(week);
    }
    let maxVal = 0;
    for (const w of weeks) for (const d of w) if (d.valor > maxVal) maxVal = d.valor;
    return { weeks, maxVal };
  }, [ventasFiltradas, dateRange, calcVal]);

  const weeklyStats = useMemo(() => {
    const getWeeklyTotals = (from: Date, to: Date) => {
      const fromStr = toLocalKey(from);
      const toStr = toLocalKey(to);
      
      const regsByBucket = [[], [], [], [], []] as Registro[][];

      const rangeRegs = registros.filter(r => {
        if (!r.fecha || !isVenta(r)) return false;
        const d = r.fecha.slice(0, 10);
        if (d < fromStr || d > toStr) return false;
        if (analistaFil !== 'todos' && r.analista !== analistaFil) return false;
        return true;
      });

      for (const r of rangeRegs) {
        const d = toLocalDate(r.fecha!);
        const day = d.getDate();
        let bucketIdx = 0;
        if (day <= 7) bucketIdx = 0;
        else if (day <= 14) bucketIdx = 1;
        else if (day <= 21) bucketIdx = 2;
        else if (day <= 28) bucketIdx = 3;
        else bucketIdx = 4;
        
        regsByBucket[bucketIdx].push(r);
      }

      return regsByBucket.map(regs => ({ total: calcVal(regs) }));
    };

    const actualWeeks = getWeeklyTotals(dateRange.from, dateRange.to);
    const anteriorWeeks = dateRangeAnterior ? getWeeklyTotals(dateRangeAnterior.from, dateRangeAnterior.to) : [];

    const totals = actualWeeks.map((w, i) => {
      const prevTotal = anteriorWeeks[i]?.total || 0;
      const vsPrev = prevTotal > 0 ? ((w.total - prevTotal) / prevTotal) * 100 : (w.total > 0 && prevTotal === 0 ? 100 : 0);
      return {
        label: i === 4 ? 'Resto MES' : `Semana ${i + 1}`,
        total: w.total,
        vsPrev,
        prevTotal
      };
    });

    const weekTotals = totals.slice(0, 4);
    const best = weekTotals.reduce((a, b) => a.total > b.total ? a : b, weekTotals[0] || { label: '—', total: 0 });
    const withData = weekTotals.filter(w => w.total > 0);
    const worst = withData.length > 0 ? withData.reduce((a, b) => a.total < b.total ? a : b, withData[0]) : weekTotals[0] || totals[0];


    return { totals, best, worst };
  }, [registros, dateRange, dateRangeAnterior, analistaFil, calcVal, metrica]);

  const dowStats = useMemo(() => {
    const byDow = new Array(7).fill(null).map(() => [] as typeof ventasFiltradas);
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      const dow = (toLocalDate(r.fecha).getDay() + 6) % 7;
      byDow[dow].push(r);
    }
    const sums = byDow.slice(0, 6).map(regs => calcVal(regs));
    const max = Math.max(...sums);
    const activeDayIdx = sums.reduce((bestIdx, currentVal, currentIdx) => currentVal > sums[bestIdx] ? currentIdx : bestIdx, 0);
    return { sums, max, activeDay: DIAS_SEMANA[activeDayIdx] || '—' };
  }, [ventasFiltradas, calcVal]);

  const heatColor = (val: number, max: number): string => {
    if (val === 0) return 'rgba(34,197,94,0.05)';
    const t = Math.min(val / max, 1);
    return `rgba(34, 197, 94, ${(0.15 + t * 0.5).toFixed(2)})`;
  };

  const acuerdosTimeData = useMemo(() => {
    const byWeek = new Map<string, { bajo: number; medio: number; premium: number }>();
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      const d = toLocalDate(r.fecha);
      const start = new Date(dateRange.from);
      const weekNum = Math.floor((d.getTime() - start.getTime()) / 604800000);
      const label = `S${weekNum + 1}`;
      if (!byWeek.has(label)) byWeek.set(label, { bajo: 0, medio: 0, premium: 0 });
      const entry = byWeek.get(label)!;
      const acuerdo = (r.acuerdo_precios ?? '').toLowerCase();
      const monto = Number(r.monto) || 0;
      if (acuerdo.includes('bajo') || acuerdo.includes('riesgo bajo')) entry.bajo += monto;
      else if (acuerdo.includes('medio') || acuerdo.includes('riesgo medio')) entry.medio += monto;
      else if (acuerdo.includes('premium')) entry.premium += monto;
      else entry.medio += monto;
    }
    return Array.from(byWeek.entries()).map(([label, data]) => ({ label, ...data }));
  }, [ventasFiltradas, dateRange]);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Filters Header Card */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid rgba(255,255,255,0.03)',
        borderRadius: '8px',
        padding: '10px 20px',
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '16px',
      }}>
        {/* El header se movió al contenedor padre */}
        
        {!collapsedSections[11] && (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', marginTop: 12, pointerEvents: isPublic ? 'none' : 'auto', opacity: isPublic ? 0.9 : 1 }}>
            {[
              { label: 'Período', node: <CustomSelect options={PERIODOS} value={periodo} onChange={(v) => setPeriodo(Number(v))} width="170px" /> },
              { label: 'Analista', node: <CustomSelect options={analistaOpts} value={analistaFil} onChange={(v) => setAnalistaFil(String(v))} width="160px" /> },
              { label: 'Comparar c/', node: <CustomSelect options={analistaOpts2} value={analistaFil2} onChange={(v) => setAnalistaFil2(String(v))} width="160px" /> },
              { label: 'Métrica', node: <CustomSelect options={METRICAS} value={metrica} onChange={(v) => setMetrica(String(v))} width="160px" /> },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{f.label}</div>
                {f.node}
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Fecha desde</div>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => { setFechaDesde(e.target.value); setPeriodo(-10); }}
                style={{ width: '150px', height: '34px', borderRadius: '6px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', padding: '0 10px', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Fecha hasta</div>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => { setFechaHasta(e.target.value); setPeriodo(-10); }}
                style={{ width: '150px', height: '34px', borderRadius: '6px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', padding: '0 10px', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Comparar</div>
              <button
                onClick={() => setCompararPeriodo(v => !v)}
                style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: compararPeriodo ? 'rgba(34,197,94,0.8)' : '#333', position: 'relative', transition: 'background 0.2s' }}
              >
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: compararPeriodo ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {!collapsedSections[11] && (
        <>

      {/* Rendimiento (Stats) - Top Row */}
      <div id="seccion-rendimiento-horizontal" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { 
              id: 'total', 
              title: metrica === 'ventas' ? 'VENTA TOTAL' : (metrica === 'operaciones' ? 'OPERACIONES' : 'TICKET TOTAL'), 
              val1: summary.total, 
              var1: variacion?.total, 
              prev1: summaryAnterior?.total,
              val2: summaryAnalista2?.total,
              var2: variacionAnalista2?.total,
              prev2: summaryAnalista2Anterior?.total
            },
            { 
              id: 'avg', 
              title: 'PROMEDIO DIARIO', 
              val1: summary.avg, 
              var1: variacion?.avg, 
              prev1: summaryAnterior?.avg,
              val2: summaryAnalista2?.avg,
              var2: variacionAnalista2?.avg,
              prev2: summaryAnalista2Anterior?.avg
            },
            { 
              id: 'max', 
              title: 'MÁXIMO DÍA', 
              val1: summary.maxDay, 
              var1: variacion?.maxDay, 
              prev1: summaryAnterior?.maxDay,
              val2: summaryAnalista2?.maxDay,
              var2: variacionAnalista2?.maxDay,
              prev2: summaryAnalista2Anterior?.maxDay
            },
          ].map(s => {
            const isAvg = s.id === 'avg';
            const displayVal = (v: number) => metrica === 'operaciones' && isAvg ? Math.round(v).toString() : (isAvg ? formatCurrency(v) : fmt(v));
            
            return (
              <div key={s.id} style={{ 
                background: 'rgba(20, 20, 20, 0.4)', 
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '16px', 
                padding: '20px 24px', 
                display: 'flex', 
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 3, height: 12, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
                  <div style={{ fontSize: 10, color: '#666', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {s.title}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 32 }}>
                  {/* Analista 1 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                      <div style={{ fontSize: 9, color: '#888', fontWeight: 700 }}>{analistaFil.toUpperCase()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{displayVal(s.val1)}</div>
                      {s.var1 !== undefined && <VariacionBadge valor={s.var1} />}
                    </div>
                    {s.prev1 !== undefined && <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>Ant: {displayVal(s.prev1)}</div>}
                  </div>

                  {/* Analista 2 (Comparación) */}
                  {s.val2 !== undefined && (
                    <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: 32 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                        <div style={{ fontSize: 9, color: '#888', fontWeight: 700 }}>{analistaFil2.toUpperCase()}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{displayVal(s.val2)}</div>
                        {s.var2 !== undefined && <VariacionBadge valor={s.var2} />}
                      </div>
                      {s.prev2 !== undefined && <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>Ant: {displayVal(s.prev2)}</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      <div id="seccion-tendencia-mapa" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Tendencia (Chart) */}
        <div style={{ background: 'rgba(10, 10, 10, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', height: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tendencia</span>
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>
              {compararPeriodo && dateRangeAnterior
                ? `Comparación: ${periodoLabel} vs período anterior`
                : `Acumulado por día — ${periodoLabel}`
              }
            </div>
          </div>
          <div id="chart-at-tendencia" style={{ flex: 1, marginTop: 12, overflow: 'hidden' }}>
            <Line
              data={{
                labels: tendenciaData.labels,
                datasets: [
                  {
                    label: analistaFil !== 'todos' ? analistaFil : (metrica === 'ventas' ? 'Acumulado' : metrica === 'operaciones' ? 'Operaciones' : 'Ticket Prom.'),
                    data: tendenciaData.values,
                    borderColor: 'rgba(34,197,94,0.8)',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(34,197,94,0.9)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3,
                    spanGaps: false,
                  },
                  ...(compararPeriodo && tendenciaDataAnterior ? [{
                    label: 'Período anterior',
                    data: tendenciaDataAnterior.values,
                    borderColor: 'rgba(100,150,255,0.5)',
                    backgroundColor: 'rgba(100,150,255,0.08)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(100,150,255,0.4)',
                    pointBorderColor: 'rgba(100,150,255,0.7)',
                    pointBorderWidth: 1.5,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3,
                    spanGaps: false,
                  }] : []),
                  ...(analistaFil2 !== 'ninguno' && tendenciaDataAnalista2 ? [{
                    label: analistaFil2,
                    data: tendenciaDataAnalista2.values,
                    borderColor: 'rgba(239,68,68,0.8)',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(239,68,68,0.9)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3,
                    spanGaps: false,
                  }] : []),
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: (compararPeriodo && !!tendenciaDataAnterior) || (analistaFil2 !== 'ninguno' && !!tendenciaDataAnalista2),
                    position: 'top' as const,
                    align: 'center' as const,
                    labels: { color: '#888', boxWidth: 16, padding: 10, font: { size: 10 }, usePointStyle: true },
                  },
                  tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}` } },
                },
                scales: {
                  x: { ticks: { color: '#555', maxTicksLimit: 32, font: { size: 9 }, maxRotation: 45, minRotation: 45, padding: 0 }, grid: { color: 'rgba(255,255,255,0.03)' } },
                  y: { min: 0, grace: '25%', ticks: { color: '#555', callback: (v: any) => fmtK(Number(v)), font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                },
              }}
            />
          </div>
        </div>

        {/* Mapa de actividad */}
        <div style={{ background: 'rgba(10, 10, 10, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', height: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mapa de Actividad</span>
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>Ventas por día — {periodoLabel}</div>
          </div>
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%', height: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }} />
                  {DIAS_SEMANA.map(d => (
                    <th key={d} style={{ textAlign: 'center', fontSize: 10, color: '#555', fontWeight: 600, padding: '0 2px 6px' }}>{d}</th>
                  ))}
                  <th style={{ fontSize: 10, color: '#555', fontWeight: 600, textAlign: 'right', paddingLeft: 8, paddingBottom: 6 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {mapaActividad.weeks.slice(0, 5).map((week, wi) => {
                  const weekTotal = week.reduce((s, d) => s + d.valor, 0);
                  return (
                    <tr key={wi}>
                      <td style={{ fontSize: 10, color: '#444', fontWeight: 600, paddingRight: 6, textAlign: 'right' }}>S{wi + 1}</td>
                      {week.slice(0, 6).map((day, di) => (
                        <td key={di} title={`${day.key}: ${fmt(day.valor)}`}
                          style={{
                            background: heatColor(day.valor, mapaActividad.maxVal),
                            borderRadius: 4, height: 50, textAlign: 'center', fontSize: 10,
                            color: day.valor > 0 ? '#86efac' : '#333', fontWeight: day.valor > 0 ? 600 : 400,
                            border: 'none', padding: '0 4px', cursor: 'default', minWidth: 35,
                          }}
                        >{day.valor > 0 ? fmtK(day.valor) : ''}</td>
                      ))}
                      <td style={{ fontSize: 11, color: '#fff', fontWeight: 700, textAlign: 'right', paddingLeft: 8 }}>{fmtK(weekTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>DÍA MÁS ACTIVO</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 2 }}>{dowStats.activeDay}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL PERÍODO</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 2 }}>{fmt(summary.total)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Evolucion semanal */}
      <div id="seccion-estacionalidad" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Evolucion semanal</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'stretch' }}>
          {weeklyStats.totals.map((w) => (
            <div key={w.label} style={{ flex: '1 1 120px', minWidth: 110, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>{w.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{fmt(w.total)}</div>
              {compararPeriodo && dateRangeAnterior && w.prevTotal !== undefined && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: w.vsPrev >= 0 ? '#22c55e' : '#ef4444', marginTop: '10px', background: w.vsPrev >= 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                    {w.vsPrev >= 0 ? '↑' : '↓'} {Math.abs(w.vsPrev).toFixed(1)}% <span style={{ opacity: 0.6, fontSize: '9px', marginLeft: '4px' }}>{vsLabel}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#444', marginTop: '6px', fontWeight: 600 }}>
                    Ant: {fmt(w.prevTotal)}
                  </div>
                </>
              )}
            </div>
          ))}
          <div id="chart-at-estacionalidad" style={{ flex: '2 1 300px', minWidth: 280, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', minHeight: 140 }}>
            <Bar
              data={{
                labels: weeklyStats.totals.map(s => s.label),
                datasets: [{
                  label: metrica === 'operaciones' ? 'Operaciones' : 'Total',
                  data: weeklyStats.totals.map(s => s.total),
                  backgroundColor: weeklyStats.totals.map(s => s.label === weeklyStats.best.label ? 'rgba(34,197,94,0.7)' : 'rgba(34,197,94,0.3)'),
                  borderRadius: 4,
                  borderSkipped: false,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => fmt(ctx.parsed.y ?? 0) } } },
                scales: {
                  x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                  y: { ticks: { color: '#555', callback: (v: any) => fmtK(Number(v)), font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                },
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Total Período</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{fmt(weeklyStats.totals.reduce((acc, curr) => acc + curr.total, 0))}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Mejor Sem</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{weeklyStats.best.label}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Peor Sem</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{weeklyStats.worst.label}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Variación</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>
              {weeklyStats.best.total > 0 && weeklyStats.worst.total > 0 ? `${((weeklyStats.best.total / weeklyStats.worst.total - 1) * 100).toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Por día de semana + Acuerdo de Precios */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Por Día de Semana</span>
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>Rendimiento en $</div>
          </div>
          <div id="chart-at-dia-semana" style={{ height: 200 }}>
            <Bar
              data={{
                labels: DIAS_SEMANA.slice(0, 6),
                datasets: [{
                  label: metrica === 'operaciones' ? 'Operaciones' : 'Total',
                  data: dowStats.sums,
                  backgroundColor: dowStats.sums.map(v => v >= dowStats.max * 0.9 ? 'rgba(34,197,94,0.6)' : 'rgba(34,197,94,0.2)'),
                  borderRadius: 4,
                  borderSkipped: false,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => fmt(ctx.parsed.y ?? 0) } } },
                scales: {
                  x: { ticks: { color: '#555', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                  y: { ticks: { color: '#555', callback: (v: any) => fmtK(Number(v)), font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                },
              }}
            />
          </div>
        </div>

        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Evolución Acuerdo de Precios</span>
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>Proporción semanal: Riesgo Bajo vs Medio vs Premium</div>
          </div>
          <div id="chart-at-acuerdos" style={{ height: 220 }}>
            <Bar
              data={{
                labels: acuerdosTimeData.map(w => w.label),
                datasets: [
                  { label: 'Riesgo Bajo', data: acuerdosTimeData.map(w => w.bajo), backgroundColor: 'rgba(74, 222, 128, 0.6)', borderRadius: 2, borderSkipped: false, stack: 'stack1' },
                  { label: 'Riesgo Medio', data: acuerdosTimeData.map(w => w.medio), backgroundColor: 'rgba(239, 68, 68, 0.5)', borderRadius: 2, borderSkipped: false, stack: 'stack1' },
                  { label: 'Premium', data: acuerdosTimeData.map(w => w.premium), backgroundColor: 'rgba(96, 165, 250, 0.5)', borderRadius: 2, borderSkipped: false, stack: 'stack1' },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' as const, align: 'end' as const, labels: { color: '#888', boxWidth: 12, padding: 10, font: { size: 10 }, usePointStyle: true } },
                  tooltip: {
                    callbacks: {
                      label: (ctx: any) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
                      afterBody: (items: any[]) => {
                        if (!items.length) return '';
                        const idx = items[0].dataIndex;
                        const w = acuerdosTimeData[idx];
                        const total = w.bajo + w.medio + w.premium;
                        if (total === 0) return '';
                        return `  Bajo: ${((w.bajo / total) * 100).toFixed(0)}%  |  Medio: ${((w.medio / total) * 100).toFixed(0)}%  |  Premium: ${((w.premium / total) * 100).toFixed(0)}%`;
                      },
                    },
                  },
                },
                scales: {
                  x: { stacked: true, ticks: { color: '#555', font: { size: 9 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.03)' } },
                  y: { stacked: true, ticks: { color: '#555', callback: (v: any) => fmtK(Number(v)), font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                },
              }}
            />
          </div>
          {(() => {
            const totalBajo = acuerdosTimeData.reduce((s, w) => s + w.bajo, 0);
            const totalMedio = acuerdosTimeData.reduce((s, w) => s + w.medio, 0);
            const totalPremium = acuerdosTimeData.reduce((s, w) => s + w.premium, 0);
            const total = totalBajo + totalMedio + totalPremium;
            if (total === 0) return null;
            return (
              <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Riesgo Bajo</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#4ade80', marginTop: 2 }}>{((totalBajo / total) * 100).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: '#666' }}>{formatCurrency(totalBajo)}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Riesgo Medio</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', marginTop: 2 }}>{((totalMedio / total) * 100).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: '#666' }}>{formatCurrency(totalMedio)}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Premium</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa', marginTop: 2 }}>{((totalPremium / total) * 100).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: '#666' }}>{formatCurrency(totalPremium)}</div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
