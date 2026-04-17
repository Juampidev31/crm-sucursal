'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useData } from '@/context/DataContext';
import { useObjetivos } from '@/features/objetivos/ObjetivosProvider';
import { useHistorico } from '@/features/historico/HistoricoProvider';
import { useSettings } from '@/features/settings/SettingsProvider';
import { useToast } from '@/hooks/useToast';
import { CONFIG, HistoricoVenta } from '@/types';
import { formatCurrency, displayAnalista, formatDateTime, formatDate } from '@/lib/utils';
import {
  Save, RotateCcw, AlertCircle, Bell, Clock, History,
  Settings, Target, Activity, Copy, Shield, AlertTriangle,
  CheckCircle, User, ShieldCheck, BarChart3, Calendar, TrendingUp, Trash2,
  Search, Filter, Download, ArrowRight, Eye, Edit3, Plus, Users,
  ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import ResumenMensualTab from './ResumenMensualTab';
import BulkModifyTab from './BulkModifyTab';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useFilter, ESTADOS } from '@/context/FilterContext';

type DiasEntry = { dias_habiles: number | string; dias_transcurridos: number | string };
type HistRow = { capital_real: string; ops_real: string; meta_ventas: string; meta_operaciones: string };
type ObjetivoRow = { analista: string; mes: number; meta_ventas: number; meta_operaciones: number };
type ActiveTab = 'alertas' | 'dias' | 'historico' | 'objetivos' | 'duplicados' | 'auditoria' | 'resumen-mensual' | 'modificacion-masiva';

const EMPTY_HIST_ROWS = (): HistRow[] =>
  Array.from({ length: 12 }, () => ({ capital_real: '', ops_real: '', meta_ventas: '', meta_operaciones: '' }));

