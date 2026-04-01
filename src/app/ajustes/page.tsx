'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useData } from '@/context/DataContext';
import { CONFIG, HistoricoVenta } from '@/types';
import { formatCurrency, displayAnalista, formatDateTime, formatDate } from '@/lib/utils';
import {
  Save, RotateCcw, AlertCircle, Bell, Clock, History,
  Settings, Target, Activity, Copy, Shield, AlertTriangle,
  CheckCircle, User, ShieldCheck, BarChart3, Calendar, TrendingUp, Trash2,
  Search, Filter, Download, ArrowRight, Eye, Edit3, Plus,
  ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import {
  Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement,
  BarElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, Tooltip, Legend, Filler);

type DiasEntry = { dias_habiles: number | string; dias_transcurridos: number | string };
type HistRow = { capital_real: string; ops_real: string; meta_ventas: string; meta_operaciones: string };
type ObjetivoRow = { analista: string; mes: number; meta_ventas: number; meta_operaciones: number };
type ActiveTab = 'alertas' | 'dias' | 'historico' | 'objetivos' | 'analisis-temporal' | 'duplicados' | 'auditoria';

const EMPTY_HIST_ROWS = (): HistRow[] =>
  Array.from({ length: 12 }, () => ({ capital_real: '', ops_real: '', meta_ventas: '', meta_operaciones: '' }));

const parsePaste = (e: React.ClipboardEvent<HTMLInputElement>, onChange: (v: string) => void) => {
  e.preventDefault();
  const raw = e.clipboardData.getData('text').replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(raw);
  if (!isNaN(num)) onChange(String(num));
};

const ANALISTAS = ['PDV', ...CONFIG.ANALISTAS_DEFAULT];

export default function AjustesPage() {
  const {
    registros: ctxRegistros,
    alertasConfig: ctxAlertas, setAlertasConfig: setCtxAlertas, pushAlertasConfigChange,
    diasConfig: ctxDias, setDiasConfig: setCtxDias, pushDiasConfigChange,
    historicoVentas: ctxHistorico, setHistoricoVentas: setCtxHistorico, pushHistoricoChange,
    objetivos: ctxObjetivos, setObjetivos: setCtxObjetivos, pushObjetivosChange
  } = useData();

  const [activeTab, setActiveTab] = useState<ActiveTab>('alertas');
  const [alertasConfig, setAlertasConfig] = useState(CONFIG.ALERTAS_DEFAULT);
  const [diasValues, setDiasValues] = useState<Record<string, DiasEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDias, setSavingDias] = useState<string | null>(null);

  const [histAnalista, setHistAnalista] = useState(CONFIG.ANALISTAS_DEFAULT[0]);
  const [histAnio, setHistAnio] = useState(new Date().getFullYear() - 1);
  const [histRows, setHistRows] = useState<HistRow[]>(EMPTY_HIST_ROWS());
  const [savingHist, setSavingHist] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Objetivos state
  const [objetivos, setObjetivos] = useState<ObjetivoRow[]>([]);
  const [objetivosAnio, setObjetivosAnio] = useState(new Date().getFullYear());
  const [objetivosAnalista, setObjetivosAnalista] = useState('PDV');
  const [savingObj, setSavingObj] = useState(false);

  // Analisis temporal state
  const [analisisRegistros, setAnalisisRegistros] = useState<{ analista: string; estado: string; monto: number; fecha: string | null }[]>([]);
  const [periodo, setPeriodo] = useState(30);
  const [analistaFil, setAnalistaFil] = useState('todos');
  const [metrica, setMetrica] = useState('ventas');

  // Duplicados state
  const [duplicadosRegistros, setDuplicadosRegistros] = useState<any[]>([]);
  const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
  const [selectedAnalistas, setSelectedAnalistas] = useState<string[]>([]);

  // Auditoria state
  const [auditoriaRegistros, setAuditoriaRegistros] = useState<any[]>([]);
  const [auditoriaLoading, setAuditoriaLoading] = useState(true);
  const [limpiandoLog, setLimpiandoLog] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterAccion, setAuditFilterAccion] = useState<string>('todas');
  const [auditFilterAnalista, setAuditFilterAnalista] = useState<string>('todos');
  const [auditFilterPeriodo, setAuditFilterPeriodo] = useState<string>('todo');
  const [auditPage, setAuditPage] = useState(1);
  const [auditExpandedRow, setAuditExpandedRow] = useState<string | null>(null);
  const AUDIT_PAGE_SIZE = 25;

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const { data: alertas } = await supabase.from('alertas_config').select('*');
    if (alertas && alertas.length > 0) {
      setAlertasConfig(alertas.map(a => ({
        nombre: a.nombre, estado: a.estado, dias: a.dias,
        mensaje: a.mensaje, color: a.color,
      })));
    }

    const { data: dias } = await supabase.from('dias_habiles_config').select('*');
    const initialDias: Record<string, DiasEntry> = {};
    ['Todos', ...CONFIG.ANALISTAS_DEFAULT].forEach(analista => {
      const cfg = dias?.find(d => d.analista === analista);
      initialDias[analista] = {
        dias_habiles: Number(cfg?.dias_habiles) || 22,
        dias_transcurridos: Number(cfg?.dias_transcurridos) || 0,
      };
    });
    setDiasValues(initialDias);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const showSuccess = (msg: string) => setToast({ message: msg, type: 'success' });
  const showError = (msg: string) => setToast({ message: msg, type: 'error' });

  const saveAlertas = async () => {
    setSaving(true);
    try {
      await supabase.from('alertas_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      for (const alerta of alertasConfig) {
        const { error } = await supabase.from('alertas_config').insert(alerta);
        if (error) throw error;
      }

      // Actualizar contexto y enviar broadcast
      setCtxAlertas([...alertasConfig]);
      alertasConfig.forEach(a => pushAlertasConfigChange('UPDATE', a));

      showSuccess('Configuración de alertas guardada');
    } catch (err: any) { showError(`Error: ${err.message}`); }
    setSaving(false);
  };

  const resetAlertas = () => {
    setAlertasConfig(CONFIG.ALERTAS_DEFAULT);
    showSuccess('Configuración restablecida');
  };

  const saveDiasHabiles = async (analista: string) => {
    const entry = diasValues[analista];
    if (!entry) return;
    setSavingDias(analista);
    try {
      const config = {
        analista,
        dias_habiles: Number(entry.dias_habiles) || 0,
        dias_transcurridos: Number(entry.dias_transcurridos) || 0,
        manual: true,
      };
      const { error } = await supabase.from('dias_habiles_config').upsert(config, { onConflict: 'analista' });
      if (error) throw error;

      // Actualizar contexto y enviar broadcast
      setCtxDias(prev => {
        const exists = prev.some(d => d.analista === analista);
        if (exists) return prev.map(d => d.analista === analista ? config : d);
        return [...prev, config];
      });
      pushDiasConfigChange('UPDATE', config);

      showSuccess(`Días guardados para ${analista}`);
    } catch (err: any) { showError(`Error: ${err.message}`); }
    setSavingDias(null);
  };

  const loadHistorico = useCallback(async (anal: string, anio: number) => {
    const [{ data: hist }, { data: objs }] = await Promise.all([
      supabase.from('historico_ventas').select('*').eq('analista', anal).eq('anio', anio),
      supabase.from('objetivos').select('*').eq('analista', anal).eq('anio', anio),
    ]);
    const rows = EMPTY_HIST_ROWS();
    if (hist) {
      hist.forEach((h: any) => {
        if (h.mes >= 0 && h.mes <= 11) {
          rows[h.mes].capital_real = h.capital_real > 0 ? String(h.capital_real) : '';
          rows[h.mes].ops_real = h.ops_real > 0 ? String(h.ops_real) : '';
        }
      });
    }
    if (objs) {
      objs.forEach((o: any) => {
        if (o.mes >= 0 && o.mes <= 11) {
          rows[o.mes].meta_ventas = o.meta_ventas > 0 ? String(o.meta_ventas) : '';
          rows[o.mes].meta_operaciones = o.meta_operaciones > 0 ? String(o.meta_operaciones) : '';
        }
      });
    }
    setHistRows(rows);
  }, []);

  useEffect(() => {
    if (activeTab === 'historico') loadHistorico(histAnalista, histAnio);
  }, [histAnalista, histAnio, loadHistorico, activeTab]);

  // Fetch objetivos when tab is active or year changes
  const fetchObjetivos = useCallback(async () => {
    const { data } = await supabase
      .from('objetivos')
      .select('*')
      .eq('anio', objetivosAnio);

    const grid: ObjetivoRow[] = [];
    for (const analista of ANALISTAS) {
      for (let mes = 0; mes < 12; mes++) {
        const existing = data?.find(o => o.analista === analista && o.mes === mes);
        grid.push({
          analista,
          mes,
          meta_ventas: existing ? Number(existing.meta_ventas) : 0,
          meta_operaciones: existing ? Number(existing.meta_operaciones) : 0,
        });
      }
    }
    setObjetivos(grid);
  }, [objetivosAnio]);

  useEffect(() => {
    if (activeTab === 'objetivos') fetchObjetivos();
  }, [activeTab, objetivosAnio, fetchObjetivos]);

  // Sincronizar datos para Analisis Temporal desde el DataContext (mismo dataset que el resto de la app)
  useEffect(() => {
    setAnalisisRegistros(ctxRegistros.map(r => ({
      analista: r.analista,
      estado: r.estado,
      monto: r.monto,
      fecha: r.fecha ?? null,
    })));
  }, [ctxRegistros]);

  // Fetch datos para Duplicados
  useEffect(() => {
    if (activeTab === 'duplicados') {
      supabase
        .from('registros')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setDuplicadosRegistros(data || []);
        });
    }
  }, [activeTab]);

  // Fetch datos para Auditoria + suscripción realtime
  useEffect(() => {
    if (activeTab !== 'auditoria') return;

    setAuditoriaLoading(true);
    supabase
      .from('auditoria')
      .select('*')
      .order('fecha_hora', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setAuditoriaRegistros(data || []);
        setAuditoriaLoading(false);
      });

    const channel = supabase
      .channel('auditoria-live', { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'auditoria_insert' }, ({ payload }) => {
        if (payload?.entry) {
          setAuditoriaRegistros(prev => [payload.entry, ...prev].slice(0, 200));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeTab]);

  const limpiarLogAuditoria = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar todos los registros de auditoría? Esta acción no se puede deshacer.')) {
      return;
    }
    setLimpiandoLog(true);
    const { data, error } = await supabase
      .from('auditoria')
      .delete()
      .not('id', 'is', null)
      .select('id');
    setLimpiandoLog(false);
    if (error) {
      setToast({ message: `Error al limpiar log: ${error.message}`, type: 'error' });
    } else {
      setToast({ message: `Log de auditoría limpiado exitosamente (${data?.length || 0} registros eliminados)`, type: 'success' });
      setAuditoriaRegistros([]);
    }
  };

  const saveHistorico = async () => {
    setSavingHist(true);
    try {
      const upserts = histRows
        .map((row, mesIdx) => ({
          analista: histAnalista, anio: histAnio, mes: mesIdx,
          capital_real: Number(row.capital_real) || 0, ops_real: Number(row.ops_real) || 0,
        }))
        .filter(r => r.capital_real > 0 || r.ops_real > 0);

      if (upserts.length > 0) {
        const { error } = await supabase.from('historico_ventas').upsert(upserts, { onConflict: 'analista,anio,mes' });
        if (error) throw error;

        // Actualizar contexto y enviar broadcast para historico
        setCtxHistorico((prev: HistoricoVenta[]) => {
          const filtered = prev.filter(h => !(h.analista === histAnalista && h.anio === histAnio));
          const nuevos = upserts.map(u => ({ ...u, id: undefined }));
          return [...filtered, ...nuevos] as HistoricoVenta[];
        });
        upserts.forEach(u => pushHistoricoChange('UPDATE', { ...u, id: undefined }));
      }

      const zeroMonths = histRows
        .map((_, mesIdx) => mesIdx)
        .filter(mesIdx => !Number(histRows[mesIdx].capital_real) && !Number(histRows[mesIdx].ops_real));

      for (const mes of zeroMonths) {
        await supabase.from('historico_ventas').delete().eq('analista', histAnalista).eq('anio', histAnio).eq('mes', mes);
      }

      const objUpserts = histRows
        .map((row, mesIdx) => ({
          analista: histAnalista, anio: histAnio, mes: mesIdx,
          meta_ventas: Number(row.meta_ventas) || 0, meta_operaciones: Number(row.meta_operaciones) || 0,
        }))
        .filter(r => r.meta_ventas > 0 || r.meta_operaciones > 0);

      if (objUpserts.length > 0) {
        const { error } = await supabase.from('objetivos').upsert(objUpserts, { onConflict: 'analista,mes,anio' });
        if (error) throw error;

        // Actualizar contexto y enviar broadcast para objetivos
        setCtxObjetivos(prev => {
          const filtered = prev.filter(o => !(o.analista === histAnalista && o.anio === histAnio));
          const nuevos = objUpserts.map(u => ({ ...u, id: undefined }));
          return [...filtered, ...nuevos];
        });
        objUpserts.forEach(u => pushObjetivosChange('UPDATE', { ...u, id: undefined }));
      }
      showSuccess(`Histórico guardado para ${histAnalista}`);
    } catch (err: any) { showError(`Error: ${err.message}`); }
    setSavingHist(false);
  };

  const updateDias = (analista: string, field: keyof DiasEntry, value: number | string) => {
    setDiasValues(prev => ({ ...prev, [analista]: { ...prev[analista], [field]: value } }));
  };

  // Objetivos handlers
  const updateObjetivoValue = (analista: string, mes: number, field: 'meta_ventas' | 'meta_operaciones', value: number) => {
    setObjetivos(prev => prev.map(o =>
      o.analista === analista && o.mes === mes ? { ...o, [field]: value } : o
    ));
  };

  const resetAnalista = (analista: string) => {
    setObjetivos(prev => prev.map(o =>
      o.analista === analista ? { ...o, meta_ventas: 0, meta_operaciones: 0 } : o
    ));
  };

  const saveObjetivos = async () => {
    setSavingObj(true);
    try {
      const { error } = await supabase
        .from('objetivos')
        .upsert(
          objetivos.map(obj => ({
            analista: obj.analista,
            mes: obj.mes,
            anio: objetivosAnio,
            meta_ventas: obj.meta_ventas,
            meta_operaciones: obj.meta_operaciones,
          })),
          { onConflict: 'analista,mes,anio' }
        );
      if (error) throw error;

      setCtxObjetivos(prev => {
        const filtered = prev.filter(o => o.anio !== objetivosAnio);
        const nuevos = objetivos.map(obj => ({ ...obj, anio: objetivosAnio, id: undefined }));
        return [...filtered, ...nuevos];
      });

      objetivos.forEach(obj => pushObjetivosChange('UPDATE', { ...obj, anio: objetivosAnio }));

      showSuccess('✅ Objetivos guardados correctamente');
    } catch (err: any) {
      showError(`Error: ${err.message}`);
    }
    setSavingObj(false);
  };

  // ========== ANALISIS TEMPORAL HELPERS ==========
  const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const ANALISTAS_VIEW = ['PDV', 'Luciana', 'Victoria'];

  const analisisAnios = useMemo(() =>
    Array.from(new Set(
      analisisRegistros.filter(r => r.fecha).map(r => parseInt(r.fecha!.slice(0, 4)))
    )).sort(),
    [analisisRegistros]
  );

  const PERIODOS = useMemo(() => [
    { label: 'Mes actual', value: -1 },
    { label: 'Mes anterior', value: -2 },
    { label: 'Últimos 7 días', value: 7 },
    { label: 'Últimos 15 días', value: 15 },
    { label: 'Últimos 30 días', value: 30 },
    { label: 'Últimos 60 días', value: 60 },
    { label: 'Últimos 90 días', value: 90 },
    ...analisisAnios.map(y => ({ label: `Año ${y}`, value: y })),
    { label: 'Histórico completo', value: 0 },
  ], [analisisAnios]);
  const METRICAS = [
    { value: 'ventas', label: 'Ventas ($)' },
    { value: 'operaciones', label: 'Operaciones (N)' },
    { value: 'ticket', label: 'Ticket Promedio ($)' },
  ];

  const toLocalDate = (fecha: string): Date => new Date(fecha.length === 10 ? `${fecha}T00:00:00` : fecha);
  const toDateKey = (d: Date): string => d.toISOString().slice(0, 10);
  const toLocalKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodo === -1) {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { from, to: now, nDays: now.getDate() };
    }
    if (periodo === -2) {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to, nDays: to.getDate() };
    }
    if (periodo === 0) {
      const minYear = analisisAnios[0] ?? now.getFullYear();
      const from = new Date(minYear, 0, 1, 0, 0, 0, 0);
      return { from, to: now, nDays: Math.ceil((now.getTime() - from.getTime()) / 86400000) };
    }
    if (periodo >= 2000 && periodo <= 2100) {
      const from = new Date(periodo, 0, 1, 0, 0, 0, 0);
      const end = new Date(periodo, 11, 31, 23, 59, 59, 999);
      const to = end > now ? now : end;
      return { from, to, nDays: Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1 };
    }
    const from = new Date(now);
    from.setDate(from.getDate() - periodo);
    from.setHours(0, 0, 0, 0);
    return { from, to: now, nDays: periodo };
  }, [periodo, analisisAnios]);

  const periodoLabel = useMemo(() => {
    if (periodo === -1) return 'mes actual';
    if (periodo === -2) return 'mes anterior';
    if (periodo === 0) return 'histórico completo';
    if (periodo >= 2000) return `año ${periodo}`;
    return `últimos ${periodo} días`;
  }, [periodo]);

  const analisisAnalistas = useMemo(() =>
    Array.from(new Set(analisisRegistros.map(r => r.analista).filter(Boolean) as string[])),
    [analisisRegistros]
  );

  const ventasFiltradas = useMemo(() => {
    const { from, to } = dateRange;
    const fromStr = toLocalKey(from);
    const toStr = toLocalKey(to);
    return analisisRegistros.filter(r => {
      if (!r.fecha) return false;
      const estado = (r.estado ?? '').toLowerCase();
      if (estado !== 'venta' && !estado.includes('aprobado cc')) return false;
      const dateStr = r.fecha.slice(0, 10);
      if (dateStr < fromStr || dateStr > toStr) return false;
      if (analistaFil !== 'todos' && r.analista !== analistaFil) return false;
      return true;
    });
  }, [analisisRegistros, dateRange, analistaFil]);

  const calcVal = useCallback((regs: { analista: string; estado: string; monto: number; fecha: string | null }[]): number => {
    if (metrica === 'operaciones') return regs.length;
    const total = regs.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    return metrica === 'ticket' && regs.length > 0 ? total / regs.length : total;
  }, [metrica]);

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
    const daily: number[] = [];
    const cur = new Date(dateRange.from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.to);
    end.setHours(23, 59, 59, 999);
    while (cur <= end) {
      const key = toLocalKey(cur);
      labels.push(`${cur.getDate()}/${cur.getMonth() + 1}`);
      daily.push(calcVal(byDate.get(key) ?? []));
      cur.setDate(cur.getDate() + 1);
    }
    if (metrica === 'ventas') {
      let acc = 0;
      return { labels, values: daily.map(v => (acc += v)), daily };
    }
    return { labels, values: daily, daily };
  }, [ventasFiltradas, dateRange, metrica, calcVal]);

  const summary = useMemo(() => ({
    total: calcVal(ventasFiltradas),
    avg: dateRange.nDays > 0 ? calcVal(ventasFiltradas) / dateRange.nDays : 0,
    maxDay: tendenciaData.daily.length ? Math.max(...tendenciaData.daily) : 0,
  }), [ventasFiltradas, tendenciaData.daily, dateRange.nDays, calcVal]);

  const mapaActividad = useMemo(() => {
    const { from, to } = dateRange;
    const dailyMap = new Map<string, number>();
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      const key = r.fecha.slice(0, 10);
      const add = metrica === 'operaciones' ? 1 : Number(r.monto) || 0;
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + add);
    }
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    const dow = cur.getDay();
    cur.setDate(cur.getDate() + (dow === 0 ? -6 : 1 - dow));
    const weeks: { valor: number; key: string }[][] = [];
    while (cur <= to) {
      const week: typeof weeks[0] = [];
      for (let d = 0; d < 7; d++) {
        const key = toLocalKey(cur);
        week.push({ valor: dailyMap.get(key) ?? 0, key });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return { weeks, maxVal: Math.max(...dailyMap.values(), 1) };
  }, [ventasFiltradas, dateRange, metrica]);

  const weeklyStats = useMemo(() => {
    const totals = mapaActividad.weeks
      .map((w, i) => ({ label: `Sem ${i + 1}`, total: w.reduce((s, d) => s + d.valor, 0) }))
      .filter(w => w.total > 0);
    if (!totals.length) return { totals, avg: 0, best: { label: '—', total: 0, vsAvg: 0 }, worst: { label: '—', total: 0, vsAvg: 0 }, withVsAvg: [] };
    const avg = totals.reduce((s, w) => s + w.total, 0) / totals.length;
    const withVsAvg = totals.map(w => ({
      ...w,
      vsAvg: avg > 0 ? ((w.total - avg) / avg) * 100 : 0
    }));
    return {
      totals, avg,
      best: { ...totals.reduce((a, b) => b.total > a.total ? b : a), vsAvg: avg > 0 ? ((totals.reduce((a, b) => b.total > a.total ? b : a).total - avg) / avg) * 100 : 0 },
      worst: { ...totals.reduce((a, b) => b.total < a.total ? b : a), vsAvg: avg > 0 ? ((totals.reduce((a, b) => b.total < a.total ? b : a).total - avg) / avg) * 100 : 0 },
      withVsAvg,
    };
  }, [mapaActividad]);

  const dowStats = useMemo(() => {
    const sums = Array<number>(7).fill(0);
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      let dow = toLocalDate(r.fecha).getDay();
      dow = dow === 0 ? 6 : dow - 1;
      sums[dow] += metrica === 'operaciones' ? 1 : Number(r.monto) || 0;
    }
    const max = Math.max(...sums, 0);
    return { sums, max, activeDay: DIAS_SEMANA[sums.indexOf(max)] ?? '—' };
  }, [ventasFiltradas, metrica]);

  const fmt = useCallback((v: number) => metrica === 'operaciones' ? String(v) : formatCurrency(v), [metrica]);
  const fmtK = useCallback((v: number) => metrica === 'operaciones' ? String(v) : `$${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 }).format(v / 1_000)}K`, [metrica]);

  const analistaOpts = useMemo(() => [
    { label: 'Todos', value: 'todos' },
    ...analisisAnalistas.map(a => ({ label: displayAnalista(a), value: a })),
  ], [analisisAnalistas]);

  const semanasPorAnalista = useMemo(() => {
    type Row = { weekKey: string; weekLabel: string; analistas: Record<string, number>; total: number };
    const byWeek = new Map<string, Record<string, number>>();
    for (const r of ventasFiltradas) {
      if (!r.fecha) continue;
      const d = toLocalDate(r.fecha);
      const dow = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      monday.setHours(0, 0, 0, 0);
      const weekKey = toLocalKey(monday);
      const val = metrica === 'operaciones' ? 1 : Number(r.monto) || 0;
      const analista = (r.analista ?? '').trim();
      if (!byWeek.has(weekKey)) byWeek.set(weekKey, {});
      const wk = byWeek.get(weekKey)!;
      wk[analista] = (wk[analista] ?? 0) + val;
    }
    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, data]): Row => {
        const [y, m, d] = weekKey.split('-').map(Number);
        const monday = new Date(y, m - 1, d);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const fd = (dt: Date) => `${dt.getDate()}/${dt.getMonth() + 1}`;
        const total = Object.values(data).reduce((s, v) => s + v, 0);
        return { weekKey, weekLabel: `${fd(monday)}–${fd(sunday)}/${sunday.getFullYear()}`, analistas: data, total };
      });
  }, [ventasFiltradas, metrica]);

  const heatColor = (val: number, max: number): string => {
    if (val === 0) return 'rgba(34,197,94,0.05)';
    const t = Math.min(val / max, 1);
    return `rgba(34, 197, 94, ${(0.15 + t * 0.5).toFixed(2)})`;
  };

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  // ========== DUPLICADOS HELPERS ==========
  interface GrupoDuplicado {
    key: string;
    tipo: 'cuil' | 'nombre';
    registros: any[];
  }

  const allEstados = useMemo(() =>
    Array.from(new Set(duplicadosRegistros.map(r => r.estado?.toLowerCase()).filter(Boolean)))
      .filter(e => !e?.toLowerCase().includes('column') && !e?.toLowerCase().includes('estado'))
      .sort() as string[],
    [duplicadosRegistros]
  );

  const allAnalistas = useMemo(() =>
    Array.from(new Set(duplicadosRegistros.map(r => r.analista?.trim()).filter(Boolean)))
      .filter(a => !a?.toLowerCase().includes('column') && !a?.toLowerCase().includes('analista'))
      .sort() as string[],
    [duplicadosRegistros]
  );

  const toggleFilter = (list: string[], set: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    if (list.includes(val)) set(list.filter(v => v !== val));
    else set([...list, val]);
  };

  const duplicados = useMemo((): GrupoDuplicado[] => {
    const grupos: GrupoDuplicado[] = [];
    const pool = duplicadosRegistros.filter(r => {
      const matchEstado = selectedEstados.length === 0 || selectedEstados.includes(r.estado?.toLowerCase() || '');
      const matchAnalista = selectedAnalistas.length === 0 || selectedAnalistas.includes(r.analista || '');
      return matchEstado && matchAnalista;
    });

    const byCuil = new Map<string, any[]>();
    for (const r of pool) {
      const cuil = r.cuil?.trim();
      if (!cuil || cuil.length < 11) continue;
      if (!byCuil.has(cuil)) byCuil.set(cuil, []);
      byCuil.get(cuil)!.push(r);
    }
    for (const [cuil, regs] of byCuil) {
      if (regs.length > 1) grupos.push({ key: cuil, tipo: 'cuil', registros: regs });
    }

    const byNombre = new Map<string, any[]>();
    for (const r of pool) {
      const nombre = r.nombre?.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');
      if (!nombre || nombre.length < 3) continue;
      if (!byNombre.has(nombre)) byNombre.set(nombre, []);
      byNombre.get(nombre)!.push(r);
    }
    for (const [nombre, regs] of byNombre) {
      if (regs.length > 1) {
        const existsInCuil = grupos.some(g => g.tipo === 'cuil' && g.registros.some(r => r.nombre?.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ') === nombre));
        if (!existsInCuil) grupos.push({ key: nombre, tipo: 'nombre', registros: regs });
      }
    }
    return grupos.sort((a, b) => b.registros.length - a.registros.length);
  }, [duplicadosRegistros, selectedEstados, selectedAnalistas]);

  const chipStyle = (isActive: boolean) => ({
    padding: '6px 14px', borderRadius: '6px', fontSize: '10px', border: '1px solid',
    whiteSpace: 'nowrap' as const, fontWeight: 800 as const, cursor: 'pointer', transition: 'all 0.2s',
    background: isActive ? '#fff' : 'rgba(255,255,255,0.02)',
    borderColor: isActive ? '#fff' : 'rgba(255,255,255,0.05)',
    color: isActive ? '#000' : 'var(--gris)',
    textTransform: 'uppercase' as const, letterSpacing: '1px'
  });

  return (
    <div className="dashboard-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '14px' }}>{toast.message}</span>
          </div>
        </div>
      )}

      <header className="dashboard-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gris)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
            <Settings size={14} /> Sistema
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>Ajustes</h1>
        </div>
      </header>

      {/* Nav Tabs */}
      <div className="toolbar" style={{ justifyContent: 'flex-start', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px', borderRadius: 0, background: 'transparent' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'alertas', label: 'Alertas', icon: Bell },
            { id: 'dias', label: 'Días Hábiles', icon: Clock },
            { id: 'historico', label: 'Histórico', icon: History },
            { id: 'objetivos', label: 'Objetivos', icon: Target },
            { id: 'analisis-temporal', label: 'Análisis Temporal', icon: Activity },
            { id: 'duplicados', label: 'Duplicados', icon: Copy },
            { id: 'auditoria', label: 'Auditoría', icon: Shield },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as ActiveTab)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', border: 'none',
                background: activeTab === t.id ? '#fff' : 'transparent',
                borderRadius: '6px',
                fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: activeTab === t.id ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                color: activeTab === t.id ? '#000' : 'var(--gris)',
              }}
            >
              <t.icon size={15} style={{ opacity: activeTab === t.id ? 1 : 0.7 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-container" style={{ minHeight: '400px' }}>
          <div className="spinner" />
          <span style={{ color: '#555' }}>Cargando configuración...</span>
        </div>
      ) : (
        <div style={{ width: '100%' }}>

          {/* TAB: ALERTAS */}
          {activeTab === 'alertas' && (
            <div className="data-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Gestión de Alertas</h3>
                  <p style={{ fontSize: '13px', color: 'var(--gris)', marginTop: '4px' }}>Parámetros de vencimiento y colores de indicadores</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-secondary" onClick={resetAlertas} style={{ fontSize: '12px' }}>
                    <RotateCcw size={14} /> Restaurar
                  </button>
                  <button className="btn-primary" onClick={saveAlertas} disabled={saving} style={{ fontSize: '12px' }}>
                    <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ color: '#444' }}>Tipo de Alerta</th>
                      <th style={{ color: '#444' }}>Estado Aplicado</th>
                      <th style={{ color: '#444' }}>Días Límite</th>
                      <th style={{ color: '#444' }}>Identificador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertasConfig.map((alerta, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ fontWeight: 600, fontSize: '14px' }}>{alerta.nombre}</td>
                        <td><span className="status-badge" style={{ background: 'rgba(255,255,255,0.03)', color: '#888' }}>{alerta.estado}</span></td>
                        <td>
                          <input
                            className="form-input"
                            type="number"
                            style={{
                              width: '100px',
                              textAlign: 'center',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '4px'
                            }}
                            value={alerta.dias}
                            onChange={e => {
                              const updated = [...alertasConfig];
                              updated[idx] = { ...updated[idx], dias: Number(e.target.value) };
                              setAlertasConfig(updated);
                            }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: alerta.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                            <input
                              className="form-input"
                              type="text"
                              value={alerta.color}
                              style={{ width: '90px', fontSize: '11px', fontFamily: 'monospace' }}
                              onChange={e => {
                                const updated = [...alertasConfig];
                                updated[idx] = { ...updated[idx], color: e.target.value };
                                setAlertasConfig(updated);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: DIAS HABILES */}
          {activeTab === 'dias' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {['Todos', ...CONFIG.ANALISTAS_DEFAULT].map(analista => {
                const entry = diasValues[analista] || { dias_habiles: 22, dias_transcurridos: 0 };
                return (
                  <div key={analista} className="data-card" style={{ padding: '24px', background: '#0a0a0a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h4 style={{ fontWeight: 800, fontSize: '16px' }}>{analista === 'Todos' ? 'Punto de Venta' : analista}</h4>
                      <Clock size={14} color="#333" />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#555', fontSize: '11px' }}>Días Hábiles</label>
                        <input
                          className="form-input"
                          type="number" step="0.5"
                          value={entry.dias_habiles}
                          onChange={e => updateDias(analista, 'dias_habiles', e.target.value)}
                          style={{ height: '42px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#555', fontSize: '11px' }}>Días Transcurridos</label>
                        <input
                          className="form-input"
                          type="number" step="0.5"
                          value={entry.dias_transcurridos}
                          onChange={e => updateDias(analista, 'dias_transcurridos', e.target.value)}
                          style={{ height: '42px' }}
                        />
                      </div>
                      <button
                        className="btn-primary"
                        style={{ width: '100%', justifyContent: 'center', height: '42px', marginTop: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={() => saveDiasHabiles(analista)}
                        disabled={savingDias === analista}
                      >
                        {savingDias === analista ? '...' : <Save size={14} />}
                        <span>{savingDias === analista ? 'Guardando' : 'Actualizar'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: HISTORICO */}
          {activeTab === 'historico' && (
            <div className="data-card" style={{ background: '#0a0a0a' }}>
              <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Histórico de Desempeño</h3>
                  <p style={{ fontSize: '13px', color: 'var(--gris)', marginTop: '4px' }}>Control de objetivos y resultados de períodos anteriores</p>
                </div>
                <button className="btn-primary" onClick={saveHistorico} disabled={savingHist}>
                  <Save size={14} /> {savingHist ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>

              {/* Selectors */}
              <div style={{ display: 'flex', gap: '32px', marginBottom: '32px', padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ color: 'var(--gris)', marginBottom: '12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seleccionar Analista</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['PDV', ...CONFIG.ANALISTAS_DEFAULT].map(a => (
                      <button key={a} onClick={() => setHistAnalista(a)} style={{
                        padding: '10px 20px', borderRadius: '6px', border: '1px solid',
                        fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                        borderColor: histAnalista === a ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)',
                        background: histAnalista === a ? '#fff' : 'transparent',
                        color: histAnalista === a ? '#000' : 'var(--gris)',
                      }}>{a}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ color: 'var(--gris)', marginBottom: '12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Año</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 1 - i).map(y => (
                      <button key={y} onClick={() => setHistAnio(y)} style={{
                        padding: '10px 16px', borderRadius: '6px', border: '1px solid',
                        fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                        borderColor: histAnio === y ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)',
                        background: histAnio === y ? '#fff' : 'transparent',
                        color: histAnio === y ? '#000' : 'var(--gris)',
                      }}>{y}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ border: '1px solid rgba(255,255,255,0.03)' }}>
                  <thead>
                    <tr>
                      <th style={{ color: 'var(--gris)', width: '120px', fontSize: '11px' }}>MES</th>
                      <th style={{ color: 'var(--gris)', opacity: 0.8, fontSize: '11px' }}>METAS CAPITAL ($)</th>
                      <th style={{ color: 'var(--gris)', opacity: 0.8, fontSize: '11px' }}>METAS OPS</th>
                      <th style={{ color: '#fff', opacity: 0.9, fontSize: '11px' }}>REAL CAPITAL ($)</th>
                      <th style={{ color: '#fff', opacity: 0.9, fontSize: '11px' }}>REAL OPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONFIG.MESES_NOMBRES.map((mes, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', height: '54px' }}>
                        <td style={{ fontWeight: 800, fontSize: '12px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{mes}</td>
                        <td>
                          <input
                            className="form-input" type="number"
                            style={{
                              width: '140px',
                              background: 'rgba(255,255,255,0.01)',
                              border: 'none',
                              borderBottom: '1.5px solid rgba(255,255,255,0.1)',
                              borderRadius: 0,
                              padding: '8px 4px'
                            }}
                            placeholder="-"
                            value={histRows[idx].meta_ventas}
                            onChange={e => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], meta_ventas: e.target.value }; return next;
                            })}
                            onPaste={e => parsePaste(e, v => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], meta_ventas: v }; return next;
                            }))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input" type="number"
                            style={{ width: '80px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', borderRadius: 0, textAlign: 'center' }}
                            placeholder="-"
                            value={histRows[idx].meta_operaciones}
                            onChange={e => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], meta_operaciones: e.target.value }; return next;
                            })}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input" type="number"
                            style={{
                              width: '140px',
                              background: 'rgba(255,255,255,0.02)',
                              border: 'none',
                              borderBottom: '1.5px solid rgba(255,255,255,0.15)',
                              borderRadius: 0,
                              padding: '8px 4px'
                            }}
                            placeholder="-"
                            value={histRows[idx].capital_real}
                            onChange={e => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], capital_real: e.target.value }; return next;
                            })}
                            onPaste={e => parsePaste(e, v => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], capital_real: v }; return next;
                            }))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input" type="number"
                            style={{
                              width: '100px',
                              background: 'rgba(255,255,255,0.02)',
                              border: 'none',
                              borderBottom: '1.5px solid rgba(255,255,255,0.15)',
                              borderRadius: 0,
                              textAlign: 'center',
                              padding: '8px 4px'
                            }}
                            placeholder="-"
                            value={histRows[idx].ops_real}
                            onChange={e => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], ops_real: e.target.value }; return next;
                            })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: OBJETIVOS */}
          {activeTab === 'objetivos' && (
            <div>
              <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Metas y Objetivos</h2>
                  <p style={{ fontSize: '13px', color: '#555' }}>Configurá los objetivos mensuales por analista</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <CustomSelect
                    options={[2024, 2025, 2026, 2027].map(y => ({ label: String(y), value: y }))}
                    value={objetivosAnio}
                    onChange={setObjetivosAnio}
                    width="110px"
                  />
                  <CustomSelect
                    options={ANALISTAS.map(a => ({ label: a === 'PDV' ? 'Punto de Venta' : a, value: a }))}
                    value={objetivosAnalista}
                    onChange={setObjetivosAnalista}
                    width="140px"
                  />
                  <button className="btn-primary" style={{ height: '38px', padding: '0 20px' }} onClick={saveObjetivos} disabled={savingObj}>
                    {savingObj ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <Save size={16} />}
                    <span style={{ marginLeft: '8px' }}>Guardar Todo</span>
                  </button>
                </div>
              </header>

              <div className="data-card">
                <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 className="data-card-title">{objetivosAnalista === 'PDV' ? 'Punto de Venta' : objetivosAnalista}</h3>
                  <button className="btn-secondary" style={{ fontSize: '11px', padding: '6px 14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }} onClick={() => resetAnalista(objetivosAnalista)}>
                    Resetear a 0
                  </button>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Meta Ventas ($)</th>
                      <th>Meta Operaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 12 }, (_, mes) => {
                      const obj = objetivos.find(o => o.analista === objetivosAnalista && o.mes === mes);
                      return (
                        <tr key={mes}>
                          <td style={{ fontWeight: 600 }}>{CONFIG.MESES_NOMBRES[mes]}</td>
                          <td>
                            <input className="form-input" type="number" style={{ width: '180px' }}
                              value={obj?.meta_ventas || 0}
                              onChange={e => updateObjetivoValue(objetivosAnalista, mes, 'meta_ventas', Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <input className="form-input" type="number" style={{ width: '120px' }}
                              value={obj?.meta_operaciones || 0}
                              onChange={e => updateObjetivoValue(objetivosAnalista, mes, 'meta_operaciones', Number(e.target.value))}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: ANALISIS TEMPORAL */}
          {activeTab === 'analisis-temporal' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {/* Filters Header Card */}
              <div style={{
                background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: '8px',
                padding: '24px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '40px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '4px', height: '24px', borderRadius: '2px', background: '#fff' }} />
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Análisis Temporal</h2>
                    <p style={{ fontSize: '12px', color: 'var(--gris)', marginTop: '2px' }}>Exploración de datos por períodos y métricas</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Período', node: <CustomSelect options={PERIODOS} value={periodo} onChange={setPeriodo} width="160px" /> },
                    { label: 'Analista', node: <CustomSelect options={analistaOpts} value={analistaFil} onChange={setAnalistaFil} width="160px" /> },
                    { label: 'Métrica', node: <CustomSelect options={METRICAS} value={metrica} onChange={setMetrica} width="160px" /> },
                  ].map(f => (
                    <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{f.label}</div>
                      {f.node}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tendencia + Mapa */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
                {/* Tendencia */}
                <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tendencia</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>Acumulado por día — {periodoLabel}</div>
                  </div>
                  <div style={{ height: 320, flex: 1 }}>
                    <Line
                      data={{
                        labels: tendenciaData.labels,
                        datasets: [
                          {
                            label: metrica === 'ventas' ? 'Acumulado' : metrica === 'operaciones' ? 'Operaciones' : 'Ticket Prom.',
                            data: tendenciaData.values,
                            borderColor: 'rgba(34,197,94,0.8)',
                            backgroundColor: 'rgba(34,197,94,0.1)',
                            borderWidth: 2,
                            pointRadius: 4,
                            pointBackgroundColor: 'rgba(34,197,94,0.9)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1.5,
                            pointHoverRadius: 6,
                            fill: true,
                            tension: 0.3,
                            spanGaps: false,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (ctx: any) => fmt(ctx.parsed.y ?? 0),
                            },
                          },
                        },
                        scales: {
                          x: {
                            ticks: {
                              color: '#555',
                              maxTicksLimit: 20,
                              font: { size: 10 },
                              autoSkipPadding: 4,
                            },
                            grid: { color: 'rgba(255,255,255,0.03)' },
                          },
                          y: {
                            ticks: { color: '#555', callback: (v: any) => fmtK(Number(v)), font: { size: 10 } },
                            grid: { color: 'rgba(255,255,255,0.03)' },
                          },
                        },
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 24, marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>{fmt(summary.total)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROMEDIO</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>{metrica === 'operaciones' ? summary.avg.toFixed(1) : formatCurrency(summary.avg)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>MÁXIMO DÍA</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>{fmt(summary.maxDay)}</div>
                    </div>
                  </div>
                </div>

                {/* Mapa de actividad */}
                <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mapa de Actividad</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>Ventas por día — {periodoLabel}</div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%' }}>
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
                        {mapaActividad.weeks.slice(0, 6).map((week, wi) => {
                          const weekTotal = week.reduce((s, d) => s + d.valor, 0);
                          return (
                            <tr key={wi}>
                              <td style={{ fontSize: 10, color: '#444', fontWeight: 600, paddingRight: 6, textAlign: 'right' }}>S{wi + 1}</td>
                              {week.map((day, di) => (
                                <td
                                  key={di}
                                  title={`${day.key}: ${fmt(day.valor)}`}
                                  style={{
                                    background: heatColor(day.valor, mapaActividad.maxVal),
                                    borderRadius: 4, height: 44,
                                    textAlign: 'center', fontSize: 10,
                                    color: day.valor > 0 ? '#86efac' : '#333',
                                    fontWeight: day.valor > 0 ? 600 : 400,
                                    border: day.key === todayKey ? '1px solid rgba(247,228,121,0.6)' : 'none',
                                    padding: '0 4px', cursor: 'default', minWidth: 44,
                                  }}
                                >
                                  {day.valor > 0 ? fmtK(day.valor) : ''}
                                </td>
                              ))}
                              <td style={{ fontSize: 11, color: '#fff', fontWeight: 700, textAlign: 'right', paddingLeft: 8 }}>
                                {fmtK(weekTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: 24, marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>DÍA MÁS ACTIVO</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 2 }}>{dowStats.activeDay}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 2 }}>{fmt(summary.total)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estacionalidad */}
              <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '24px', marginBottom: '32px' }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estacionalidad</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>Patrones por semana</div>
                    </div>
                  </div>
                </div>

                {/* Cards + Gráfico */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'stretch' }}>
                  {/* Cards de semanas */}
                  {weeklyStats.withVsAvg.map((w) => (
                    <div key={w.label} style={{
                      flex: '1 1 130px',
                      minWidth: 120,
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>{w.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{fmt(w.total)}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: w.vsAvg >= 0 ? '#22c55e' : '#ef4444', marginTop: '10px', background: w.vsAvg >= 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                        {w.vsAvg >= 0 ? '↑' : '↓'} {Math.abs(w.vsAvg).toFixed(1)}%
                      </div>
                    </div>
                  ))}

                  {/* Gráfico */}
                  <div style={{ flex: '2 1 300px', minWidth: 280, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px', minHeight: 180 }}>
                    <Bar
                      data={{
                        labels: weeklyStats.totals.map(s => s.label),
                        datasets: [{
                          label: metrica === 'operaciones' ? 'Operaciones' : 'Total',
                          data: weeklyStats.totals.map(s => s.total),
                          backgroundColor: weeklyStats.totals.map(s =>
                            s.label === weeklyStats.best.label
                              ? 'rgba(34,197,94,0.6)'
                              : 'rgba(239,68,68,0.4)'
                          ),
                          borderRadius: 4,
                          borderSkipped: false,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: { label: (ctx: any) => fmt(ctx.parsed.y ?? 0) },
                          },
                        },
                        scales: {
                          x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                          y: {
                            ticks: { color: '#555', callback: (v: any) => fmtK(Number(v)), font: { size: 9 } },
                            grid: { color: 'rgba(255,255,255,0.03)' },
                          },
                        },
                      }}
                    />
                  </div>
                </div>

                {/* Fila inferior: Mejor, Peor, Variación */}
                <div style={{ display: 'flex', gap: 24, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
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
                      {weeklyStats.best.total > 0 && weeklyStats.worst.total > 0
                        ? `${((weeklyStats.best.total / weeklyStats.worst.total - 1) * 100).toFixed(1)}%`
                        : '—'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Semanas por analista */}
              <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '24px', marginBottom: '32px' }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Semanas por Analista</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>PDV · Luciana · Victoria — {periodoLabel}</div>
                </div>
                {semanasPorAnalista.length === 0
                  ? <p style={{ fontSize: 13, color: '#555', textAlign: 'center', padding: '32px 0' }}>Sin datos en el período seleccionado.</p>
                  : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', color: '#555', fontWeight: 700, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>Semana</th>
                            {ANALISTAS_VIEW.map(a => (
                              <th key={a} style={{ textAlign: 'right', color: '#555', fontWeight: 700, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{a}</th>
                            ))}
                            <th style={{ textAlign: 'right', color: '#888', fontWeight: 800, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {semanasPorAnalista.map((row, i) => (
                            <tr key={row.weekKey} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                              <td style={{ color: '#999', padding: '7px 12px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{row.weekLabel}</td>
                              {ANALISTAS_VIEW.map(a => (
                                <td key={a} style={{ textAlign: 'right', color: row.analistas[a] ? '#fff' : '#333', fontWeight: row.analistas[a] ? 700 : 400, padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}>
                                  {row.analistas[a] ? fmtK(row.analistas[a]) : '—'}
                                </td>
                              ))}
                              <td style={{ textAlign: 'right', color: '#86efac', fontWeight: 800, padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}>{fmtK(row.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td style={{ color: '#555', fontWeight: 700, padding: '10px 12px', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>Total</td>
                            {ANALISTAS_VIEW.map(a => {
                              const t = semanasPorAnalista.reduce((s, r) => s + (r.analistas[a] ?? 0), 0);
                              return <td key={a} style={{ textAlign: 'right', color: t > 0 ? '#fff' : '#333', fontWeight: 800, padding: '10px 12px', fontVariantNumeric: 'tabular-nums' }}>{t > 0 ? fmtK(t) : '—'}</td>;
                            })}
                            <td style={{ textAlign: 'right', color: '#86efac', fontWeight: 900, padding: '10px 12px', fontVariantNumeric: 'tabular-nums' }}>{fmtK(semanasPorAnalista.reduce((s, r) => s + r.total, 0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                }
              </div>

              {/* Por día de semana */}
              <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '24px' }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Por Día de Semana</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 4, marginLeft: 11 }}>Rendimiento en $</div>
                </div>
                <div style={{ height: 200 }}>
                  <Bar
                    data={{
                      labels: DIAS_SEMANA,
                      datasets: [{
                        label: metrica === 'operaciones' ? 'Operaciones' : 'Total',
                        data: dowStats.sums,
                        backgroundColor: dowStats.sums.map(v =>
                          v >= dowStats.max * 0.9
                            ? 'rgba(34,197,94,0.6)'
                            : 'rgba(34,197,94,0.2)'
                        ),
                        borderRadius: 4,
                        borderSkipped: false,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: { label: (ctx: any) => fmt(ctx.parsed.y ?? 0) },
                        },
                      },
                      scales: {
                        x: { ticks: { color: '#555', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                        y: {
                          ticks: { color: '#555', callback: (v: any) => fmtK(Number(v)), font: { size: 10 } },
                          grid: { color: 'rgba(255,255,255,0.03)' },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: DUPLICADOS */}
          {activeTab === 'duplicados' && (
            <div>
              <header className="dashboard-header" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: 'var(--azul)' }} />
                  <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Detección de Duplicados</h2>
                </div>
                {duplicados.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#999', fontWeight: 700 }}>
                    {duplicados.length} duplicados potenciales encontrados
                  </div>
                )}
              </header>

              {/* Toolbar */}
              <div className="toolbar-container" style={{ marginBottom: '24px', padding: '16px 20px', background: '#000', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <ShieldCheck size={13} color="var(--azul)" />
                      <span style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase' }}>Estados</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0', scrollbarWidth: 'none', flex: 1 }}>
                      {allEstados.map(e => (
                        <button key={e} onClick={() => toggleFilter(selectedEstados, setSelectedEstados, e)} style={chipStyle(selectedEstados.includes(e))}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={13} color="var(--azul)" />
                      <span style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase' }}>Analistas</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {allAnalistas.map(a => (
                        <button key={a} onClick={() => toggleFilter(selectedAnalistas, setSelectedAnalistas, a)} style={chipStyle(selectedAnalistas.includes(a))}>
                          {displayAnalista(a)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {duplicados.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle size={40} color="var(--verde)" style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ color: 'var(--verde)', fontWeight: 800, fontSize: '14px' }}>POOL LIMPIO</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {duplicados.map(grupo => (
                    <div key={grupo.key} className="data-card" style={{ borderLeft: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AlertTriangle size={15} color="#ef4444" />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>
                            {grupo.tipo === 'cuil' ? grupo.key : grupo.registros[0].nombre?.toUpperCase()}
                          </div>
                          <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase' }}>
                            {grupo.registros.length} duplicados • filtrado por {grupo.tipo}
                          </div>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>Cliente / Identificación</th>
                              <th style={{ textAlign: 'left' }}>Analista</th>
                              <th style={{ textAlign: 'left' }}>Estado</th>
                              <th style={{ textAlign: 'right' }}>Monto</th>
                              <th style={{ textAlign: 'center' }}>Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.registros.map((r: any) => (
                              <tr key={r.id}>
                                <td style={{ padding: '8px 16px' }}>
                                  <div style={{ fontWeight: 700, color: '#fff' }}>{r.nombre}</div>
                                  <div style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace', marginTop: '2px' }}>{r.cuil}</div>
                                </td>
                                <td style={{ color: 'var(--gris)', fontSize: '12px', fontWeight: 500 }}>{displayAnalista(r.analista)}</td>
                                <td>
                                  <span className="status-badge" style={{ fontSize: '9px', padding: '2px 8px' }}>{r.estado}</span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 800, color: '#fff' }}>{formatCurrency(r.monto)}</td>
                                <td style={{ textAlign: 'center', color: '#888', fontSize: '11px', fontWeight: 500 }}>{r.fecha ? formatDate(r.fecha) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: AUDITORIA */}
          {activeTab === 'auditoria' && (() => {
            // — helpers —
            const relativeTime = (iso: string) => {
              if (!iso) return '';
              const diff = Date.now() - new Date(iso).getTime();
              const mins = Math.floor(diff / 60000);
              if (mins < 1) return 'Ahora';
              if (mins < 60) return `Hace ${mins} min`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `Hace ${hrs}h`;
              const days = Math.floor(hrs / 24);
              if (days < 7) return `Hace ${days}d`;
              return formatDateTime(iso);
            };

            const accionIcon = (accion: string) => {
              switch (accion) {
                case 'Creación': return <Plus size={12} />;
                case 'Eliminación': return <Trash2 size={12} />;
                case 'Recordatorio creado': return <Bell size={12} />;
                case 'Recordatorio completado': return <CheckCircle size={12} />;
                default: return <Edit3 size={12} />;
              }
            };
            const accionColor = (accion: string) => {
              if (accion === 'Creación') return { bg: 'rgba(34,197,94,0.08)', color: '#22c55e', border: 'rgba(34,197,94,0.15)' };
              if (accion === 'Eliminación') return { bg: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'rgba(239,68,68,0.15)' };
              if (accion.includes('Recordatorio')) return { bg: 'rgba(168,85,247,0.08)', color: '#a855f7', border: 'rgba(168,85,247,0.15)' };
              return { bg: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: 'rgba(251,191,36,0.15)' };
            };

            // — filtering —
            const now = Date.now();
            const periodoMs: Record<string, number> = { 'hoy': 86400000, '7d': 604800000, '30d': 2592000000, 'todo': Infinity };
            const cutoff = now - (periodoMs[auditFilterPeriodo] || Infinity);

            const allAcciones = [...new Set((auditoriaRegistros || []).map((r: any) => r.accion).filter(Boolean))];
            const allAuditAnalistas = [...new Set((auditoriaRegistros || []).map((r: any) => r.analista).filter(Boolean))];

            const filtered = (auditoriaRegistros || []).filter((reg: any) => {
              if (auditFilterAccion !== 'todas' && reg.accion !== auditFilterAccion) return false;
              if (auditFilterAnalista !== 'todos' && reg.analista !== auditFilterAnalista) return false;
              if (reg.fecha_hora && new Date(reg.fecha_hora).getTime() < cutoff) return false;
              if (auditSearch) {
                const q = auditSearch.toLowerCase();
                const hay = [reg.analista, reg.accion, reg.campo_modificado, reg.valor_nuevo, reg.valor_anterior, reg.id_registro]
                  .filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
                if (!hay) return false;
              }
              return true;
            });

            const totalPages = Math.max(1, Math.ceil(filtered.length / AUDIT_PAGE_SIZE));
            const safePage = Math.min(auditPage, totalPages);
            const paged = filtered.slice((safePage - 1) * AUDIT_PAGE_SIZE, safePage * AUDIT_PAGE_SIZE);

            // — KPI stats —
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const todayCount = (auditoriaRegistros || []).filter((r: any) => r.fecha_hora && new Date(r.fecha_hora) >= todayStart).length;
            const creaciones = (auditoriaRegistros || []).filter((r: any) => r.accion === 'Creación').length;
            const ediciones = (auditoriaRegistros || []).filter((r: any) => !['Creación', 'Eliminación'].includes(r.accion) && !r.accion?.includes('Recordatorio')).length;
            const eliminaciones = (auditoriaRegistros || []).filter((r: any) => r.accion === 'Eliminación').length;
            const recordatorios = (auditoriaRegistros || []).filter((r: any) => r.accion?.includes('Recordatorio')).length;

            const analystCounts: Record<string, number> = {};
            (auditoriaRegistros || []).forEach((r: any) => { if (r.analista) analystCounts[r.analista] = (analystCounts[r.analista] || 0) + 1; });
            const topAnalyst = Object.entries(analystCounts).sort((a, b) => b[1] - a[1])[0];

            // — CSV export —
            const exportCSV = () => {
              const headers = ['Fecha/Hora', 'ID Registro', 'Analista', 'Acción', 'Campo Modificado', 'Valor Anterior', 'Valor Nuevo'];
              const rows = filtered.map((r: any) => [
                r.fecha_hora || '', r.id_registro || '', r.analista || '', r.accion || '',
                r.campo_modificado || '', r.valor_anterior || '', r.valor_nuevo || ''
              ]);
              const csv = [headers, ...rows].map(r => r.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click(); URL.revokeObjectURL(url);
            };

            return (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {/* HEADER */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 4, height: 28, borderRadius: 2, background: '#fff' }} />
                    <div>
                      <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Log de Auditoría</h1>
                      <p style={{ fontSize: '12px', color: '#555', marginTop: 2 }}>Registro completo de actividad del sistema en tiempo real</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={exportCSV} disabled={!filtered.length} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6,
                      fontSize: '11px', fontWeight: 700, border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)', color: '#888', cursor: filtered.length ? 'pointer' : 'not-allowed',
                      opacity: filtered.length ? 1 : 0.4, transition: 'all 0.2s',
                    }}><Download size={13} /> Exportar CSV</button>
                    <button onClick={limpiarLogAuditoria}
                      disabled={limpiandoLog || !auditoriaRegistros?.length}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6,
                        fontSize: '11px', fontWeight: 700, border: 'none',
                        cursor: (limpiandoLog || !auditoriaRegistros?.length) ? 'not-allowed' : 'pointer',
                        background: limpiandoLog ? 'rgba(220,53,69,0.5)' : 'rgba(220,53,69,0.1)',
                        color: limpiandoLog ? '#888' : '#ef4444',
                        opacity: (limpiandoLog || !auditoriaRegistros?.length) ? 0.4 : 1, transition: 'all 0.2s',
                      }}>
                      <Trash2 size={13} /> {limpiandoLog ? 'Limpiando...' : 'Limpiar Todo'}
                    </button>
                  </div>
                </header>

                {/* KPI CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'TOTAL EVENTOS', value: (auditoriaRegistros || []).length, icon: <BarChart3 size={14} />, accent: '#fff' },
                    { label: 'HOY', value: todayCount, icon: <Calendar size={14} />, accent: '#22c55e' },
                    { label: 'CREACIONES', value: creaciones, icon: <Plus size={14} />, accent: '#22c55e' },
                    { label: 'EDICIONES', value: ediciones, icon: <Edit3 size={14} />, accent: '#fbbf24' },
                    { label: 'ELIMINACIONES', value: eliminaciones, icon: <Trash2 size={14} />, accent: '#ef4444' },
                    { label: 'RECORDATORIOS', value: recordatorios, icon: <Bell size={14} />, accent: '#a855f7' },
                  ].map(kpi => (
                    <div key={kpi.label} style={{
                      background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6,
                      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#555', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{kpi.label}</span>
                        <span style={{ color: kpi.accent, opacity: 0.6 }}>{kpi.icon}</span>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: kpi.accent, letterSpacing: '-1px' }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* TOP ANALYST STRIP */}
                {topAnalyst && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', marginBottom: 20,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6,
                  }}>
                    <User size={13} color="#555" />
                    <span style={{ fontSize: '11px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Analista más activo:</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>{topAnalyst[0]}</span>
                    <span style={{ fontSize: '11px', color: '#555' }}>({topAnalyst[1]} eventos)</span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: '10px', color: '#333' }}>{allAuditAnalistas.length} analistas registrados</span>
                  </div>
                )}

                {/* FILTERS TOOLBAR */}
                <div style={{
                  background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6,
                  padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end',
                }}>
                  {/* Search */}
                  <div style={{ flex: '1 1 220px', minWidth: 180 }}>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Buscar</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
                      <input
                        value={auditSearch} onChange={e => { setAuditSearch(e.target.value); setAuditPage(1); }}
                        placeholder="Cliente, analista, acción..."
                        style={{
                          width: '100%', padding: '8px 10px 8px 32px', background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, color: '#ccc',
                          fontSize: '12px', fontFamily: "'Outfit', sans-serif", outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Acción */}
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Acción</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['todas', ...allAcciones].map(a => (
                        <button key={a} onClick={() => { setAuditFilterAccion(a); setAuditPage(1); }} style={{
                          padding: '5px 10px', borderRadius: 4, border: '1px solid',
                          fontSize: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                          fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap',
                          borderColor: auditFilterAccion === a ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.04)',
                          background: auditFilterAccion === a ? '#fff' : 'transparent',
                          color: auditFilterAccion === a ? '#000' : '#666',
                        }}>{a === 'todas' ? 'Todas' : a}</button>
                      ))}
                    </div>
                  </div>

                  {/* Analista */}
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Analista</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['todos', ...allAuditAnalistas].map(a => (
                        <button key={a} onClick={() => { setAuditFilterAnalista(a); setAuditPage(1); }} style={{
                          padding: '5px 10px', borderRadius: 4, border: '1px solid',
                          fontSize: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                          fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap',
                          borderColor: auditFilterAnalista === a ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.04)',
                          background: auditFilterAnalista === a ? '#fff' : 'transparent',
                          color: auditFilterAnalista === a ? '#000' : '#666',
                        }}>{a === 'todos' ? 'Todos' : a}</button>
                      ))}
                    </div>
                  </div>

                  {/* Período */}
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Período</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[{ k: 'hoy', l: 'Hoy' }, { k: '7d', l: '7 días' }, { k: '30d', l: '30 días' }, { k: 'todo', l: 'Todo' }].map(p => (
                        <button key={p.k} onClick={() => { setAuditFilterPeriodo(p.k); setAuditPage(1); }} style={{
                          padding: '5px 10px', borderRadius: 4, border: '1px solid',
                          fontSize: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                          fontFamily: "'Outfit', sans-serif",
                          borderColor: auditFilterPeriodo === p.k ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.04)',
                          background: auditFilterPeriodo === p.k ? '#fff' : 'transparent',
                          color: auditFilterPeriodo === p.k ? '#000' : '#666',
                        }}>{p.l}</button>
                      ))}
                    </div>
                  </div>

                  {/* Results Count */}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '11px', color: '#444', fontWeight: 600 }}>
                      {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* DATA TABLE */}
                <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'hidden' }}>
                  {auditoriaLoading ? (
                    <div className="loading-container" style={{ minHeight: 200 }}><div className="spinner" /><span>Cargando registros...</span></div>
                  ) : !filtered.length ? (
                    <div className="empty-state" style={{ minHeight: 200 }}>
                      <Shield size={36} color="#333" style={{ marginBottom: 8 }} />
                      <p style={{ fontWeight: 800, fontSize: '13px', color: '#444' }}>{auditSearch || auditFilterAccion !== 'todas' || auditFilterAnalista !== 'todos' || auditFilterPeriodo !== 'todo' ? 'Sin resultados para los filtros aplicados' : 'No hay registros de auditoría'}</p>
                      <p style={{ fontSize: '11px', color: '#333', marginTop: 4 }}>Las acciones del sistema aparecerán aquí automáticamente.</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ marginBottom: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 40, textAlign: 'center', padding: '10px 8px' }} />
                              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 14px' }}>Fecha / Hora</th>
                              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 14px' }}>Analista</th>
                              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 14px' }}>Acción</th>
                              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 14px' }}>Campo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paged.map((reg: any, idx: number) => {
                              const rowKey = reg.id ?? `${reg.fecha_hora}-${idx}`;
                              const isExpanded = auditExpandedRow === rowKey;
                              const ac = accionColor(reg.accion);
                              return (
                                <React.Fragment key={rowKey}>
                                  <tr
                                    onClick={() => setAuditExpandedRow(isExpanded ? null : rowKey)}
                                    style={{
                                      cursor: 'pointer', transition: 'background 0.15s',
                                      background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                                      borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.03)',
                                    }}
                                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
                                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                  >
                                    <td style={{ textAlign: 'center', padding: '10px 8px', verticalAlign: 'middle' }}>
                                      <ChevronRight size={12} color="#444" style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                                    </td>
                                    <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#ccc' }}>{formatDateTime(reg.fecha_hora)}</div>
                                      <div style={{ fontSize: '10px', color: '#444', marginTop: 1 }}>{relativeTime(reg.fecha_hora)}</div>
                                    </td>
                                    <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <User size={11} color="#666" />
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#ccc' }}>{reg.analista || '—'}</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                        padding: '4px 10px', borderRadius: 4, fontSize: '10px', fontWeight: 700,
                                        background: ac.bg, color: ac.color, border: `1px solid ${ac.border}`,
                                        letterSpacing: '0.3px',
                                      }}>
                                        {accionIcon(reg.accion)}
                                        {reg.accion}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', verticalAlign: 'middle', fontSize: '12px', color: '#888' }}>
                                      {reg.campo_modificado || '—'}
                                    </td>
                                  </tr>

                                  {/* EXPANDED DETAIL ROW */}
                                  {isExpanded && (
                                    <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                                      <td colSpan={5} style={{ padding: '0 14px 16px 54px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{
                                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                          gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
                                          borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)',
                                        }}>
                                          <div>
                                            <div style={{ fontSize: '9px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>ID Completo</div>
                                            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#888', wordBreak: 'break-all' }}>{reg.id_registro || '—'}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '9px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Analista (ID)</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>{reg.id_analista || reg.analista || '—'}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '9px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Timestamp</div>
                                            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#888' }}>{reg.fecha_hora || '—'}</div>
                                          </div>
                                          {reg.valor_anterior && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                              <div style={{ fontSize: '9px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Valor Anterior</div>
                                              <div style={{ fontSize: '11px', color: '#999', padding: '8px 12px', background: 'rgba(239,68,68,0.04)', borderRadius: 4, border: '1px solid rgba(239,68,68,0.08)', wordBreak: 'break-all' }}>{reg.valor_anterior}</div>
                                            </div>
                                          )}
                                          {reg.valor_nuevo && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                              <div style={{ fontSize: '9px', fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Valor Nuevo</div>
                                              <div style={{ fontSize: '11px', color: '#999', padding: '8px 12px', background: 'rgba(34,197,94,0.04)', borderRadius: 4, border: '1px solid rgba(34,197,94,0.08)', wordBreak: 'break-all' }}>{reg.valor_nuevo}</div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* PAGINATION */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.04)',
                      }}>
                        <span style={{ fontSize: '11px', color: '#444' }}>
                          Mostrando {(safePage - 1) * AUDIT_PAGE_SIZE + 1}–{Math.min(safePage * AUDIT_PAGE_SIZE, filtered.length)} de {filtered.length}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} style={{
                            width: 30, height: 30, borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.03)', color: safePage <= 1 ? '#333' : '#888',
                            cursor: safePage <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}><ChevronLeft size={14} /></button>
                          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let page: number;
                            if (totalPages <= 5) page = i + 1;
                            else if (safePage <= 3) page = i + 1;
                            else if (safePage >= totalPages - 2) page = totalPages - 4 + i;
                            else page = safePage - 2 + i;
                            return (
                              <button key={page} onClick={() => setAuditPage(page)} style={{
                                width: 30, height: 30, borderRadius: 4, border: '1px solid',
                                fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                fontFamily: "'Outfit', sans-serif",
                                borderColor: safePage === page ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                                background: safePage === page ? '#fff' : 'rgba(255,255,255,0.03)',
                                color: safePage === page ? '#000' : '#666',
                              }}>{page}</button>
                            );
                          })}
                          <button onClick={() => setAuditPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{
                            width: 30, height: 30, borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.03)', color: safePage >= totalPages ? '#333' : '#888',
                            cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}><ChevronRight size={14} /></button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Info del sistema */}
          <footer style={{ marginTop: '48px', padding: '24px', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '24px' }}>
              <span style={{ fontSize: '11px', color: '#333', fontWeight: 600, letterSpacing: '0.5px' }}>VERSION {CONFIG.APP_VERSION}</span>
              <span style={{ fontSize: '11px', color: '#333', fontWeight: 600, letterSpacing: '0.5px' }}>ENGINE: SUPABASE</span>
            </div>
            <div style={{ fontSize: '11px', color: '#333' }}>© 2026 Obsidiana Dashboard</div>
          </footer>
        </div>
      )}
    </div>
  );
}
