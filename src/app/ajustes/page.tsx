'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { useObjetivos } from '@/features/objetivos/ObjetivosProvider';
import { useHistorico } from '@/features/historico/HistoricoProvider';
import { useSettings } from '@/features/settings/SettingsProvider';
import { useToast } from '@/hooks/useToast';
import { CONFIG, HistoricoVenta } from '@/types';
import { formatCurrency, displayAnalista, formatDateTime, formatDate } from '@/lib/utils';
import {
  Save, RotateCcw, AlertCircle, Bell, Clock, History,
  Settings, Activity, Copy, Shield, AlertTriangle,
  CheckCircle, User, ShieldCheck, BarChart3, Trash2,
  Search, Filter, ArrowRight, Edit3, Plus, Users,
  ChevronLeft, ChevronRight, Upload, X
} from 'lucide-react';
import dynamic from 'next/dynamic';

const TabFallback = () => (
  <div style={{ padding: 24, color: 'var(--gris)', fontSize: 13, fontFamily: "'Outfit', sans-serif" }}>
    Cargando…
  </div>
);

const ResumenMensualTab = dynamic(() => import('./ResumenMensualTab'), { ssr: false, loading: TabFallback });
const BulkModifyTab     = dynamic(() => import('./BulkModifyTab'),     { ssr: false, loading: TabFallback });
const MassiveDeleteTab  = dynamic(() => import('./MassiveDeleteTab'),  { ssr: false, loading: TabFallback });
const AvisosTab         = dynamic(() => import('./AvisosTab'),         { ssr: false, loading: TabFallback });
const VerificadorTab    = dynamic(() => import('./VerificadorTab'),    { ssr: false, loading: TabFallback });
const CargaRapidaTab    = dynamic(() => import('./CargaRapidaTab'),    { ssr: false, loading: TabFallback });

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useFilter, ESTADOS } from '@/context/FilterContext';

type DiasEntry = { dias_habiles: number | string; dias_transcurridos: number | string };
type HistRow = { capital_real: string; ops_real: string; meta_ventas: string; meta_operaciones: string };
type ActiveTab = 'configuracion' | 'reportes' | 'datos-masivos' | 'actividad';
type ConfigSubTab = 'alertas' | 'dias' | 'permisos';
type ReportesSubTab = 'historico' | 'resumen-mensual' | 'calif-score';
type DatosSubTab = 'modificacion-masiva' | 'asignar-excel' | 'verificador' | 'carga-rapida' | 'duplicados' | 'eliminacion-masiva';
type ActividadSubTab = 'auditoria' | 'avisos';

const EMPTY_HIST_ROWS = (): HistRow[] =>
  Array.from({ length: 12 }, () => ({ capital_real: '', ops_real: '', meta_ventas: '', meta_operaciones: '' }));

const parsePaste = (e: React.ClipboardEvent<HTMLInputElement>, onChange: (v: string) => void) => {
  e.preventDefault();
  const raw = e.clipboardData.getData('text').replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(raw);
  if (!isNaN(num)) onChange(String(num));
};