const parsePaste = (e: React.ClipboardEvent<HTMLInputElement>, onChange: (v: string) => void) => {
  e.preventDefault();
  const raw = e.clipboardData.getData('text').replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(raw);
  if (!isNaN(num)) onChange(String(num));
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

const ANALISTAS = ['PDV', ...CONFIG.ANALISTAS_DEFAULT];

export default function AjustesPage() {
  const { isAdmin } = useAuth();
  const { registros: ctxRegistros } = useData();
  const {
    alertasConfig: ctxAlertas, mutateAlertasConfig: setCtxAlertas, pushAlertasConfigChange,
    diasConfig: ctxDias, applyDiasConfigChange,
  } = useSettings();
  const { objetivos: ctxObjetivos, mutateObjetivos: setCtxObjetivos, pushObjetivosChange } = useObjetivos();
  const { historicoVentas: ctxHistorico, mutateHistoricoVentas: setCtxHistorico, pushHistoricoChange } = useHistorico();

  const router = useRouter();
  const { setFilter, limpiarFiltros, toggleEstado } = useFilter();

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
  const { toast, showSuccess, showError } = useToast(3000);

  // Objetivos state
  const [objetivos, setObjetivos] = useState<ObjetivoRow[]>([]);
  const [objetivosAnio, setObjetivosAnio] = useState(new Date().getFullYear());
  const [objetivosAnalista, setObjetivosAnalista] = useState('PDV');
  const [savingObj, setSavingObj] = useState(false);

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

  const [consultaEstado, setConsultaEstado] = useState('proyeccion');
  const [consultaAnalista, setConsultaAnalista] = useState('Luciana');

  useEffect(() => {
    if (!isAdmin && activeTab === 'alertas') {
      setActiveTab('dias');
    }
  }, [isAdmin, activeTab]);

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


  const saveAlertas = async () => {
    setSaving(true);
    try {
      await supabase.from('alertas_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      for (const alerta of alertasConfig) {
        const { error } = await supabase.from('alertas_config').insert(alerta);
        if (error) throw error;
      }

      // Actualizar contexto y enviar broadcast
      setCtxAlertas(() => [...alertasConfig]);
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

      // Actualizar contexto y enviar broadcast (atómico: local + broadcast)
      applyDiasConfigChange('UPDATE', config);

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
      showError(`Error al limpiar log: ${error.message}`);
    } else {
      showSuccess(`Log de auditoría limpiado exitosamente (${data?.length || 0} registros eliminados)`);
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

  // ── Variantes de Empleador ──────────────────────────────────────────────
  interface VarianteEmpleador {
    normalizado: string;
    variantes: string[];
    cantidad: number;
    monto: number;
  }

  const variantesEmpleador = useMemo((): VarianteEmpleador[] => {
    const normalizar = (nombre: string): string => {
      if (!nombre) return 'Sin dato';
      let n = nombre.toUpperCase().trim();
      n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      n = n.replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?A\.?S\.?|LTDA\.?|CIA\.?|E\.?I\.?R\.?L\.?)\.?\b/gi, '').trim();
      n = n.replace(/\b(EL|LA|LOS|LAS|DE|DEL|Y|E)\b\s*$/gi, '').trim();
      n = n.replace(/\s+/g, ' ').trim();
      return n || 'Sin dato';
    };

    const map = new Map<string, { variantes: Set<string>; cantidad: number; monto: number }>();
    for (const r of duplicadosRegistros) {
      const raw = (r.empleador ?? '').trim();
      if (!raw) continue;
      const key = normalizar(raw);
      const prev = map.get(key) ?? { variantes: new Set<string>(), cantidad: 0, monto: 0 };
      prev.variantes.add(raw);
      prev.cantidad += 1;
      prev.monto += Number(r.monto) || 0;
      map.set(key, prev);
    }

    const result: VarianteEmpleador[] = [];
    for (const [normalizado, data] of map) {
      if (data.variantes.size > 1) {
        result.push({ normalizado, variantes: Array.from(data.variantes).sort(), cantidad: data.cantidad, monto: data.monto });
      }
    }
    return result.sort((a, b) => b.cantidad - a.cantidad);
  }, [duplicadosRegistros]);

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
            ...(isAdmin ? [{ id: 'alertas', label: 'Alertas', icon: Bell }] : []),
            { id: 'dias', label: 'Días Hábiles', icon: Clock },
            { id: 'historico', label: 'Histórico', icon: History },
            { id: 'objetivos', label: 'Objetivos', icon: Target },
            { id: 'duplicados', label: 'Duplicados', icon: Copy },
            { id: 'auditoria', label: 'Auditoría', icon: Shield },
            { id: 'resumen-mensual', label: 'Resumen Mensual', icon: BarChart3 },
            ...(isAdmin ? [{ id: 'modificacion-masiva', label: 'Modificación Masiva', icon: Users }] : []),
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

              <div className="data-card" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.03)', marginTop: '24px' }}>
                <div className="data-card-header" style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Consulta de Registros por Estado</h3>
                  <p style={{ fontSize: '13px', color: 'var(--gris)', marginTop: '4px' }}>Acceso rápido para revisar registros por analista y estado (Ej: Registros sin gestión / proyección)</p>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label" style={{ color: 'var(--gris)', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Analista</label>
                    <select className="form-select" value={consultaAnalista} onChange={e => setConsultaAnalista(e.target.value)}>
                        <option value="todos">Todos</option>
                        {CONFIG.ANALISTAS_DEFAULT.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label" style={{ color: 'var(--gris)', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estado</label>
                    <select className="form-select" value={consultaEstado} onChange={e => setConsultaEstado(e.target.value)}>
                        <option value="todos">Todos</option>
                        {ESTADOS.map(e => <option key={e} value={e}>{e.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <button className="btn-primary" onClick={() => {
                        limpiarFiltros();
                        setTimeout(() => {
                            if (consultaAnalista !== 'todos') setFilter('analista', consultaAnalista);
                            if (consultaEstado !== 'todos') {
                                setFilter('estado', consultaEstado);
                                toggleEstado(consultaEstado); 
                            }
                            setFilter('soloAlertasVencidas', true);
                            router.push('/registros');
                        }, 50);
                  }}>
                    <Search size={14} style={{ marginRight: '6px' }} /> Ver Registros
                  </button>
                </div>
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

              {/* ── Variantes de Empleador ─────────────────────────────────── */}
              <div style={{ marginTop: '32px' }}>
                <header className="dashboard-header" style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 4, height: 18, borderRadius: 2, background: '#fbbf24' }} />
                    <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Variantes de Empleador</h2>
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', fontWeight: 700 }}>
                    {variantesEmpleador.length > 0
                      ? `${variantesEmpleador.length} empleadores con variantes`
                      : 'Sin variantes detectadas'}
                  </div>
                </header>

                {variantesEmpleador.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <CheckCircle size={40} color="var(--verde)" style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <p style={{ color: 'var(--verde)', fontWeight: 800, fontSize: '14px' }}>TODOS LOS EMPLEADORES ESTÁN NORMALIZADOS</p>
                    <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>No se encontraron empleadores con múltiples formas de escritura.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {variantesEmpleador.map((v, i) => (
                      <div key={i} className="data-card" style={{ borderLeft: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(251,191,36,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <AlertTriangle size={15} color="#fbbf24" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                              {v.normalizado}
                            </div>
                            <div style={{ fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                              {v.variantes.length} variantes • {v.cantidad} registros • {formatCurrency(v.monto)}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {v.variantes.map((varName, j) => (
                                <span key={j} style={{
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  color: '#888',
                                  fontWeight: 600,
                                }}>
                                  {varName}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

            const extractNameFromDetails = (reg: any) => {
              if (reg.nombre) return reg.nombre;
              if (reg.accion === 'Creación' && reg.valor_nuevo) return reg.valor_nuevo.split(' | ')[0];
              if (reg.accion === 'Eliminación' && reg.valor_anterior) return reg.valor_anterior.split(' | ')[0];
              if (reg.accion.includes('Recordatorio') && (reg.valor_nuevo || reg.valor_anterior)) {
                return (reg.valor_nuevo || reg.valor_anterior).split(' | ')[0];
              }
              return null;
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

            const filtered = (auditoriaRegistros || []).filter((reg: any) => {
              if (auditFilterAccion !== 'todas' && reg.accion !== auditFilterAccion) return false;
              if (auditFilterAnalista !== 'todos' && reg.analista !== auditFilterAnalista) return false;
              if (reg.fecha_hora && new Date(reg.fecha_hora).getTime() < cutoff) return false;
              if (auditSearch) {
                const q = auditSearch.toLowerCase();
                const hay = [reg.analista, reg.accion, reg.campo_modificado, reg.valor_nuevo, reg.valor_anterior, reg.id_registro, reg.nombre, reg.cuil]
                  .filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
                if (!hay) return false;
              }
              return true;
            });

            const allAuditAnalistas = [...new Set((auditoriaRegistros || []).map((r: any) => r.analista).filter(Boolean))];

            const totalPages = Math.max(1, Math.ceil(filtered.length / AUDIT_PAGE_SIZE));
            const safePage = Math.min(auditPage, totalPages);
            const paged = filtered.slice((safePage - 1) * AUDIT_PAGE_SIZE, safePage * AUDIT_PAGE_SIZE);

            // — KPI stats (calculated from filtered data) —
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const todayCount = filtered.filter((r: any) => r.fecha_hora && new Date(r.fecha_hora) >= todayStart).length;
            const creaciones = filtered.filter((r: any) => r.accion === 'Creación').length;
            const ediciones = filtered.filter((r: any) => !['Creación', 'Eliminación'].includes(r.accion) && !r.accion?.includes('Recordatorio')).length;
            const eliminaciones = filtered.filter((r: any) => r.accion === 'Eliminación').length;
            const recordatorios = filtered.filter((r: any) => r.accion?.includes('Recordatorio')).length;

            const analystCounts: Record<string, number> = {};
            filtered.forEach((r: any) => { if (r.analista) analystCounts[r.analista] = (analystCounts[r.analista] || 0) + 1; });
            const topAnalyst = Object.entries(analystCounts).sort((a, b) => b[1] - a[1])[0];

            // — CSV export —
            const exportCSV = () => {
                const headers = ['Fecha/Hora', 'Nombre', 'CUIL', 'ID Registro', 'Analista', 'Acción', 'Campo Modificado', 'Valor Anterior', 'Valor Nuevo'];
                const rows = filtered.map((r: any) => [
                  r.fecha_hora || '', r.nombre || '', r.cuil || '', r.id_registro || '', r.analista || '', r.accion || '',
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
                    { label: 'TOTAL EVENTOS', value: filtered.length, icon: <BarChart3 size={14} />, accent: '#fff' },
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
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#ccc' }}>{reg.analista || reg.id_analista || '—'}</span>
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
                                      <td colSpan={6} style={{ padding: '0 14px 16px 54px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{
                                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                          gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
                                          borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)',
                                        }}>
                                          {/* ID Completo - Hidden */}
                                          <div style={{ display: 'none' }}>
                                            <div style={{ fontSize: '9px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>ID Completo</div>
                                            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#888', wordBreak: 'break-all' }}>{reg.id_registro || '—'}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '9px', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Analista (ID)</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>{reg.id_analista || reg.analista || '—'}</div>
                                          </div>
                                          {/* Timestamp - Hidden */}
                                          <div style={{ display: 'none' }}>
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

          {/* TAB: RESUMEN MENSUAL */}
          {activeTab === 'resumen-mensual' && (
            <ResumenMensualTab
              registros={ctxRegistros}
              objetivos={ctxObjetivos}
              onSuccess={showSuccess}
              onError={showError}
            />
          )}

          {/* TAB: MODIFICACIÓN MASIVA (solo admin) */}
          {activeTab === 'modificacion-masiva' && isAdmin && (
            <BulkModifyTab />
          )}


        </div>
      )}
    </div>
  );
}