// Barra de sub-tabs compartida por las 4 secciones
function SubTabBar<T extends string>({ tabs, active, onSelect }: {
  tabs: { id: T; label: string; icon: React.ElementType }[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 6,
            background: active === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: `1px solid ${active === t.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: active === t.id ? '#fff' : 'var(--gris)',
            fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: active === t.id ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          <t.icon size={13} style={{ opacity: active === t.id ? 1 : 0.7 }} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

const renderDetalleAudit = (reg: any) => {
  if (reg.accion === 'Creación') return <span style={{ color: '#888' }}>Nuevo registro</span>;
  if (reg.accion === 'Eliminación') return <span style={{ color: '#888' }}>Registro eliminado</span>;
  if (reg.valor_anterior || reg.valor_nuevo) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', flexWrap: 'wrap' }}>
        {reg.campo_modificado && <span style={{ color: '#666', fontWeight: 600 }}>{reg.campo_modificado}:</span>}
        {reg.valor_anterior && <span style={{ color: '#ff3366', textDecoration: 'line-through', opacity: 0.8 }}>{reg.valor_anterior}</span>}
        {reg.valor_anterior && reg.valor_nuevo && <ArrowRight size={10} color="#666" />}
        {reg.valor_nuevo && <span style={{ color: '#22c55e' }}>{reg.valor_nuevo}</span>}
      </div>
    );
  }
  return <span style={{ color: '#888' }}>{reg.campo_modificado || '—'}</span>;
};

export default function AjustesPage() {
  const { isAdmin } = useAuth();
  const { registros: ctxRegistros } = useRegistros();
  const {
    alertasConfig: ctxAlertas, mutateAlertasConfig: setCtxAlertas, pushAlertasConfigChange,
    diasConfig: ctxDias, applyDiasConfigChange,
    permisosConfig: ctxPermisos, applyPermisoConfigChange
  } = useSettings();
  const { objetivos: ctxObjetivos, mutateObjetivos: setCtxObjetivos, pushObjetivosChange } = useObjetivos();
  const { historicoVentas: ctxHistorico, mutateHistoricoVentas: setCtxHistorico, pushHistoricoChange } = useHistorico();

  const router = useRouter();
  const { setFilter, limpiarFiltros, toggleEstado } = useFilter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('configuracion');
  const [configSubTab, setConfigSubTab] = useState<ConfigSubTab>('alertas');
  const [reportesSubTab, setReportesSubTab] = useState<ReportesSubTab>('historico');
  const [datosSubTab, setDatosSubTab] = useState<DatosSubTab>('modificacion-masiva');
  const [actividadSubTab, setActividadSubTab] = useState<ActividadSubTab>('auditoria');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set());

  // Keep-alive: visibilidad y montaje persistente de las tabs pesadas (componentes dinamicos)
  const heavyVisibility = useMemo(() => ({
    'resumen-mensual': activeTab === 'reportes' && reportesSubTab === 'resumen-mensual',
    'bulk-corrector': activeTab === 'datos-masivos' && datosSubTab === 'modificacion-masiva' && isAdmin,
    'bulk-excel': activeTab === 'datos-masivos' && datosSubTab === 'asignar-excel' && isAdmin,
    'bulk-bulk': activeTab === 'reportes' && reportesSubTab === 'calif-score' && isAdmin,
    'massive-delete': activeTab === 'datos-masivos' && datosSubTab === 'eliminacion-masiva' && isAdmin,
    'avisos-tab': activeTab === 'actividad' && actividadSubTab === 'avisos' && isAdmin,
    'verificador-tab': activeTab === 'datos-masivos' && datosSubTab === 'verificador' && isAdmin,
    'carga-rapida-tab': activeTab === 'datos-masivos' && datosSubTab === 'carga-rapida' && isAdmin,
  } as const), [activeTab, reportesSubTab, datosSubTab, actividadSubTab, isAdmin]);

  useEffect(() => {
    setVisitedTabs(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const [k, v] of Object.entries(heavyVisibility)) {
        if (v && !next.has(k)) { next.add(k); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [heavyVisibility]);
  const [alertasConfig, setAlertasConfig] = useState(CONFIG.ALERTAS_DEFAULT);
  const [diasValues, setDiasValues] = useState<Record<string, DiasEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDias, setSavingDias] = useState<string | null>(null);
  const [savingPermiso, setSavingPermiso] = useState<string | null>(null);

  const [histAnalista, setHistAnalista] = useState(CONFIG.ANALISTAS_DEFAULT[0]);
  const [histAnio, setHistAnio] = useState(new Date().getFullYear() - 1);
  const [histRows, setHistRows] = useState<HistRow[]>(EMPTY_HIST_ROWS());
  const [savingHist, setSavingHist] = useState(false);
  const { toast, showSuccess, showError } = useToast(3000);

  // Duplicados state
  const [duplicadosRegistros, setDuplicadosRegistros] = useState<any[]>([]);
  const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
  const [selectedAnalistas, setSelectedAnalistas] = useState<string[]>([]);
  const [duplicadosFechaDesde, setDuplicadosFechaDesde] = useState('');
  const [duplicadosFechaHasta, setDuplicadosFechaHasta] = useState('');

  // Auditoria state
  const [auditoriaRegistros, setAuditoriaRegistros] = useState<any[]>([]);
  const [auditoriaLoading, setAuditoriaLoading] = useState(true);
  const [limpiandoLog, setLimpiandoLog] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterAccion, setAuditFilterAccion] = useState<string>('todas');
  const [auditFilterAnalista, setAuditFilterAnalista] = useState<string>('todos');
  const [auditFilterPeriodo, setAuditFilterPeriodo] = useState<string>('todo');
  const [auditFechaDesde, setAuditFechaDesde] = useState<string>('');
  const [auditFechaHasta, setAuditFechaHasta] = useState<string>('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditGroupModal, setAuditGroupModal] = useState<{ title: string; records: any[] } | null>(null);
  const AUDIT_PAGE_SIZE = 25;

  const [consultaEstado, setConsultaEstado] = useState('proyeccion');
  const [consultaAnalista, setConsultaAnalista] = useState('Luciana');

  useEffect(() => {
    if (!isAdmin && activeTab === 'configuracion' && configSubTab === 'alertas') {
      setConfigSubTab('dias');
    }
    if (!isAdmin && activeTab === 'datos-masivos' && datosSubTab !== 'duplicados') {
      setDatosSubTab('duplicados');
    }
  }, [isAdmin, activeTab, configSubTab, datosSubTab]);

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

  const togglePermiso = async (rol: string, permiso: string, current: boolean) => {
    const key = `${rol}-${permiso}`;
    setSavingPermiso(key);
    try {
      const config = { rol, permiso, activo: !current };
      const { error } = await supabase.from('permisos_roles').upsert(config, { onConflict: 'rol,permiso' });
      if (error) throw error;
      applyPermisoConfigChange('UPDATE', config);
      showSuccess(`Permiso ${config.activo ? 'activado' : 'desactivado'}`);
    } catch (err: any) {
      showError(`Error al actualizar permiso: ${err.message}`);
    }
    setSavingPermiso(null);
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
    if (activeTab === 'reportes' && reportesSubTab === 'historico') loadHistorico(histAnalista, histAnio);
  }, [histAnalista, histAnio, loadHistorico, activeTab, reportesSubTab]);

  // Fetch datos para Duplicados
  useEffect(() => {
    if (activeTab === 'datos-masivos' && datosSubTab === 'duplicados') {
      supabase
        .from('registros')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setDuplicadosRegistros(data || []);
        });
    }
  }, [activeTab, datosSubTab]);

  // Fetch datos para Auditoria + suscripción realtime
  useEffect(() => {
    if (activeTab !== 'actividad' || actividadSubTab !== 'auditoria') return;

    const hayRangoFechas = !!(auditFechaDesde || auditFechaHasta);
    let cancelado = false;
    setAuditoriaLoading(true);

    if (hayRangoFechas) {
      // Con rango de fechas: trae TODO el historial de ese rango, paginando (sin tope de 200).
      (async () => {
        const PAGE = 1000;
        let offset = 0;
        const acc: any[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (cancelado) return;
          let q = supabase.from('auditoria').select('*').order('fecha_hora', { ascending: false });
          if (auditFechaDesde) q = q.gte('fecha_hora', new Date(auditFechaDesde + 'T00:00:00').toISOString());
          if (auditFechaHasta) q = q.lte('fecha_hora', new Date(auditFechaHasta + 'T23:59:59').toISOString());
          const { data, error } = await q.range(offset, offset + PAGE - 1);
          if (error || !data) break;
          acc.push(...data);
          if (data.length < PAGE) break;
          offset += PAGE;
        }
        if (!cancelado) { setAuditoriaRegistros(acc); setAuditoriaLoading(false); }
      })();
      return () => { cancelado = true; };
    }

    // Sin rango de fechas: 200 más recientes + realtime
    supabase
      .from('auditoria')
      .select('*')
      .order('fecha_hora', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (cancelado) return;
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

    return () => { cancelado = true; supabase.removeChannel(channel); };
  }, [activeTab, actividadSubTab, auditFechaDesde, auditFechaHasta]);

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

      const objUpserts = histRows
        .map((row, mesIdx) => ({
          analista: histAnalista, anio: histAnio, mes: mesIdx,
          meta_ventas: Number(row.meta_ventas) || 0, meta_operaciones: Number(row.meta_operaciones) || 0,
        }))
        .filter(r => r.meta_ventas > 0 || r.meta_operaciones > 0);

      const zeroMonths = histRows
        .map((_, mesIdx) => mesIdx)
        .filter(mesIdx => !Number(histRows[mesIdx].capital_real) && !Number(histRows[mesIdx].ops_real));

      const zeroObjMonths = histRows
        .map((_, mesIdx) => mesIdx)
        .filter(mesIdx => !Number(histRows[mesIdx].meta_ventas) && !Number(histRows[mesIdx].meta_operaciones));

      // 4 operaciones en paralelo (1 query c/u, en vez de hasta 26 secuenciales)
      const ops: PromiseLike<any>[] = [];
      if (upserts.length > 0) {
        ops.push(supabase.from('historico_ventas').upsert(upserts, { onConflict: 'analista,anio,mes' }));
      }
      if (zeroMonths.length > 0) {
        ops.push(supabase.from('historico_ventas').delete()
          .eq('analista', histAnalista).eq('anio', histAnio).in('mes', zeroMonths));
      }
      if (objUpserts.length > 0) {
        ops.push(supabase.from('objetivos').upsert(objUpserts, { onConflict: 'analista,mes,anio' }));
      }
      if (zeroObjMonths.length > 0) {
        ops.push(supabase.from('objetivos').delete()
          .eq('analista', histAnalista).eq('anio', histAnio).in('mes', zeroObjMonths));
      }
      const results = await Promise.all(ops);
      const firstErr = results.find((r: any) => r?.error)?.error;
      if (firstErr) throw firstErr;

      // Actualizar contextos
      if (upserts.length > 0) {
        setCtxHistorico((prev: HistoricoVenta[]) => {
          const filtered = prev.filter(h => !(h.analista === histAnalista && h.anio === histAnio));
          return [...filtered, ...upserts.map(u => ({ ...u, id: undefined }))] as HistoricoVenta[];
        });
        upserts.forEach(u => pushHistoricoChange('UPDATE', { ...u, id: undefined }));
      }
      if (objUpserts.length > 0) {
        setCtxObjetivos(prev => {
          const filtered = prev.filter(o => !(o.analista === histAnalista && o.anio === histAnio));
          return [...filtered, ...objUpserts.map(u => ({ ...u, id: undefined }))];
        });
        objUpserts.forEach(u => pushObjetivosChange('UPDATE', { ...u, id: undefined }));
      }
      if (zeroObjMonths.length > 0) {
        setCtxObjetivos(prev => prev.filter(o =>
          !(o.analista === histAnalista && o.anio === histAnio && zeroObjMonths.includes(o.mes))
        ));
        zeroObjMonths.forEach(mes => pushObjetivosChange('DELETE', {
          analista: histAnalista, anio: histAnio, mes,
          meta_ventas: 0, meta_operaciones: 0,
        } as any));
      }

      showSuccess(`Histórico guardado para ${histAnalista}`);
    } catch (err: any) { showError(`Error: ${err.message}`); }
    setSavingHist(false);
  };

  const updateDias = (analista: string, field: keyof DiasEntry, value: number | string) => {
    setDiasValues(prev => ({ ...prev, [analista]: { ...prev[analista], [field]: value } }));
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
      let matchFecha = true;
      if (duplicadosFechaDesde && r.fecha < duplicadosFechaDesde) matchFecha = false;
      if (duplicadosFechaHasta && r.fecha > duplicadosFechaHasta) matchFecha = false;
      return matchEstado && matchAnalista && matchFecha;
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
  }, [duplicadosRegistros, selectedEstados, selectedAnalistas, duplicadosFechaDesde, duplicadosFechaHasta]);

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

      {/* Nav Tabs */}
      <div className="toolbar" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px', borderRadius: 0, background: 'transparent' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { id: 'configuracion', label: 'Configuración', icon: Settings },
            { id: 'reportes', label: 'Reportes', icon: BarChart3 },
            { id: 'datos-masivos', label: 'Datos masivos', icon: Edit3 },
            { id: 'actividad', label: 'Actividad', icon: Activity },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as ActiveTab)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px 16px', border: 'none',
                background: activeTab === t.id ? '#fff' : 'transparent',
                borderRadius: '6px',
                fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: activeTab === t.id ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                color: activeTab === t.id ? '#000' : 'var(--gris)',
                flex: '1 0 160px',
                maxWidth: '200px',
                whiteSpace: 'nowrap'
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
          {activeTab === 'configuracion' && (
            <SubTabBar
              tabs={[
                ...(isAdmin ? [{ id: 'alertas' as const, label: 'Alertas', icon: Bell }] : []),
                { id: 'dias' as const, label: 'Días Hábiles', icon: Clock },
                ...(isAdmin ? [{ id: 'permisos' as const, label: 'Roles y Permisos', icon: Shield }] : []),
              ]}
              active={configSubTab}
              onSelect={setConfigSubTab}
            />
          )}
          {activeTab === 'configuracion' && configSubTab === 'alertas' && isAdmin && (
            <div className="data-card" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.03)' }}>
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

              <div className="data-card" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.03)', marginTop: '24px' }}>
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
          {activeTab === 'configuracion' && configSubTab === 'dias' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {['Todos', ...CONFIG.ANALISTAS_DEFAULT].map(analista => {
                const entry = diasValues[analista] || { dias_habiles: 22, dias_transcurridos: 0 };
                return (
                  <div key={analista} className="data-card" style={{ padding: '24px', background: '#111111' }}>
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

          {/* TAB: PERMISOS */}
          {activeTab === 'configuracion' && configSubTab === 'permisos' && isAdmin && (
            <div className="data-card" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="data-card-header" style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Roles y Permisos</h3>
                <p style={{ fontSize: '13px', color: 'var(--gris)', marginTop: '4px' }}>Habilitá o deshabilitá funciones específicas para los analistas en tiempo real.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {['analista'].map(rol => {
                  const LISTA_PERMISOS = [
                    { id: 'crear_registros', label: 'Crear Registros', desc: 'Permite agregar nuevos registros.' },
                    { id: 'editar_registros', label: 'Editar Registros', desc: 'Permite modificar registros existentes.' },
                    { id: 'eliminar_registros', label: 'Eliminar Registros', desc: 'Permite borrar registros desde la tabla.' },
                    { id: 'exportar_excel', label: 'Exportar a Excel', desc: 'Permite descargar el listado de registros.' },
                    { id: 'ver_recordatorios', label: 'Ícono Recordatorios', desc: 'Permite visualizar el ícono de recordatorios.' },
                    { id: 'ver_comentarios', label: 'Ícono Comentarios', desc: 'Permite visualizar el ícono de comentarios.' },
                  ];

                  return (
                    <div key={rol} style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <User size={16} color="#00d4ff" />
                        <h4 style={{ fontWeight: 800, fontSize: '15px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rol: {rol}</h4>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        {LISTA_PERMISOS.map(p => {
                          const isActive = ctxPermisos.find(cp => cp.rol === rol && cp.permiso === p.id)?.activo ?? true;
                          const isSaving = savingPermiso === `${rol}-${p.id}`;

                          return (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ddd' }}>{p.label}</div>
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{p.desc}</div>
                              </div>
                              <button
                                onClick={() => togglePermiso(rol, p.id, isActive)}
                                disabled={isSaving}
                                style={{
                                  background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                                  border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
                                  color: isActive ? '#00ff88' : '#ff3366',
                                  padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                                  cursor: isSaving ? 'not-allowed' : 'pointer',
                                  opacity: isSaving ? 0.6 : 1,
                                  transition: 'all 0.2s',
                                  minWidth: '85px'
                                }}
                              >
                                {isSaving ? '...' : isActive ? 'Activado' : 'Desactivado'}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: HISTORICO */}
          {activeTab === 'reportes' && (
            <SubTabBar
              tabs={[
                { id: 'historico' as const, label: 'Histórico y Objetivos', icon: History },
                { id: 'resumen-mensual' as const, label: 'Resumen Mensual', icon: BarChart3 },
                ...(isAdmin ? [{ id: 'calif-score' as const, label: 'Calif. x SCORE', icon: Users }] : []),
              ]}
              active={reportesSubTab}
              onSelect={setReportesSubTab}
            />
          )}
          {activeTab === 'reportes' && reportesSubTab === 'historico' && (
            <div className="data-card" style={{ background: '#111111' }}>
              <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Histórico y Objetivos</h3>
                  <p style={{ fontSize: '13px', color: 'var(--gris)', marginTop: '4px' }}>Control de objetivos y resultados por analista y año</p>
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
                    {Array.from({ length: new Date().getFullYear() - 2021 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => (
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

          {/* TAB: DUPLICADOS */}
          {activeTab === 'datos-masivos' && (
            <SubTabBar
              tabs={[
                ...(isAdmin ? [{ id: 'modificacion-masiva' as const, label: 'Corrector', icon: ShieldCheck }] : []),
                ...(isAdmin ? [{ id: 'asignar-excel' as const, label: 'Asignar Excel', icon: Filter }] : []),
                ...(isAdmin ? [{ id: 'verificador' as const, label: 'Verificador', icon: Search }] : []),
                ...(isAdmin ? [{ id: 'carga-rapida' as const, label: 'Carga Rápida', icon: Upload }] : []),
                { id: 'duplicados' as const, label: 'Duplicados', icon: Copy },
                ...(isAdmin ? [{ id: 'eliminacion-masiva' as const, label: 'Borrado Masivo', icon: Trash2 }] : []),
              ]}
              active={datosSubTab}
              onSelect={setDatosSubTab}
            />
          )}
          {activeTab === 'datos-masivos' && datosSubTab === 'duplicados' && (
            <div style={{ width: '100%', margin: '0 auto', padding: '20px 0 60px' }}>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,212,255,0.1)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Copy size={28} />
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Detección de Duplicados</h2>
                <p style={{ color: '#888', fontSize: 13, marginTop: 8, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {duplicados.length} Grupos Potenciales Encontrados
                </p>
              </div>

              {/* Minimalist Filters */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: '24px', marginBottom: 32, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Filtrar por Estados</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {allEstados.map(e => (
                        <button key={e} onClick={() => toggleFilter(selectedEstados, setSelectedEstados, e)} style={{
                          background: selectedEstados.includes(e) ? '#fff' : 'rgba(255,255,255,0.03)',
                          color: selectedEstados.includes(e) ? '#000' : '#888',
                          border: `1px solid ${selectedEstados.includes(e) ? '#fff' : 'rgba(255,255,255,0.08)'}`,
                          padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Filtrar por Analistas</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {allAnalistas.map(a => (
                        <button key={a} onClick={() => toggleFilter(selectedAnalistas, setSelectedAnalistas, a)} style={{
                          background: selectedAnalistas.includes(a) ? '#fff' : 'rgba(255,255,255,0.03)',
                          color: selectedAnalistas.includes(a) ? '#000' : '#888',
                          border: `1px solid ${selectedAnalistas.includes(a) ? '#fff' : 'rgba(255,255,255,0.08)'}`,
                          padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                          {displayAnalista(a)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Rango de Fecha</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="date" value={duplicadosFechaDesde} onChange={e => setDuplicadosFechaDesde(e.target.value)} style={{ flex: 1, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '10px', borderRadius: 8, fontSize: 11, outline: 'none' }} />
                      <span style={{ color: '#444' }}>-</span>
                      <input type="date" value={duplicadosFechaHasta} onChange={e => setDuplicadosFechaHasta(e.target.value)} style={{ flex: 1, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '10px', borderRadius: 8, fontSize: 11, outline: 'none' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Duplicados List */}
              {duplicados.length === 0 ? (
                 <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <CheckCircle size={48} style={{ color: '#34d399', margin: '0 auto 16px', opacity: 0.8 }} />
                    <p style={{ color: '#34d399', fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Pool Limpio</p>
                    <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>No se encontraron registros duplicados con estos filtros.</p>
                 </div>
              ) : (
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: 24 }}>
                   {duplicados.map(grupo => (
                      <div key={grupo.key} style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div>
                               <h4 style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{grupo.tipo === 'cuil' ? grupo.key : grupo.registros[0].nombre?.toUpperCase()}</h4>
                               <div style={{ fontSize: 10, color: '#888', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                 Coincidencia por {grupo.tipo}
                               </div>
                            </div>
                            <div style={{ background: 'rgba(255,51,102,0.1)', color: '#ff3366', fontSize: 11, fontWeight: 900, padding: '6px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <AlertTriangle size={12} /> {grupo.registros.length} Registros
                            </div>
                         </div>
                         
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                            {grupo.registros.map((r: any) => (
                               <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, transition: 'all 0.2s' }}>
                                  <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                                    <div style={{ color: '#eee', fontSize: 13, fontWeight: 700, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre}</div>
                                    <div style={{ color: '#666', fontSize: 11, fontWeight: 500, fontFamily: 'monospace' }}>{r.cuil} • {displayAnalista(r.analista)}</div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 900, marginBottom: 4 }}>{formatCurrency(r.monto)}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                                      <span style={{ color: '#34d399', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.estado}</span>
                                      <span style={{ color: '#555', fontSize: 10 }}>{r.fecha ? formatDate(r.fecha) : '—'}</span>
                                    </div>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                   ))}
                 </div>
              )}

              {/* Variantes de Empleador */}
              <div style={{ marginTop: 80, textAlign: 'center', marginBottom: 40 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Users size={28} />
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Variantes de Empleador</h2>
                <p style={{ color: '#888', fontSize: 13, marginTop: 8, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {variantesEmpleador.length} Grupos con Discrepancias
                </p>
              </div>

              {variantesEmpleador.length === 0 ? (
                 <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <CheckCircle size={48} style={{ color: '#34d399', margin: '0 auto 16px', opacity: 0.8 }} />
                    <p style={{ color: '#34d399', fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Completamente Normalizado</p>
                    <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>No se encontraron empleadores con múltiples formas de escritura.</p>
                 </div>
              ) : (
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
                   {variantesEmpleador.map((v, i) => (
                      <div key={i} style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                           <div>
                              <h4 style={{ fontSize: 16, fontWeight: 900, color: '#fbbf24', marginBottom: 6 }}>{v.normalizado}</h4>
                              <p style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{v.cantidad} Registros Afectados • {formatCurrency(v.monto)}</p>
                           </div>
                           <div style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', fontSize: 11, fontWeight: 900, padding: '6px 12px', borderRadius: 20 }}>
                             {v.variantes.length} Variantes
                           </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                           {v.variantes.map((varName, j) => (
                              <span key={j} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 14px', color: '#ccc', fontSize: 12, fontWeight: 600 }}>
                                {varName}
                              </span>
                           ))}
                        </div>
                      </div>
                   ))}
                 </div>
              )}
            </div>
          )}

          {/* TAB: AUDITORIA */}
          {activeTab === 'actividad' && (
            <SubTabBar
              tabs={[
                { id: 'auditoria' as const, label: 'Auditoría', icon: Shield },
                ...(isAdmin ? [{ id: 'avisos' as const, label: 'Avisos', icon: Bell }] : []),
              ]}
              active={actividadSubTab}
              onSelect={setActividadSubTab}
            />
          )}
          {activeTab === 'actividad' && actividadSubTab === 'auditoria' && (() => {
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
              if (accion === 'Eliminación') return { bg: 'rgba(239,68,68,0.08)', color: '#ff3366', border: 'rgba(239,68,68,0.15)' };
              if (accion?.includes('Recordatorio')) return { bg: 'rgba(168,85,247,0.08)', color: '#a855f7', border: 'rgba(168,85,247,0.15)' };
              return { bg: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: 'rgba(251,191,36,0.15)' };
            };

            // — filtering —
            const now = Date.now();
            const periodoMs: Record<string, number> = { 'hoy': 86400000, '7d': 604800000, '30d': 2592000000, 'todo': Infinity };
            const cutoff = now - (periodoMs[auditFilterPeriodo] || Infinity);

            const allAcciones = [...new Set((auditoriaRegistros || [])
              .map((r: any) => r.accion)
              .filter((a: any) => a && !['Favorito añadido', 'Favorito quitado'].includes(a))
            )];
            const allAuditAnalistas = [...new Set((auditoriaRegistros || []).map((r: any) => r.analista).filter(Boolean))];

            const filtered = (auditoriaRegistros || []).filter((reg: any) => {
              if (['Favorito añadido', 'Favorito quitado'].includes(reg.accion)) return false;
              if (auditFilterAccion !== 'todas' && reg.accion !== auditFilterAccion) return false;
              if (auditFilterAnalista !== 'todos' && reg.analista !== auditFilterAnalista) return false;
              if (reg.fecha_hora && new Date(reg.fecha_hora).getTime() < cutoff) return false;
              if (auditFechaDesde && reg.fecha_hora && new Date(reg.fecha_hora).getTime() < new Date(auditFechaDesde + 'T00:00:00').getTime()) return false;
              if (auditFechaHasta && reg.fecha_hora && new Date(reg.fecha_hora).getTime() > new Date(auditFechaHasta + 'T23:59:59').getTime()) return false;
              if (auditSearch) {
                const q = auditSearch.toLowerCase();
                const hay = [reg.analista, reg.accion, reg.campo_modificado, reg.valor_nuevo, reg.valor_anterior, reg.id_registro, reg.nombre, reg.cuil]
                  .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q));
                if (!hay) return false;
              }
              return true;
            });

            const groupedFiltered = (() => {
              const res: any[] = [];
              const modMap = new Map<string, any>();
              for (const reg of filtered) {
                if (reg.accion === 'Modificación' && reg.id_registro) {
                  if (!modMap.has(reg.id_registro)) {
                    const group = { ...reg, isGroup: true, subRecords: [reg] };
                    modMap.set(reg.id_registro, group);
                    res.push(group);
                  } else {
                    modMap.get(reg.id_registro).subRecords.push(reg);
                  }
                } else {
                  res.push(reg);
                }
              }
              return res;
            })();

            const totalPages = Math.max(1, Math.ceil(groupedFiltered.length / AUDIT_PAGE_SIZE));
            const safePage = Math.min(auditPage, totalPages);
            const paged = groupedFiltered.slice((safePage - 1) * AUDIT_PAGE_SIZE, safePage * AUDIT_PAGE_SIZE);

            return (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {/* HEADER */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 4, height: 28, borderRadius: 2, background: '#fff' }} />
                    <div>
                      <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Log de Auditoría</h1>
                      <p style={{ fontSize: '12px', color: '#555', marginTop: 2 }}>Registro de actividad del sistema</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={limpiarLogAuditoria}
                      disabled={limpiandoLog || !auditoriaRegistros?.length}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6,
                        fontSize: '11px', fontWeight: 700, border: 'none',
                        cursor: (limpiandoLog || !auditoriaRegistros?.length) ? 'not-allowed' : 'pointer',
                        background: limpiandoLog ? 'rgba(220,53,69,0.5)' : 'rgba(220,53,69,0.1)',
                        color: limpiandoLog ? '#888' : '#ff3366',
                        opacity: (limpiandoLog || !auditoriaRegistros?.length) ? 0.4 : 1, transition: 'all 0.2s',
                      }}>
                      <Trash2 size={13} /> {limpiandoLog ? 'Limpiando...' : 'Limpiar Todo'}
                    </button>
                  </div>
                </header>

                {/* FILTERS TOOLBAR */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
                  paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.04)'
                }}>
                  <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input
                      value={auditSearch} onChange={e => { setAuditSearch(e.target.value); setAuditPage(1); }}
                      placeholder="Buscar cliente, analista o acción..."
                      style={{
                        width: '100%', padding: '8px 12px 8px 36px', background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#eaeaea',
                        fontSize: '12px', outline: 'none', transition: 'all 0.2s'
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                    />
                  </div>
                  
                  <select
                    value={auditFilterAccion} onChange={e => { setAuditFilterAccion(e.target.value); setAuditPage(1); }}
                    style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                      color: '#ccc', fontSize: '12px', padding: '8px 12px', outline: 'none', cursor: 'pointer',
                      minWidth: 140
                    }}
                  >
                    <option style={{ background: '#111', color: '#fff' }} value="todas">Todas las acciones</option>
                    {allAcciones.map(a => <option style={{ background: '#111', color: '#fff' }} key={a} value={a}>{a}</option>)}
                  </select>

                  <select
                    value={auditFilterAnalista} onChange={e => { setAuditFilterAnalista(e.target.value); setAuditPage(1); }}
                    style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                      color: '#ccc', fontSize: '12px', padding: '8px 12px', outline: 'none', cursor: 'pointer',
                      minWidth: 140
                    }}
                  >
                    <option style={{ background: '#111', color: '#fff' }} value="todos">Todos los analistas</option>
                    {allAuditAnalistas.map(a => <option style={{ background: '#111', color: '#fff' }} key={a} value={a}>{a}</option>)}
                  </select>

                  <select
                    value={auditFilterPeriodo} onChange={e => { setAuditFilterPeriodo(e.target.value); setAuditPage(1); }}
                    style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                      color: '#ccc', fontSize: '12px', padding: '8px 12px', outline: 'none', cursor: 'pointer',
                      minWidth: 120
                    }}
                  >
                    {[{ k: 'hoy', l: 'Hoy' }, { k: '7d', l: 'Últimos 7 días' }, { k: '30d', l: 'Últimos 30 días' }, { k: 'todo', l: 'Todo' }].map(p => (
                      <option style={{ background: '#111', color: '#fff' }} key={p.k} value={p.k}>{p.l}</option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="date"
                      value={auditFechaDesde}
                      onChange={e => { setAuditFechaDesde(e.target.value); setAuditPage(1); }}
                      title="Fecha desde"
                      style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                        color: '#ccc', fontSize: '12px', padding: '8px 12px', outline: 'none', cursor: 'pointer', colorScheme: 'dark',
                      }}
                    />
                    <span style={{ color: '#555', fontSize: 12 }}>→</span>
                    <input
                      type="date"
                      value={auditFechaHasta}
                      onChange={e => { setAuditFechaHasta(e.target.value); setAuditPage(1); }}
                      title="Fecha hasta"
                      style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                        color: '#ccc', fontSize: '12px', padding: '8px 12px', outline: 'none', cursor: 'pointer', colorScheme: 'dark',
                      }}
                    />
                    {(auditFechaDesde || auditFechaHasta) && (
                      <button
                        onClick={() => { setAuditFechaDesde(''); setAuditFechaHasta(''); setAuditPage(1); }}
                        title="Limpiar fechas"
                        style={{
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                          color: '#888', fontSize: '12px', padding: '8px 10px', outline: 'none', cursor: 'pointer', lineHeight: 1,
                        }}
                      >✕</button>
                    )}
                  </div>
                </div>

                {/* DATA TABLE */}
                <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'hidden' }}>
                  {auditoriaLoading ? (
                    <div className="loading-container" style={{ minHeight: 200 }}><div className="spinner" /><span>Cargando registros...</span></div>
                  ) : !filtered.length ? (
                    <div className="empty-state" style={{ minHeight: 200 }}>
                      <Shield size={36} color="#333" style={{ marginBottom: 8 }} />
                      <p style={{ fontWeight: 800, fontSize: '13px', color: '#444' }}>{auditSearch || auditFilterAccion !== 'todas' || auditFilterAnalista !== 'todos' || auditFilterPeriodo !== 'todo' ? 'Sin resultados para los filtros aplicados' : 'No hay registros de auditoría'}</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ marginBottom: 0, tableLayout: 'fixed', minWidth: 1200 }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 16px', width: '160px' }}>Fecha / Hora</th>
                              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 16px', width: '160px' }}>Analista</th>
                              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 16px', width: '180px' }}>Acción</th>
                              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 16px', width: '240px' }}>Cliente</th>
                              <th style={{ textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 16px' }}>Detalles</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paged.map((reg: any, idx: number) => {
                              const rowKey = reg.id ?? `${reg.fecha_hora}-${idx}`;
                              const ac = accionColor(reg.accion);
                              return (
                                <tr
                                  key={rowKey}
                                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                  <td style={{ padding: '12px 16px', verticalAlign: 'middle', overflow: 'hidden' }}>
                                    <div style={{ fontSize: '12px', color: '#eaeaea', whiteSpace: 'nowrap', fontWeight: 600 }}>{relativeTime(reg.fecha_hora)}</div>
                                    <div style={{ fontSize: '10px', color: '#666', marginTop: 2, whiteSpace: 'nowrap' }}>{formatDateTime(reg.fecha_hora)}</div>
                                  </td>
                                  <td style={{ padding: '12px 16px', verticalAlign: 'middle', overflow: 'hidden' }}>
                                    <span style={{ fontSize: '12px', color: '#ccc', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block' }}>{reg.analista || reg.id_analista || '—'}</span>
                                  </td>
                                  <td style={{ padding: '12px 16px', verticalAlign: 'middle', overflow: 'hidden' }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 6,
                                      fontSize: '11px', fontWeight: 700, color: ac.color, whiteSpace: 'nowrap'
                                    }}>
                                      {accionIcon(reg.accion)}
                                      {reg.accion}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 16px', verticalAlign: 'middle', overflow: 'hidden' }}>
                                    <div style={{ fontSize: '12px', color: '#eaeaea', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{reg.nombre || '—'}</div>
                                    <div style={{ fontSize: '10px', color: '#666', marginTop: 2, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{reg.cuil || '—'}</div>
                                  </td>
                                  <td style={{ padding: '12px 16px', verticalAlign: 'middle', overflow: 'hidden' }}>
                                    {renderDetalleAudit(reg)}
                                    {reg.isGroup && reg.subRecords?.length > 1 && (
                                      <button
                                        onClick={() => setAuditGroupModal({ title: `Historial de ${reg.nombre || 'Registro'}`, records: reg.subRecords })}
                                        style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', padding: '4px 8px', borderRadius: 4, fontSize: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                                        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                      >
                                        <History size={10} /> Ver historial completo ({reg.subRecords.length})
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* PAGINATION */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)'
                      }}>
                        <span style={{ fontSize: '11px', color: '#555', fontWeight: 600 }}>
                          Mostrando {(safePage - 1) * AUDIT_PAGE_SIZE + (groupedFiltered.length > 0 ? 1 : 0)}–{Math.min(safePage * AUDIT_PAGE_SIZE, groupedFiltered.length)} de {groupedFiltered.length}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} style={{
                            width: 28, height: 28, borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.02)', color: safePage <= 1 ? '#333' : '#888',
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
                                width: 28, height: 28, borderRadius: 4, border: '1px solid',
                                fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                fontFamily: "'Outfit', sans-serif",
                                borderColor: safePage === page ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                                background: safePage === page ? '#fff' : 'rgba(255,255,255,0.02)',
                                color: safePage === page ? '#000' : '#666',
                              }}>{page}</button>
                            );
                          })}
                          <button onClick={() => setAuditPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{
                            width: 28, height: 28, borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.02)', color: safePage >= totalPages ? '#333' : '#888',
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

          {/* TABS PESADAS (componentes dinamicos) — KEEP-ALIVE: se montan al primer acceso y se ocultan con display:none */}
          {visitedTabs.has('resumen-mensual') && (
            <div style={{ display: heavyVisibility['resumen-mensual'] ? 'block' : 'none' }}>
              <ResumenMensualTab
                registros={ctxRegistros}
                objetivos={ctxObjetivos}
                diasConfig={ctxDias}
                onSuccess={showSuccess}
                onError={showError}
              />
            </div>
          )}
          {visitedTabs.has('bulk-corrector') && (
            <div style={{ display: heavyVisibility['bulk-corrector'] ? 'block' : 'none' }}>
              <BulkModifyTab mode="corrector" />
            </div>
          )}
          {visitedTabs.has('bulk-excel') && (
            <div style={{ display: heavyVisibility['bulk-excel'] ? 'block' : 'none' }}>
              <BulkModifyTab mode="excel" />
            </div>
          )}
          {visitedTabs.has('bulk-bulk') && (
            <div style={{ display: heavyVisibility['bulk-bulk'] ? 'block' : 'none' }}>
              <BulkModifyTab mode="bulk" />
            </div>
          )}

          {visitedTabs.has('massive-delete') && (
            <div style={{ display: heavyVisibility['massive-delete'] ? 'block' : 'none' }}>
              <MassiveDeleteTab />
            </div>
          )}
          {visitedTabs.has('avisos-tab') && (
            <div style={{ display: heavyVisibility['avisos-tab'] ? 'block' : 'none' }}>
              <AvisosTab />
            </div>
          )}
          {visitedTabs.has('verificador-tab') && (
            <div style={{ display: heavyVisibility['verificador-tab'] ? 'block' : 'none' }}>
              <VerificadorTab />
            </div>
          )}
          {visitedTabs.has('carga-rapida-tab') && (
            <div style={{ display: heavyVisibility['carga-rapida-tab'] ? 'block' : 'none' }}>
              <CargaRapidaTab />
            </div>
          )}

        </div>
      )}

      {/* MODAL HISTORIAL DE CAMBIOS — Portal al body para evitar stacking context */}
      {auditGroupModal && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            animation: 'slideInUp 0.2s ease-out'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{auditGroupModal.title}</h3>
                <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{auditGroupModal.records.length} modificaciones registradas</p>
              </div>
              <button onClick={() => setAuditGroupModal(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', cursor: 'pointer', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888'; }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {auditGroupModal.records.map((r, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>{formatDateTime(r.fecha_hora)}</span>
                    <span style={{ fontSize: 11, color: '#eaeaea', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 4 }}>
                      {r.analista || r.id_analista}
                    </span>
                  </div>
                  <div style={{ paddingLeft: 4 }}>
                    {renderDetalleAudit(r)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
