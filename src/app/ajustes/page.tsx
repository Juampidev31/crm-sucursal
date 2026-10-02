'use client';

import styles from './AjustesPage.module.css';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { useObjetivos } from '@/features/objetivos/ObjetivosProvider';
import { useHistorico } from '@/features/historico/HistoricoProvider';
import { useSettings, useAnalistas } from '@/features/settings/SettingsProvider';
import { useToast } from '@/hooks/useToast';
import { AlertaConfig, CONFIG, HistoricoVenta, LISTA_PERMISOS_ROLES, getPermisoOverride } from '@/types';
import { formatCurrency, displayAnalista, formatDateTime, formatDate } from '@/lib/utils';
import CustomSelect from '@/components/CustomSelect';
import {
  Save, RotateCcw, AlertCircle, Bell, Clock, History,
  Settings, Activity, Copy, Shield, AlertTriangle,
  CheckCircle, User, ShieldCheck, BarChart3, Trash2,
  Search, Filter, ArrowRight, Edit3, Plus, Users,
  ChevronLeft, ChevronRight, Upload, X, TrendingUp
} from 'lucide-react';
import dynamic from 'next/dynamic';

const TabFallback = () => (
  <div className={[styles["uPadding24px"], styles["uColortext-primary"], styles["uFontSize13px"], styles.uFontFamilyUi].join(' ')}>
    Cargando…
  </div>
);

const ResumenMensualTab = dynamic(() => import('./ResumenMensualTab'), { ssr: false, loading: TabFallback });
const ComparativaAnalistasTab = dynamic(() => import('./ComparativaAnalistasTab'), { ssr: false, loading: TabFallback });
const BulkModifyTab     = dynamic(() => import('./BulkModifyTab'),     { ssr: false, loading: TabFallback });
const MassiveDeleteTab  = dynamic(() => import('./MassiveDeleteTab'),  { ssr: false, loading: TabFallback });
const AvisosTab         = dynamic(() => import('./AvisosTab'),         { ssr: false, loading: TabFallback });
const VerificadorTab    = dynamic(() => import('./VerificadorTab'),    { ssr: false, loading: TabFallback });
const CargaRapidaTab    = dynamic(() => import('./CargaRapidaTab'),    { ssr: false, loading: TabFallback });
const AnalistasTab      = dynamic(() => import('./AnalistasTab'),      { ssr: false, loading: TabFallback });
const ReasignadosTab    = dynamic(() => import('./ReasignadosTab'),    { ssr: false, loading: TabFallback });
const DiasHabilesTab    = dynamic(() => import('./DiasHabilesTab').then(m => m.DiasHabilesTab), { ssr: false, loading: TabFallback });

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useFilter, ESTADOS } from '@/context/FilterContext';
import { fetchAllRows } from '@/lib/supabase-paginate';
import { normalizarNombreKey } from '@/lib/registro-stats';

type HistRow = { capital_real: string; ops_real: string; meta_ventas: string; meta_operaciones: string };

type ActiveTab = 'configuracion' | 'reportes' | 'datos-masivos' | 'actividad';
type ConfigSubTab = 'alertas' | 'dias' | 'permisos' | 'analistas';
type ReportesSubTab = 'historico' | 'comparativa' | 'resumen-mensual' | 'calif-score';
type DatosSubTab = 'modificacion-masiva' | 'asignar-excel' | 'verificador' | 'carga-rapida' | 'duplicados' | 'eliminacion-masiva';
type ActividadSubTab = 'auditoria' | 'reasignados' | 'avisos';

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
    <div className={styles.subTabBar}>
      {tabs.map(t => (
        <button className={`${styles.subTab}${active === t.id ? ` ${styles.subTabActive}` : ''}`}
          key={t.id}
          onClick={() => onSelect(t.id)}
        >
          <t.icon size={14} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Formatea cualquier fecha ISO (YYYY-MM-DD) dentro de un texto a DD/MM/AAAA.
const fmtFechasISO = (v: any) => String(v ?? '').replace(/\d{4}-\d{2}-\d{2}/g, (m) => formatDate(m));

const renderDetalleAudit = (reg: any) => {
  if (reg.accion === 'Creación') return <span className={[styles["uColortext-muted"]].join(' ')}>Nuevo registro</span>;
  if (reg.accion === 'Eliminación') return <span className={[styles["uColortext-muted"]].join(' ')}>Registro eliminado</span>;
  if (reg.valor_anterior || reg.valor_nuevo) {
    const campos = String(reg.campo_modificado || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const anteriores = String(reg.valor_anterior || '').split('|').map((s: string) => s.trim());
    const nuevos = String(reg.valor_nuevo || '').split('|').map((s: string) => s.trim());

    return (
      <div className={[styles["uDisplayflex"], styles["uFlexDirectioncolumn"], styles["uGap4px"], styles["uFontSize11px"]].join(' ')}>
        {campos.map((campo, idx) => {
          const ant = fmtFechasISO(anteriores[idx] ?? '');
          const nue = fmtFechasISO(nuevos[idx] ?? '');
          return (
            <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap6px"], styles["uFlexWrapwrap"]].join(' ')} key={idx}>
              <span className={[styles["uColortext-muted"], styles["uFontWeight600"]].join(' ')}>{campo}:</span>
              {ant && <span className={[styles["uColorff3366"]].join(' ')}>{ant}</span>}
              {ant && nue && <ArrowRight size={10} color="#666" />}
              {nue && <span className={[styles["uColor22c55e"]].join(' ')}>{nue}</span>}
            </div>
          );
        })}
      </div>
    );
  }
  return <span className={[styles["uColortext-muted"]].join(' ')}>{reg.campo_modificado || '—'}</span>;
};

// Detalle desglosado campo por campo (usado en el modal de historial).
// campo_modificado viene como "Campo1, Campo2" y los valores como "v1 | v2".
const renderCamposAudit = (reg: any) => {
  if (reg.accion === 'Creación') return <span className={[styles["uColortext-muted"], styles["uFontSize15px"]].join(' ')}>Nuevo registro</span>;
  if (reg.accion === 'Eliminación') return <span className={[styles["uColortext-muted"], styles["uFontSize15px"]].join(' ')}>Registro eliminado</span>;

  const campos = String(reg.campo_modificado || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const anteriores = String(reg.valor_anterior || '').split('|').map((s: string) => s.trim());
  const nuevos = String(reg.valor_nuevo || '').split('|').map((s: string) => s.trim());

  if (campos.length === 0) return <span className={[styles["uColortext-muted"], styles["uFontSize15px"]].join(' ')}>—</span>;

  // Si el valor es una fecha ISO (YYYY-MM-DD) la muestra como DD/MM/AAAA.
  const fmtVal = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? formatDate(v) : v);

  return (
    <div className={[styles["uDisplayflex"], styles["uFlexDirectioncolumn"], styles["uGap10px"]].join(' ')}>
      {campos.map((campo, idx) => {
        const ant = fmtVal(anteriores[idx] ?? '');
        const nue = fmtVal(nuevos[idx] ?? '');
        return (
          <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap10px"], styles["uFontSize15px"], styles["uFlexWrapwrap"]].join(' ')} key={idx}>
            <span className={[styles["uColortext-muted"], styles["uFontWeight700"], styles["uMinWidth100px"]].join(' ')}>{campo}:</span>
            {ant && <span className={[styles["uColorff3366"]].join(' ')}>{ant}</span>}
            {ant && nue && <ArrowRight size={15} color="#666" />}
            {nue && <span className={[styles["uColor22c55e"], styles["uFontWeight600"]].join(' ')}>{nue}</span>}
          </div>
        );
      })}
    </div>
  );
};

export default function AjustesPage() {
  const { isAdmin } = useAuth();
  const { registros: ctxRegistros } = useRegistros();
  const {
    alertasConfig: ctxAlertas, mutateAlertasConfig: setCtxAlertas, pushAlertasConfigChange,
    diasConfig: ctxDias,
    permisosConfig: ctxPermisos, applyPermisoConfigChange,
    settingsLoaded,
  } = useSettings();
  const { nombres: analistasDefault } = useAnalistas();
  const { objetivos: ctxObjetivos, mutateObjetivos: setCtxObjetivos, pushObjetivosChange } = useObjetivos();
  const { mutateHistoricoVentas: setCtxHistorico, pushHistoricoChange } = useHistorico();

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
    'comparativa-tab': activeTab === 'reportes' && reportesSubTab === 'comparativa',
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
  // `null` = todavía sin hidratar. Nunca arranca con CONFIG.ALERTAS_DEFAULT: si el usuario
  // pulsara Guardar antes de que el provider resuelva, los valores por defecto pisarían la
  // configuración real de la base.
  const [alertasConfig, setAlertasConfig] = useState<AlertaConfig[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Conjunto de claves en vuelo. Con un único `string` una segunda petición pisaba la clave de
  // la primera y el toggle anterior volvía a habilitarse con su request todavía pendiente.
  const [savingPermisos, setSavingPermisos] = useState<Set<string>>(() => new Set());
  const marcarGuardando = (key: string) => setSavingPermisos(prev => {
    const next = new Set(prev); next.add(key); return next;
  });
  const desmarcarGuardando = (key: string) => setSavingPermisos(prev => {
    const next = new Set(prev); next.delete(key); return next;
  });
  const [permisoScope, setPermisoScope] = useState<string>('general');

  const [histAnalista, setHistAnalista] = useState('');
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
  const [consultaAnalista, setConsultaAnalista] = useState('');

  useEffect(() => {
    if (!isAdmin && activeTab === 'configuracion' && configSubTab === 'alertas') {
      setConfigSubTab('dias');
    }
    if (!isAdmin && activeTab === 'datos-masivos' && datosSubTab !== 'duplicados') {
      setDatosSubTab('duplicados');
    }
  }, [isAdmin, activeTab, configSubTab, datosSubTab]);

  // `alertasConfig` es el borrador editable del editor de alertas. Antes se
  // llenaba con un `alertas_config.select('*')` propio, que repetía la consulta
  // que SettingsProvider ya hace con exactamente estos campos. Ahora se siembra
  // desde el contexto: una request menos y una sola fuente de verdad.
  // El guard por ref evita pisar ediciones sin guardar en refrescos posteriores.
  // Se siembra una sola vez, y sólo cuando el provider confirmó que terminó de cargar.
  // Se conserva `id`: es la PK con la que después se hace el upsert. Sin él habría que
  // borrar la tabla entera para poder reinsertar, que es justo lo que se quiere evitar.
  const alertasSembradas = useRef(false);
  useEffect(() => {
    if (!alertasSembradas.current && settingsLoaded) {
      alertasSembradas.current = true;
      setAlertasConfig(ctxAlertas.map(a => ({
        id: a.id, nombre: a.nombre, estado: a.estado, dias: a.dias,
        mensaje: a.mensaje, color: a.color,
      })));
    }
    if (settingsLoaded) setLoading(false);
  }, [ctxAlertas, settingsLoaded]);

  // Guardar sólo es posible con un borrador hidratado, con filas y con `id` en todas ellas.
  const alertasHidratadas = alertasConfig !== null
    && alertasConfig.length > 0
    && alertasConfig.every(a => !!a.id);


  const saveAlertas = async () => {
    // Guarda defensiva: el botón ya está deshabilitado en este caso.
    if (!alertasHidratadas || !alertasConfig) return;
    setSaving(true);
    try {
      // El conjunto es fijo (6 filas, sin altas ni bajas desde la UI) y cada fila conserva su
      // PK, así que basta un único upsert. Una sola sentencia → atómica. Antes se borraba la
      // tabla entera y se reinsertaba fila por fila: un fallo intermedio la dejaba a medias.
      const { error } = await supabase
        .from('alertas_config')
        .upsert(alertasConfig, { onConflict: 'id' });
      if (error) throw error;

      // Actualizar contexto y enviar broadcast
      setCtxAlertas(() => [...alertasConfig]);
      alertasConfig.forEach(a => pushAlertasConfigChange('UPDATE', a));

      showSuccess('Configuración de alertas guardada');
    } catch (err: any) { showError(`Error: ${err.message}`); }
    setSaving(false);
  };

  const resetAlertas = () => {
    // Restablece los valores por defecto SOBRE los ids ya cargados, emparejando por `estado`
    // (que el usuario no puede editar). Así el borrador nunca pierde su identidad.
    setAlertasConfig(prev => {
      if (!prev) return prev;
      return prev.map(a => {
        const def = CONFIG.ALERTAS_DEFAULT.find(d => d.estado === a.estado);
        return def ? { ...a, ...def, id: a.id } : a;
      });
    });
    showSuccess('Configuración restablecida');
  };

  const togglePermiso = async (rol: string, permiso: string, current: boolean) => {
    const key = `${rol}-${permiso}`;
    marcarGuardando(key);
    try {
      const config = { rol, permiso, activo: !current };
      const { error } = await supabase.from('permisos_roles').upsert(config, { onConflict: 'rol,permiso' });
      if (error) throw error;
      applyPermisoConfigChange('UPDATE', config);
      showSuccess(`Permiso ${config.activo ? 'activado' : 'desactivado'}`);
    } catch (err: any) {
      showError(`Error al actualizar permiso: ${err.message}`);
    }
    desmarcarGuardando(key);
  };

  const resetPermisoAnalista = async (analista: string, permiso: string) => {
    const rol = `analista:${analista}`;
    const key = `${rol}-${permiso}`;
    marcarGuardando(key);
    try {
      const { error } = await supabase.from('permisos_roles').delete().eq('rol', rol).eq('permiso', permiso);
      if (error) throw error;
      applyPermisoConfigChange('DELETE', { rol, permiso, activo: false });
      showSuccess(`Permiso de ${analista} restablecido al rol general`);
    } catch (err: any) {
      showError(`Error al restablecer permiso: ${err.message}`);
    }
    desmarcarGuardando(key);
  };

  const resetAllPermisosAnalista = async (analista: string) => {
    const rol = `analista:${analista}`;
    const key = `reset-all-${rol}`;
    marcarGuardando(key);
    try {
      const { error } = await supabase.from('permisos_roles').delete().eq('rol', rol);
      if (error) throw error;
      LISTA_PERMISOS_ROLES.forEach(p => {
        applyPermisoConfigChange('DELETE', { rol, permiso: p.id, activo: false });
      });
      showSuccess(`Todos los permisos de ${analista} fueron restablecidos al general`);
    } catch (err: any) {
      showError(`Error: ${err.message}`);
    }
    desmarcarGuardando(key);
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

  // Fetch datos para Duplicados.
  // Debe paginar: sin `.range()` Supabase devuelve sólo las primeras 1000 filas
  // (content-range 0-999/*) y la detección se calculaba sobre un dataset parcial.
  //
  // El orden DEBE incluir un desempate único (`id`): `created_at` tiene empates
  // de hasta 500 filas y, al paginar sobre un orden no determinista, Postgres
  // puede repetir filas en una página y omitirlas en otra (medido: 371 filas
  // duplicadas sobre 6996). Con el desempate, las páginas son estables.
  useEffect(() => {
    if (activeTab !== 'datos-masivos' || datosSubTab !== 'duplicados') return;

    let cancelado = false;
    (async () => {
      const { rows, error, cancelled } = await fetchAllRows(
        (from, to) =>
          supabase
            .from('registros')
            .select('*')
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        { isCancelled: () => cancelado },
      );
      if (cancelled || cancelado) return;
      if (error) { console.error('[Duplicados] Error cargando registros:', error); return; }
      setDuplicadosRegistros(rows);
    })();

    return () => { cancelado = true; };
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
        while (true) {
          if (cancelado) return;
          // `id.asc` sólo como desempate: `fecha_hora` no es única y esta
          // consulta se pagina con `.range()`.
          let q = supabase.from('auditoria').select('*').order('fecha_hora', { ascending: false }).order('id', { ascending: true });
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
          setAuditoriaRegistros(prev => {
            // Evita duplicados: si la fila ya existe (mismo id), no la re-agrega.
            const e = payload.entry;
            if (e.id != null && prev.some(p => p.id === e.id)) return prev;
            return [e, ...prev].slice(0, 200);
          });
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

    // Nombres ya cubiertos por un grupo de CUIL. Igual que en /duplicados: se
    // precalcula una sola vez en lugar de re-escanear `grupos` (y re-normalizar
    // cada nombre) dentro del bucle, que era O(grupos × registros).
    const nombresEnGruposCuil = new Set<string>();
    for (const g of grupos) {
      for (const r of g.registros) {
        const n = normalizarNombreKey(r.nombre);
        if (n) nombresEnGruposCuil.add(n);
      }
    }

    const byNombre = new Map<string, any[]>();
    for (const r of pool) {
      const nombre = normalizarNombreKey(r.nombre);
      if (!nombre || nombre.length < 3) continue;
      if (!byNombre.has(nombre)) byNombre.set(nombre, []);
      byNombre.get(nombre)!.push(r);
    }
    for (const [nombre, regs] of byNombre) {
      if (regs.length > 1 && !nombresEnGruposCuil.has(nombre)) {
        grupos.push({ key: nombre, tipo: 'nombre', registros: regs });
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
            <span className={[styles["uFontSize14px"]].join(' ')}>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Nav Tabs */}
      <div className={["toolbar", styles["uDisplayflex"], styles["uJustifyContentcenter"], styles["uMarginBottom16px"], styles["uBorderBottom1px-solid-border-subtle"], styles["uPaddingBottom16px"], styles["uBorderRadius0"], styles["uBackgroundtransparent"]].join(' ')}>
        <div className={styles.sectionSwitcher}>
          {[
            { id: 'configuracion', label: 'Configuración', icon: Settings },
            { id: 'reportes', label: 'Reportes', icon: BarChart3 },
            { id: 'datos-masivos', label: 'Datos masivos', icon: Edit3 },
            { id: 'actividad', label: 'Actividad', icon: Activity },
          ].map(t => (
            <button className={`${styles.sectionTab}${activeTab === t.id ? ` ${styles.sectionTabActive}` : ''}`}
              key={t.id}
              onClick={() => setActiveTab(t.id as ActiveTab)}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={["loading-container", styles["uMinHeight400px"]].join(' ')}>
          <div className="spinner" />
          <span className={[styles["uColortext-muted"]].join(' ')}>Cargando configuración...</span>
        </div>
      ) : (
        <div className={[styles["uWidth100"]].join(' ')}>

          {/* TAB: ALERTAS */}
          {activeTab === 'configuracion' && (
            <SubTabBar
              tabs={[
                ...(isAdmin ? [{ id: 'alertas' as const, label: 'Alertas', icon: Bell }] : []),
                { id: 'dias' as const, label: 'Días Hábiles', icon: Clock },
                ...(isAdmin ? [{ id: 'permisos' as const, label: 'Roles y Permisos', icon: Shield }] : []),
                ...(isAdmin ? [{ id: 'analistas' as const, label: 'Analistas', icon: Users }] : []),
              ]}
              active={configSubTab}
              onSelect={setConfigSubTab}
            />
          )}
          {activeTab === 'configuracion' && configSubTab === 'alertas' && isAdmin && (
            <div className={["data-card", styles["uBackgroundsurface-card"], styles["uBorder1px-solid-border-subtle"], styles.alertCard].join(' ')}>
              <div className={["data-card-header", styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemscenter"], styles["uMarginBottom32px"], styles.alertHeader].join(' ')}>
                <div>
                  <h3 className={[styles["uFontSize18px"], styles["uFontWeight800"], styles["uColortext-strong"], styles["uLetterSpacing0-5px"]].join(' ')}>Gestión de Alertas</h3>
                  <p className={[styles["uFontSize13px"], styles["uColortext-primary"], styles["uMarginTop4px"]].join(' ')}>Parámetros de vencimiento y colores de indicadores</p>
                </div>
                <div className={[styles["uDisplayflex"], styles["uGap10px"], styles.alertActions].join(' ')}>
                  <button className={["btn-secondary", styles["uFontSize12px"]].join(' ')} onClick={resetAlertas} disabled={!alertasHidratadas}>
                    <RotateCcw size={14} /> Restaurar
                  </button>
                  <button className={["btn-primary", styles["uFontSize12px"]].join(' ')} onClick={saveAlertas} disabled={saving || !alertasHidratadas}>
                    <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>

              <div className={[styles["uBackgroundsurface-sunken"], styles["uBorderRadius12px"], styles["uBorder1px-solid-border-subtle"], styles.alertTableScroll].join(' ')}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className={[styles["uColortext-muted"]].join(' ')}>Tipo de Alerta</th>
                      <th className={[styles["uColortext-muted"]].join(' ')}>Estado Aplicado</th>
                      <th className={[styles["uColortext-muted"]].join(' ')}>Días Límite</th>
                      <th className={[styles["uColortext-muted"]].join(' ')}>Identificador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(alertasConfig ?? []).map((alerta, idx) => (
                      <tr className={[styles["uBorderBottom1px-solid-border-subtle"]].join(' ')} key={alerta.id ?? idx}>
                        <td className={[styles["uFontWeight600"], styles["uFontSize14px"]].join(' ')}>{alerta.nombre}</td>
                        <td><span className={["status-badge", styles["uBackgroundsurface-sunken"], styles["uColortext-muted"]].join(' ')}>{alerta.estado}</span></td>
                        <td>
                          <input
                            className={["form-input", styles["uWidth100px"], styles["uTextAligncenter"], styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius4px"]].join(' ')}
                            type="number"
                            value={alerta.dias}
                            onChange={e => {
                              const dias = Number(e.target.value);
                              setAlertasConfig(prev => prev && prev.map((a, i) => i === idx ? { ...a, dias } : a));
                            }}
                          />
                        </td>
                        <td>
                          <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap12px"]].join(' ')}>
                            <div className={[styles["uWidth24px"], styles["uHeight24px"], styles["uBorderRadius6px"], styles["uBorder1px-solid-rgba-255-255-255-0-1"]].join(' ')} style={{ background: alerta.color }} />
                            <input
                              className={["form-input", styles["uWidth90px"], styles["uFontSize11px"], styles["uFontFamilymonospace"]].join(' ')}
                              type="text"
                              value={alerta.color}
                              onChange={e => {
                                const color = e.target.value;
                                setAlertasConfig(prev => prev && prev.map((a, i) => i === idx ? { ...a, color } : a));
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={["data-card", styles["uBackgroundsurface-card"], styles["uBorder1px-solid-border-subtle"], styles["uMarginTop24px"]].join(' ')}>
                <div className={["data-card-header", styles["uMarginBottom24px"]].join(' ')}>
                  <h3 className={[styles["uFontSize16px"], styles["uFontWeight800"], styles["uColortext-strong"], styles["uLetterSpacing0-5px"]].join(' ')}>Consulta de Registros por Estado</h3>
                  <p className={[styles["uFontSize13px"], styles["uColortext-primary"], styles["uMarginTop4px"]].join(' ')}>Acceso rápido para revisar registros por analista y estado (Ej: Registros sin gestión / proyección)</p>
                </div>
                <div className={[styles["uDisplayflex"], styles["uGap20px"], styles["uAlignItemsflex-end"], styles["uFlexWrapwrap"]].join(' ')}>
                  <div className={[styles["uFlex1"], styles["uMinWidth200px"]].join(' ')}>
                    <label className={["form-label", styles["uColortext-primary"], styles["uMarginBottom8px"], styles["uFontSize11px"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"]].join(' ')}>Analista</label>
                    <CustomSelect
                      value={consultaAnalista}
                      onChange={val => setConsultaAnalista(String(val))}
                      options={[{ label: 'Todos', value: 'todos' }, ...analistasDefault.map(a => ({ label: a, value: a }))]}
                      width="100%"
                    />
                  </div>
                  <div className={[styles["uFlex1"], styles["uMinWidth200px"]].join(' ')}>
                    <label className={["form-label", styles["uColortext-primary"], styles["uMarginBottom8px"], styles["uFontSize11px"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"]].join(' ')}>Estado</label>
                    <CustomSelect
                      value={consultaEstado}
                      onChange={val => setConsultaEstado(String(val))}
                      options={[{ label: 'Todos', value: 'todos' }, ...ESTADOS.map(e => ({ label: e.toUpperCase(), value: e }))]}
                      width="100%"
                    />
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
                    <Search className={[styles["uMarginRight6px"]].join(' ')} size={14} /> Ver Registros
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DIAS HABILES */}
          {activeTab === 'configuracion' && configSubTab === 'dias' && (
            <DiasHabilesTab />
          )}

          {/* TAB: ANALISTAS */}
          {activeTab === 'configuracion' && configSubTab === 'analistas' && isAdmin && (
            <AnalistasTab />
          )}

          {/* TAB: PERMISOS */}
          {activeTab === 'configuracion' && configSubTab === 'permisos' && isAdmin && (
            <div className={`data-card ${styles.rolesPage}`}>
              <div className={styles.rolesHeader}>
                <div className={styles.rolesHeaderIcon}><Shield size={20} /></div>
                <div>
                  <h3 className={styles.rolesTitle}>Roles y Permisos</h3>
                  <p className={styles.rolesSubtitle}>
                    Habilitá o deshabilitá funciones de forma general o para cada analista.
                  </p>
                </div>
              </div>

              {/* Selector de Ámbito: General vs. Analistas Individuales */}
              <div className={styles.scopeSection}>
                <div className={styles.scopeLabel}>
                  Ámbito de configuración
                </div>
                <div className={styles.scopeList}>
                  <button className={`${styles.scopeButton} ${permisoScope === 'general' ? styles.scopeButtonActive : ''}`}
                    type="button"
                    onClick={() => setPermisoScope('general')}
                  >
                    <Users size={15} />
                    <span>Rol General: Analista (Por Defecto)</span>
                  </button>

                  <div className={styles.scopeDivider} />

                  {analistasDefault.map(analista => {
                    const isSelected = permisoScope === analista;
                    const customCount = LISTA_PERMISOS_ROLES.filter(p => !!getPermisoOverride(ctxPermisos, p.id, analista)).length;

                    return (
                      <button className={`${styles.scopeButton} ${isSelected ? styles.scopeButtonActive : ''}`}
                        key={analista}
                        type="button"
                        onClick={() => setPermisoScope(analista)}
                      >
                        <User size={14} />
                        <span>{analista}</span>
                        {customCount > 0 && (
                          <span className={styles.scopeCount}>
                            {customCount} pers.
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Encabezado del contenedor de permisos actual */}
              {(() => {
                const isGeneral = permisoScope === 'general';
                const customCount = isGeneral
                  ? 0
                  : LISTA_PERMISOS_ROLES.filter(p => !!getPermisoOverride(ctxPermisos, p.id, permisoScope)).length;

                return (
                  <div className={styles.permissionsPanel}>
                    <div className={[styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemscenter"], styles["uMarginBottom20px"], styles["uFlexWrapwrap"], styles["uGap12px"]].join(' ')}>
                      <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap10px"]].join(' ')}>
                        {isGeneral ? (
                          <div className={styles.permissionsPanelIcon}>
                            <Shield size={18} />
                          </div>
                        ) : (
                          <div className={styles.permissionsPanelIcon}>
                            <User size={18} />
                          </div>
                        )}
                        <div>
                          <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap10px"]].join(' ')}>
                            <h4 className={[styles["uFontWeight800"], styles["uFontSize16px"], styles["uColortext-strong"], styles["uLetterSpacing0-3px"]].join(' ')}>
                              {isGeneral ? 'Rol General: Analista (Por Defecto)' : `Permisos Individuales: ${permisoScope}`}
                            </h4>
                            {isGeneral ? (
                              <span className={styles.permissionBadge}>
                                Base Global
                              </span>
                            ) : customCount > 0 ? (
                              <span className={styles.permissionBadge}>
                                {customCount} personalizada(s)
                              </span>
                            ) : (
                              <span className={[styles["uFontSize11px"], styles["uFontWeight600"], styles["uPadding2px-8px"], styles["uBorderRadius6px"], styles["uBackgroundsurface-sunken"], styles["uColortext-muted"]].join(' ')}>
                                Hereda todo de General
                              </span>
                            )}
                          </div>
                          <p className={[styles["uFontSize12px"], styles["uColortext-muted"], styles["uMarginTop3px"]].join(' ')}>
                            {isGeneral
                              ? 'Estos permisos se aplican a todos los analistas que no tengan una regla personalizada.'
                              : `Configuración específica para ${permisoScope}. Los permisos sin personalizar heredan el valor general.`}
                          </p>
                        </div>
                      </div>

                      {!isGeneral && customCount > 0 && (
                        <button className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap6px"], styles["uBackgroundrgba-248-113-113-0-08"], styles["uBorder1px-solid-rgba-248-113-113-0-25"], styles["uColorf87171"], styles["uPadding6px-12px"], styles["uBorderRadius8px"], styles["uFontSize11-5px"], styles["uFontWeight700"], styles["uCursorpointer"], styles["uTransitionall-0-2s"], styles.resetAllButton].join(' ')}
                          type="button"
                          onClick={() => resetAllPermisosAnalista(permisoScope)}
                          disabled={savingPermisos.has(`reset-all-analista:${permisoScope}`)}
                        >
                          <RotateCcw size={13} />
                          <span>Restablecer todos a General</span>
                        </button>
                      )}
                    </div>

                    <div className={[styles["uDisplaygrid"], styles["uGridTemplateColumnsrepeat-auto-fit-minmax-320px-1fr"], styles["uGap16px"]].join(' ')}>
                      {LISTA_PERMISOS_ROLES.map(p => {
                        const targetRol = isGeneral ? 'analista' : `analista:${permisoScope}`;
                        const override = isGeneral ? undefined : getPermisoOverride(ctxPermisos, p.id, permisoScope);
                        const isCustom = override !== undefined;
                        const generalActive = ctxPermisos.find(cp => cp.rol === 'analista' && cp.permiso === p.id)?.activo ?? true;
                        const isActive = isCustom ? override.activo : (isGeneral ? generalActive : generalActive);
                        const isSaving = savingPermisos.has(`${targetRol}-${p.id}`) || savingPermisos.has(`${permisoScope}-${p.id}`);

                        return (
                          <div className={`${styles.permissionCard} ${isCustom ? styles.permissionCardCustom : ''}`}
                            key={p.id}
                          >
                            <div className={[styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemsflex-start"], styles["uGap12px"]].join(' ')}>
                              <div className={[styles["uFlex1"]].join(' ')}>
                                <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap8px"], styles["uFlexWrapwrap"]].join(' ')}>
                                  <div className={[styles["uFontSize13-5px"], styles["uFontWeight700"], styles["uColortext-strong"]].join(' ')}>{p.label}</div>
                                  {!isGeneral && (
                                    isCustom ? (
                                      <span className={styles.permissionBadge}>
                                        Personalizado
                                      </span>
                                    ) : (
                                      <span className={[styles["uFontSize10px"], styles["uFontWeight600"], styles["uPadding2px-7px"], styles["uBorderRadius6px"], styles["uBackgroundsurface-sunken"], styles["uColortext-muted"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                                        Heredado ({generalActive ? 'Activado' : 'Desactivado'})
                                      </span>
                                    )
                                  )}
                                </div>
                                <div className={[styles["uFontSize11-5px"], styles["uColortext-muted"], styles["uMarginTop4px"], styles["uLineHeight1-4"]].join(' ')}>
                                  {p.desc}
                                </div>
                              </div>

                              <button className={`${styles.permissionToggle} ${isActive ? styles.permissionToggleActive : styles.permissionToggleInactive}`}
                                type="button"
                                onClick={() => togglePermiso(targetRol, p.id, isActive)}
                                disabled={isSaving}
                              >
                                {isSaving ? '...' : isActive ? 'Activado' : 'Desactivado'}
                              </button>
                            </div>

                            {!isGeneral && isCustom && (
                              <div className={[styles["uDisplayflex"], styles["uJustifyContentflex-end"], styles["uPaddingTop4px"], styles["uBorderTop1px-solid-border-subtle"]].join(' ')}>
                                <button className={[styles["uBackgroundtransparent"], styles["uBordernone"], styles["uColortext-muted"], styles["uFontSize11px"], styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap5px"], styles["uCursorpointer"], styles["uPadding2px-6px"], styles["uTransitioncolor-0-2s"], styles.inheritButton].join(' ')}
                                  type="button"
                                  onClick={() => resetPermisoAnalista(permisoScope, p.id)}
                                  disabled={isSaving}
                                >
                                  <RotateCcw size={11} />
                                  <span>Heredar de General</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: HISTORICO */}
          {activeTab === 'reportes' && (
            <SubTabBar
              tabs={[
                { id: 'historico' as const, label: 'Histórico y Objetivos', icon: History },
                { id: 'comparativa' as const, label: 'Comparativa de Analistas', icon: TrendingUp },
                { id: 'resumen-mensual' as const, label: 'Resumen Mensual', icon: BarChart3 },
                ...(isAdmin ? [{ id: 'calif-score' as const, label: 'Calif. x SCORE', icon: Users }] : []),
              ]}
              active={reportesSubTab}
              onSelect={setReportesSubTab}
            />
          )}
          {activeTab === 'reportes' && reportesSubTab === 'historico' && (
            <div className={["data-card", styles["uBackgroundsurface-card"]].join(' ')}>
              <div className={["data-card-header", styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemscenter"], styles["uMarginBottom32px"]].join(' ')}>
                <div>
                  <h3 className={[styles["uFontSize18px"], styles["uFontWeight800"], styles["uColortext-strong"], styles["uLetterSpacing0-5px"]].join(' ')}>Histórico y Objetivos</h3>
                  <p className={[styles["uFontSize13px"], styles["uColortext-primary"], styles["uMarginTop4px"]].join(' ')}>Control de objetivos y resultados por analista y año</p>
                </div>
                <button className="btn-primary" onClick={saveHistorico} disabled={savingHist}>
                  <Save size={14} /> {savingHist ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>

              {/* Selectors */}
              <div className={[styles["uDisplayflex"], styles["uGap32px"], styles["uMarginBottom32px"], styles["uPadding24px"], styles["uBackgroundsurface-sunken"], styles["uBorderRadius12px"], styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                <div className={[styles["uFlex1"]].join(' ')}>
                  <label className={["form-label", styles["uColortext-primary"], styles["uMarginBottom12px"], styles["uFontSize11px"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"]].join(' ')}>Seleccionar Analista</label>
                  <div className={[styles["uDisplayflex"], styles["uGap8px"], styles["uFlexWrapwrap"]].join(' ')}>
                    {['PDV', ...analistasDefault].map(a => (
                      <button className={[styles["uPadding10px-20px"], styles["uBorderRadius6px"], styles["uBorder1px-solid"], styles.uFontFamilyUi, styles["uFontSize12px"], styles["uFontWeight600"], styles["uCursorpointer"], styles["uTransitionall-0-2s"]].join(' ')} key={a} onClick={() => setHistAnalista(a)} style={{ borderColor: histAnalista === a ? 'var(--control-border-focus)' : 'var(--border-subtle)', background: histAnalista === a ? 'var(--brand-muted-soft)' : 'var(--surface-card)', color: histAnalista === a ? 'var(--action-primary)' : 'var(--text-primary)' }}>{a}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={["form-label", styles["uColortext-primary"], styles["uMarginBottom12px"], styles["uFontSize11px"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"]].join(' ')}>Año</label>
                  <div className={[styles["uDisplayflex"], styles["uGap8px"], styles["uFlexWrapwrap"]].join(' ')}>
                    {Array.from({ length: new Date().getFullYear() - 2021 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <button className={[styles["uPadding10px-16px"], styles["uBorderRadius6px"], styles["uBorder1px-solid"], styles.uFontFamilyUi, styles["uFontSize12px"], styles["uFontWeight600"], styles["uCursorpointer"], styles["uTransitionall-0-2s"]].join(' ')} key={y} onClick={() => setHistAnio(y)} style={{ borderColor: histAnio === y ? 'var(--control-border-focus)' : 'var(--border-subtle)', background: histAnio === y ? 'var(--brand-muted-soft)' : 'var(--surface-card)', color: histAnio === y ? 'var(--action-primary)' : 'var(--text-primary)' }}>{y}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={[styles["uOverflowXauto"]].join(' ')}>
                <table className={["data-table", styles["uBorder1px-solid-border-subtle"]].join(' ')}>
                  <thead>
                    <tr>
                      <th className={[styles["uColortext-primary"], styles["uWidth120px"], styles["uFontSize11px"]].join(' ')}>MES</th>
                      <th className={[styles["uColortext-primary"], styles["uOpacity0-8"], styles["uFontSize11px"]].join(' ')}>METAS CAPITAL ($)</th>
                      <th className={[styles["uColortext-primary"], styles["uOpacity0-8"], styles["uFontSize11px"]].join(' ')}>METAS OPS</th>
                      <th className={[styles["uColortext-strong"], styles["uOpacity0-9"], styles["uFontSize11px"]].join(' ')}>REAL CAPITAL ($)</th>
                      <th className={[styles["uColortext-strong"], styles["uOpacity0-9"], styles["uFontSize11px"]].join(' ')}>REAL OPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONFIG.MESES_NOMBRES.map((mes, idx) => (
                      <tr className={[styles["uBorderBottom1px-solid-border-subtle"], styles["uHeight54px"]].join(' ')} key={idx}>
                        <td className={[styles["uFontWeight800"], styles["uFontSize12px"], styles["uColortext-primary"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"]].join(' ')}>{mes}</td>
                        <td>
                          <input
                            className={["form-input", styles["uWidth140px"], styles["uBackgroundsurface-sunken"], styles["uBordernone"], styles["uBorderBottom1-5px-solid-rgba-255-255-255-0-1"], styles["uBorderRadius0"], styles["uPadding8px-4px"]].join(' ')} type="number"
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
                            className={["form-input", styles["uWidth80px"], styles["uBackgroundtransparent"], styles["uBordernone"], styles["uBorderBottom1px-solid-border-subtle"], styles["uBorderRadius0"], styles["uTextAligncenter"]].join(' ')} type="number"
                            placeholder="-"
                            value={histRows[idx].meta_operaciones}
                            onChange={e => setHistRows(prev => {
                              const next = [...prev]; next[idx] = { ...next[idx], meta_operaciones: e.target.value }; return next;
                            })}
                          />
                        </td>
                        <td>
                          <input
                            className={["form-input", styles["uWidth140px"], styles["uBackgroundsurface-sunken"], styles["uBordernone"], styles["uBorderBottom1-5px-solid-rgba-255-255-255-0-15"], styles["uBorderRadius0"], styles["uPadding8px-4px"]].join(' ')} type="number"
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
                            className={["form-input", styles["uWidth100px"], styles["uBackgroundsurface-sunken"], styles["uBordernone"], styles["uBorderBottom1-5px-solid-rgba-255-255-255-0-15"], styles["uBorderRadius0"], styles["uTextAligncenter"], styles["uPadding8px-4px"]].join(' ')} type="number"
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
            <div className={styles.duplicatesPage}>
              <div className={styles.duplicatesHeader}>
                <div className={styles.duplicatesHeaderIcon}>
                  <Copy size={20} />
                </div>
                <div>
                  <h2 className={styles.duplicatesTitle}>Detección de Duplicados</h2>
                  <p className={styles.duplicatesSubtitle}>{duplicados.length} grupos potenciales encontrados</p>
                </div>
              </div>

              {/* Minimalist Filters */}
              <div className={styles.duplicatesFilters}>
                <div className={[styles["uDisplaygrid"], styles["uGridTemplateColumnsrepeat-auto-fit-minmax-200px-1fr"], styles["uGap24px"]].join(' ')}>
                  <div>
                    <label className={[styles["uDisplayblock"], styles["uFontSize9px"], styles["uColortext-muted"], styles["uFontWeight800"], styles["uTextTransformuppercase"], styles["uLetterSpacing1px"], styles["uMarginBottom12px"]].join(' ')}>Filtrar por Estados</label>
                    <div className={[styles["uDisplayflex"], styles["uFlexWrapwrap"], styles["uGap6px"]].join(' ')}>
                      {allEstados.map(e => (
                        <button className={[styles["uPadding6px-12px"], styles["uBorderRadius8px"], styles["uFontSize10px"], styles["uFontWeight700"], styles["uCursorpointer"], styles["uTransitionall-0-2s"]].join(' ')} key={e} onClick={() => toggleFilter(selectedEstados, setSelectedEstados, e)} style={{ background: selectedEstados.includes(e) ? 'var(--brand-muted-soft)' : 'var(--surface-card)', color: selectedEstados.includes(e) ? 'var(--action-primary)' : 'var(--text-secondary)', border: `1px solid ${selectedEstados.includes(e) ? 'var(--control-border-focus)' : 'var(--border-subtle)'}` }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={[styles["uDisplayblock"], styles["uFontSize9px"], styles["uColortext-muted"], styles["uFontWeight800"], styles["uTextTransformuppercase"], styles["uLetterSpacing1px"], styles["uMarginBottom12px"]].join(' ')}>Filtrar por Analistas</label>
                    <div className={[styles["uDisplayflex"], styles["uFlexWrapwrap"], styles["uGap6px"]].join(' ')}>
                      {allAnalistas.map(a => (
                        <button className={[styles["uPadding6px-12px"], styles["uBorderRadius8px"], styles["uFontSize10px"], styles["uFontWeight700"], styles["uCursorpointer"], styles["uTransitionall-0-2s"]].join(' ')} key={a} onClick={() => toggleFilter(selectedAnalistas, setSelectedAnalistas, a)} style={{ background: selectedAnalistas.includes(a) ? 'var(--brand-muted-soft)' : 'var(--surface-card)', color: selectedAnalistas.includes(a) ? 'var(--action-primary)' : 'var(--text-secondary)', border: `1px solid ${selectedAnalistas.includes(a) ? 'var(--control-border-focus)' : 'var(--border-subtle)'}` }}>
                          {displayAnalista(a)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={[styles["uDisplayblock"], styles["uFontSize9px"], styles["uColortext-muted"], styles["uFontWeight800"], styles["uTextTransformuppercase"], styles["uLetterSpacing1px"], styles["uMarginBottom12px"]].join(' ')}>Rango de Fecha</label>
                    <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap8px"]].join(' ')}>
                      <input className={[styles["uFlex1"], styles["uBackground0a0a0a"], styles["uBorder1px-solid-rgba-255-255-255-0-1"], styles["uColorccc"], styles["uPadding10px"], styles["uBorderRadius8px"], styles["uFontSize11px"], styles["uOutlinenone"]].join(' ')} type="date" value={duplicadosFechaDesde} onChange={e => setDuplicadosFechaDesde(e.target.value)} />
                      <span className={[styles["uColortext-muted"]].join(' ')}>-</span>
                      <input className={[styles["uFlex1"], styles["uBackground0a0a0a"], styles["uBorder1px-solid-rgba-255-255-255-0-1"], styles["uColorccc"], styles["uPadding10px"], styles["uBorderRadius8px"], styles["uFontSize11px"], styles["uOutlinenone"]].join(' ')} type="date" value={duplicadosFechaHasta} onChange={e => setDuplicadosFechaHasta(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Duplicados List */}
              {duplicados.length === 0 ? (
                 <div className={styles.duplicatesEmpty}>
                    <CheckCircle size={34} />
                    <p>Sin duplicados</p>
                    <span>No se encontraron registros duplicados con estos filtros.</span>
                 </div>
              ) : (
                 <div className={[styles["uDisplaygrid"], styles["uGridTemplateColumnsrepeat-auto-fill-minmax-450px-1fr"], styles["uGap24px"]].join(' ')}>
                   {duplicados.map(grupo => (
                      <div className={[styles["uBackground0a0a0a"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius16px"], styles["uPadding24px"], styles["uBoxShadowshadow-md"]].join(' ')} key={grupo.key}>
                         <div className={[styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemscenter"], styles["uMarginBottom20px"]].join(' ')}>
                            <div>
                               <h4 className={[styles["uFontSize16px"], styles["uFontWeight900"], styles["uColortext-strong"], styles["uMarginBottom4px"]].join(' ')}>{grupo.tipo === 'cuil' ? grupo.key : grupo.registros[0].nombre?.toUpperCase()}</h4>
                               <div className={[styles["uFontSize10px"], styles["uColortext-muted"], styles["uFontWeight800"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"]].join(' ')}>
                                 Coincidencia por {grupo.tipo}
                               </div>
                            </div>
                            <div className={[styles["uBackgroundrgba-255-51-102-0-1"], styles["uColorff3366"], styles["uFontSize11px"], styles["uFontWeight900"], styles["uPadding6px-12px"], styles["uBorderRadius20px"], styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap6px"]].join(' ')}>
                              <AlertTriangle size={12} /> {grupo.registros.length} Registros
                            </div>
                         </div>
                         
                         <div className={[styles["uDisplaygrid"], styles["uGridTemplateColumns1fr"], styles["uGap8px"]].join(' ')}>
                            {grupo.registros.map((r: any) => (
                               <div className={[styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemscenter"], styles["uPadding16px"], styles["uBackgroundsurface-sunken"], styles["uBorderRadius10px"], styles["uTransitionall-0-2s"]].join(' ')} key={r.id}>
                                  <div className={[styles["uFlex1"], styles["uMinWidth0"], styles["uPaddingRight16px"]].join(' ')}>
                                    <div className={[styles["uColortext-strong"], styles["uFontSize13px"], styles["uFontWeight700"], styles["uMarginBottom4px"], styles["uWhiteSpacenowrap"], styles["uOverflowhidden"], styles["uTextOverflowellipsis"]].join(' ')}>{r.nombre}</div>
                                    <div className={[styles["uColortext-muted"], styles["uFontSize11px"], styles["uFontWeight500"], styles["uFontFamilymonospace"]].join(' ')}>{r.cuil} • {displayAnalista(r.analista)}</div>
                                  </div>
                                  <div className={[styles["uTextAlignright"], styles["uFlexShrink0"]].join(' ')}>
                                    <div className={[styles["uColortext-strong"], styles["uFontSize14px"], styles["uFontWeight900"], styles["uMarginBottom4px"]].join(' ')}>{formatCurrency(r.monto)}</div>
                                    <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap8px"], styles["uJustifyContentflex-end"]].join(' ')}>
                                      <span className={[styles["uColor34d399"], styles["uFontSize9px"], styles["uFontWeight800"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"]].join(' ')}>{r.estado}</span>
                                      <span className={[styles["uColortext-muted"], styles["uFontSize10px"]].join(' ')}>{r.fecha ? formatDate(r.fecha) : '—'}</span>
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
              <div className={styles.duplicatesSectionHeader}>
                <div className={styles.duplicatesHeaderIcon}>
                  <Users size={20} />
                </div>
                <div>
                  <h2 className={styles.duplicatesTitle}>Variantes de Empleador</h2>
                  <p className={styles.duplicatesSubtitle}>{variantesEmpleador.length} grupos con discrepancias</p>
                </div>
              </div>

              {variantesEmpleador.length === 0 ? (
                 <div className={styles.duplicatesEmpty}>
                    <CheckCircle size={34} />
                    <p>Empleadores normalizados</p>
                    <span>No se encontraron empleadores con múltiples formas de escritura.</span>
                 </div>
              ) : (
                 <div className={[styles["uDisplaygrid"], styles["uGridTemplateColumnsrepeat-auto-fill-minmax-400px-1fr"], styles["uGap16px"]].join(' ')}>
                   {variantesEmpleador.map((v, i) => (
                      <div className={[styles["uBackground0a0a0a"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius16px"], styles["uPadding24px"], styles["uBoxShadowshadow-md"]].join(' ')} key={i}>
                        <div className={[styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemsflex-start"], styles["uMarginBottom20px"]].join(' ')}>
                           <div>
                              <h4 className={[styles["uFontSize16px"], styles["uFontWeight900"], styles["uColorfbbf24"], styles["uMarginBottom6px"]].join(' ')}>{v.normalizado}</h4>
                              <p className={[styles["uFontSize11px"], styles["uColortext-muted"], styles["uFontWeight600"]].join(' ')}>{v.cantidad} Registros Afectados • {formatCurrency(v.monto)}</p>
                           </div>
                           <div className={[styles["uBackgroundrgba-251-191-36-0-1"], styles["uColorfbbf24"], styles["uFontSize11px"], styles["uFontWeight900"], styles["uPadding6px-12px"], styles["uBorderRadius20px"]].join(' ')}>
                             {v.variantes.length} Variantes
                           </div>
                        </div>
                        <div className={[styles["uDisplayflex"], styles["uFlexWrapwrap"], styles["uGap8px"]].join(' ')}>
                           {v.variantes.map((varName, j) => (
                              <span className={[styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius8px"], styles["uPadding8px-14px"], styles["uColorccc"], styles["uFontSize12px"], styles["uFontWeight600"]].join(' ')} key={j}>
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
                ...(isAdmin ? [{ id: 'reasignados' as const, label: 'Reasignados', icon: ArrowRight }] : []),
                ...(isAdmin ? [{ id: 'avisos' as const, label: 'Avisos', icon: Bell }] : []),
              ]}
              active={actividadSubTab}
              onSelect={setActividadSubTab}
            />
          )}
          {activeTab === 'actividad' && actividadSubTab === 'reasignados' && isAdmin && (
            <ReasignadosTab />
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
              .filter((a: any) => a && !['Favorito añadido', 'Favorito quitado', 'Reasignación'].includes(a))
            )];
            const allAuditAnalistas = [...new Set((auditoriaRegistros || []).map((r: any) => r.analista).filter(Boolean))];

            const filtered = (auditoriaRegistros || []).filter((reg: any) => {
              if (['Favorito añadido', 'Favorito quitado', 'Reasignación'].includes(reg.accion)) return false;
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
              const vistos = new Set<string>();
              for (const reg of filtered) {
                // Deduplica filas idénticas (mismo id, o misma firma si falta id).
                const firma = reg.id != null
                  ? `id:${reg.id}`
                  : `${reg.fecha_hora}|${reg.accion}|${reg.id_registro}|${reg.campo_modificado}|${reg.valor_anterior}|${reg.valor_nuevo}`;
                if (vistos.has(firma)) continue;
                vistos.add(firma);
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
              <div className={[styles["uAnimationfadeIn-0-3s-ease-out"]].join(' ')}>
                {/* HEADER */}
                <header className={[styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemsflex-start"], styles["uMarginBottom24px"]].join(' ')}>
                  <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap12px"]].join(' ')}>
                    <div className={[styles["uWidth4px"], styles["uHeight28px"], styles["uBorderRadius2px"], styles["uBackgroundfff"]].join(' ')} />
                    <div>
                      <h1 className={[styles["uFontSize24px"], styles["uFontWeight900"], styles["uColortext-strong"], styles["uLetterSpacing0-5px"]].join(' ')}>Log de Auditoría</h1>
                      <p className={[styles["uFontSize12px"], styles["uColortext-muted"], styles["uMarginTop2px"]].join(' ')}>Registro de actividad del sistema</p>
                    </div>
                  </div>
                  <div className={[styles["uDisplayflex"], styles["uGap12px"]].join(' ')}>
                    <button className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap6px"], styles["uPadding8px-14px"], styles["uBorderRadius6px"], styles["uFontSize11px"], styles["uFontWeight700"], styles["uBordernone"], styles["uTransitionall-0-2s"], styles.auditDeleteButton].join(' ')} onClick={limpiarLogAuditoria}
                      disabled={limpiandoLog || !auditoriaRegistros?.length}
                      style={{ cursor: (limpiandoLog || !auditoriaRegistros?.length) ? 'not-allowed' : 'pointer', opacity: (limpiandoLog || !auditoriaRegistros?.length) ? 0.45 : 1 }}>
                      <Trash2 size={13} /> {limpiandoLog ? 'Limpiando...' : 'Limpiar Todo'}
                    </button>
                  </div>
                </header>

                {/* FILTERS TOOLBAR */}
                <div className={[styles["uDisplayflex"], styles["uFlexWrapwrap"], styles["uGap12px"], styles["uAlignItemscenter"], styles["uPaddingBottom20px"], styles["uMarginBottom20px"], styles["uBorderBottom1px-solid-border-subtle"]].join(' ')}>
                  <div className={[styles["uPositionrelative"], styles["uFlex1-1-200px"]].join(' ')}>
                    <Search className={[styles["uPositionabsolute"], styles["uLeft12px"], styles["uTop50"], styles["uTransformtranslateY-50"], styles["uColortext-muted"]].join(' ')} size={14} />
                    <input className={[styles["uWidth100"], styles["uPadding8px-12px-8px-36px"], styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius6px"], styles["uColoreaeaea"], styles["uFontSize12px"], styles["uOutlinenone"], styles["uTransitionall-0-2s"]].join(' ')}
                      value={auditSearch} onChange={e => { setAuditSearch(e.target.value); setAuditPage(1); }}
                      placeholder="Buscar cliente, analista o acción..."
                      onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                    />
                  </div>
                  
                  <CustomSelect
                    value={auditFilterAccion}
                    onChange={val => { setAuditFilterAccion(String(val)); setAuditPage(1); }}
                    options={[{ label: 'Todas las acciones', value: 'todas' }, ...allAcciones.map(a => ({ label: a, value: a }))]}
                    width="150px"
                  />

                  <CustomSelect
                    value={auditFilterAnalista}
                    onChange={val => { setAuditFilterAnalista(String(val)); setAuditPage(1); }}
                    options={[{ label: 'Todos los analistas', value: 'todos' }, ...allAuditAnalistas.map(a => ({ label: a, value: a }))]}
                    width="150px"
                  />

                  <CustomSelect
                    value={auditFilterPeriodo}
                    onChange={val => { setAuditFilterPeriodo(String(val)); setAuditPage(1); }}
                    options={[{ label: 'Hoy', value: 'hoy' }, { label: 'Últimos 7 días', value: '7d' }, { label: 'Últimos 30 días', value: '30d' }, { label: 'Todo', value: 'todo' }]}
                    width="140px"
                  />

                  <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap6px"]].join(' ')}>
                    <input className={[styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius6px"], styles["uColorccc"], styles["uFontSize12px"], styles["uPadding8px-12px"], styles["uOutlinenone"], styles["uCursorpointer"], styles["uColorSchemedark"]].join(' ')}
                      type="date"
                      value={auditFechaDesde}
                      onChange={e => { setAuditFechaDesde(e.target.value); setAuditPage(1); }}
                      title="Fecha desde"
                    />
                    <span className={[styles["uColortext-muted"], styles["uFontSize12px"]].join(' ')}>→</span>
                    <input className={[styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius6px"], styles["uColorccc"], styles["uFontSize12px"], styles["uPadding8px-12px"], styles["uOutlinenone"], styles["uCursorpointer"], styles["uColorSchemedark"]].join(' ')}
                      type="date"
                      value={auditFechaHasta}
                      onChange={e => { setAuditFechaHasta(e.target.value); setAuditPage(1); }}
                      title="Fecha hasta"
                    />
                    {(auditFechaDesde || auditFechaHasta) && (
                      <button className={[styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius6px"], styles["uColortext-muted"], styles["uFontSize12px"], styles["uPadding8px-10px"], styles["uOutlinenone"], styles["uCursorpointer"], styles["uLineHeight1"]].join(' ')}
                        onClick={() => { setAuditFechaDesde(''); setAuditFechaHasta(''); setAuditPage(1); }}
                        title="Limpiar fechas"
                      >✕</button>
                    )}
                  </div>
                </div>

                {/* DATA TABLE */}
                <div className={[styles["uBackgroundsurface-card"], styles["uBorder1px-solid-border-subtle"], styles["uBorderRadius6px"], styles["uOverflowhidden"]].join(' ')}>
                  {auditoriaLoading ? (
                    <div className={["loading-container", styles["uMinHeight200px"]].join(' ')}><div className="spinner" /><span>Cargando registros...</span></div>
                  ) : !filtered.length ? (
                    <div className={["empty-state", styles["uMinHeight200px"]].join(' ')}>
                      <Shield className={[styles["uMarginBottom8px"]].join(' ')} size={36} color="#333" />
                      <p className={[styles["uFontWeight800"], styles["uFontSize13px"], styles["uColortext-muted"]].join(' ')}>{auditSearch || auditFilterAccion !== 'todas' || auditFilterAnalista !== 'todos' || auditFilterPeriodo !== 'todo' ? 'Sin resultados para los filtros aplicados' : 'No hay registros de auditoría'}</p>
                    </div>
                  ) : (
                    <>
                      <div className={[styles["uOverflowXauto"]].join(' ')}>
                        <table className={["data-table", styles["uMarginBottom0"], styles["uTableLayoutfixed"], styles["uMinWidth1200px"]].join(' ')}>
                          <thead>
                            <tr className={[styles["uBackgroundsurface-sunken"]].join(' ')}>
                              <th className={[styles["uTextAlignleft"], styles["uFontSize10px"], styles["uFontWeight800"], styles["uColortext-muted"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"], styles["uPadding12px-16px"], styles["uWidth160px"]].join(' ')}>Fecha / Hora</th>
                              <th className={[styles["uTextAlignleft"], styles["uFontSize10px"], styles["uFontWeight800"], styles["uColortext-muted"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"], styles["uPadding12px-16px"], styles["uWidth160px"]].join(' ')}>Analista</th>
                              <th className={[styles["uTextAlignleft"], styles["uFontSize10px"], styles["uFontWeight800"], styles["uColortext-muted"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"], styles["uPadding12px-16px"], styles["uWidth180px"]].join(' ')}>Acción</th>
                              <th className={[styles["uTextAlignleft"], styles["uFontSize10px"], styles["uFontWeight800"], styles["uColortext-muted"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"], styles["uPadding12px-16px"], styles["uWidth240px"]].join(' ')}>Cliente</th>
                              <th className={[styles["uTextAlignleft"], styles["uFontSize10px"], styles["uFontWeight800"], styles["uColortext-muted"], styles["uTextTransformuppercase"], styles["uLetterSpacing0-5px1llh9"], styles["uPadding12px-16px"]].join(' ')}>Detalles</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paged.map((reg: any, idx: number) => {
                              const rowKey = reg.id ?? `${reg.fecha_hora}-${idx}`;
                              const ac = accionColor(reg.accion);
                              return (
                                <tr className={[styles["uBorderBottom1px-solid-border-subtle"], styles.auditRow].join(' ')}
                                  key={rowKey}
                                >
                                  <td className={[styles["uPadding12px-16px"], styles["uVerticalAlignmiddle"], styles["uOverflowhidden"]].join(' ')}>
                                    <div className={[styles["uFontSize12px"], styles["uColoreaeaea"], styles["uWhiteSpacenowrap"], styles["uFontWeight600"]].join(' ')}>{relativeTime(reg.fecha_hora)}</div>
                                    <div className={[styles["uFontSize10px"], styles["uColortext-muted"], styles["uMarginTop2px"], styles["uWhiteSpacenowrap"]].join(' ')}>{formatDateTime(reg.fecha_hora)}</div>
                                  </td>
                                  <td className={[styles["uPadding12px-16px"], styles["uVerticalAlignmiddle"], styles["uOverflowhidden"]].join(' ')}>
                                    <span className={[styles["uFontSize12px"], styles["uColorccc"], styles["uFontWeight600"], styles["uWhiteSpacenowrap"], styles["uTextOverflowellipsis"], styles["uOverflowhidden"], styles["uDisplayblock"]].join(' ')}>{reg.analista || reg.id_analista || '—'}</span>
                                  </td>
                                  <td className={[styles["uPadding12px-16px"], styles["uVerticalAlignmiddle"], styles["uOverflowhidden"]].join(' ')}>
                                    <span className={[styles["uDisplayinline-flex"], styles["uAlignItemscenter"], styles["uGap6px"], styles["uFontSize11px"], styles["uFontWeight700"], styles["uWhiteSpacenowrap"]].join(' ')} style={{ color: ac.color }}>
                                      {accionIcon(reg.accion)}
                                      {reg.accion}
                                    </span>
                                  </td>
                                  <td className={[styles["uPadding12px-16px"], styles["uVerticalAlignmiddle"], styles["uOverflowhidden"]].join(' ')}>
                                    <div className={[styles["uFontSize12px"], styles["uColoreaeaea"], styles["uFontWeight600"], styles["uWhiteSpacenowrap"], styles["uTextOverflowellipsis"], styles["uOverflowhidden"]].join(' ')}>{reg.nombre || '—'}</div>
                                    <div className={[styles["uFontSize10px"], styles["uColortext-muted"], styles["uMarginTop2px"], styles["uWhiteSpacenowrap"], styles["uFontFamilymonospace"]].join(' ')}>{reg.cuil || '—'}</div>
                                  </td>
                                  <td className={[styles["uPadding12px-16px"], styles["uVerticalAlignmiddle"], styles["uOverflowhidden"]].join(' ')}>
                                    {renderDetalleAudit(reg)}
                                    {reg.isGroup && reg.subRecords?.length > 1 && (
                                      <button className={[styles["uMarginTop6px"], styles["uDisplayinline-flex"], styles["uAlignItemscenter"], styles["uGap4px"], styles["uBackgroundsurface-sunken"], styles["uBorder1px-solid-rgba-255-255-255-0-1"], styles["uColortext-muted"], styles["uPadding4px-8px"], styles["uBorderRadius4px"], styles["uFontSize10px"], styles["uFontWeight700"], styles["uCursorpointer"], styles["uTransitionall-0-2s"], styles.historyButton].join(' ')}
                                        onClick={() => setAuditGroupModal({ title: `Historial de ${reg.nombre || 'Registro'}`, records: reg.subRecords })}
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
                      <div className={[styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemscenter"], styles["uPadding12px-20px"], styles["uBorderTop1px-solid-border-subtle"], styles["uBackgroundsurface-sunken"]].join(' ')}>
                        <span className={[styles["uFontSize11px"], styles["uColortext-muted"], styles["uFontWeight600"]].join(' ')}>
                          Mostrando {(safePage - 1) * AUDIT_PAGE_SIZE + (groupedFiltered.length > 0 ? 1 : 0)}–{Math.min(safePage * AUDIT_PAGE_SIZE, groupedFiltered.length)} de {groupedFiltered.length}
                        </span>
                        <div className={[styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uGap6px"]].join(' ')}>
                          <button className={[styles["uWidth28px"], styles["uHeight28px"], styles["uBorderRadius4px"], styles["uBorder1px-solid-border-subtle"], styles["uBackgroundsurface-sunken"], styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uJustifyContentcenter"]].join(' ')} onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} style={{ color: safePage <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: safePage <= 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={14} /></button>
                          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let page: number;
                            if (totalPages <= 5) page = i + 1;
                            else if (safePage <= 3) page = i + 1;
                            else if (safePage >= totalPages - 2) page = totalPages - 4 + i;
                            else page = safePage - 2 + i;
                            return (
                              <button className={[styles["uWidth28px"], styles["uHeight28px"], styles["uBorderRadius4px"], styles["uBorder1px-solid"], styles["uFontSize11px"], styles["uFontWeight700"], styles["uCursorpointer"], styles["uTransitionall-0-15s"], styles.uFontFamilyUi].join(' ')} key={page} onClick={() => setAuditPage(page)} style={{ borderColor: safePage === page ? 'var(--control-border-focus)' : 'var(--border-subtle)', background: safePage === page ? 'var(--brand-muted-soft)' : 'var(--surface-card)', color: safePage === page ? 'var(--action-primary)' : 'var(--text-secondary)' }}>{page}</button>
                            );
                          })}
                          <button className={[styles["uWidth28px"], styles["uHeight28px"], styles["uBorderRadius4px"], styles["uBorder1px-solid-border-subtle"], styles["uBackgroundsurface-sunken"], styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uJustifyContentcenter"]].join(' ')} onClick={() => setAuditPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{ color: safePage >= totalPages ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer' }}><ChevronRight size={14} /></button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

              </div>
            );
          })()}

          {/* TABS PESADAS (componentes dinamicos) — KEEP-ALIVE: se montan al primer acceso y se ocultan con display:none */}
          {/* P-C: sin estado critico ni operaciones activas -> montaje condicional real */}
          {heavyVisibility['comparativa-tab'] && (
            <ComparativaAnalistasTab />
          )}
          {visitedTabs.has('resumen-mensual') && (
            <div style={{ display: heavyVisibility['resumen-mensual'] ? 'block' : 'none' }}>
              <ResumenMensualTab
                registros={ctxRegistros}
                objetivos={ctxObjetivos}
                diasConfig={ctxDias}
                onSuccess={showSuccess}
                onError={showError}
                active={heavyVisibility['resumen-mensual']}
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
        <div className={[styles["uPositionfixed"], styles["uTop0"], styles["uLeft0"], styles["uRight0"], styles["uBottom0"], styles["uBackgroundrgba-0-0-0-0-6"], styles["uBackdropFilterblur-5px"], styles["uZIndex99999"], styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uJustifyContentcenter"], styles["uPadding20px"], styles["uAnimationfadeIn-0-2s-ease-out"]].join(' ')}>
          <div className={[styles["uBackgroundsurface-card"], styles["uBorder1px-solid-rgba-255-255-255-0-1"], styles["uBorderRadius12px"], styles["uWidth100"], styles["uMaxWidth880px"], styles["uMaxHeight90vh"], styles["uDisplayflex"], styles["uFlexDirectioncolumn"], styles["uBoxShadowshadow-md"], styles["uAnimationslideInUp-0-2s-ease-out"]].join(' ')}>
            <div className={[styles["uPadding20px-24px"], styles["uBorderBottom1px-solid-border-subtle"], styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemscenter"]].join(' ')}>
              <div>
                <h3 className={[styles["uFontSize21px"], styles["uFontWeight800"], styles["uColortext-strong"]].join(' ')}>{auditGroupModal.title}</h3>
                <p className={[styles["uFontSize13px"], styles["uColortext-muted"], styles["uMarginTop4px"]].join(' ')}>{auditGroupModal.records.length} modificaciones registradas</p>
              </div>
              <button className={[styles["uBackgroundsurface-sunken"], styles["uBordernone"], styles["uColortext-muted"], styles["uCursorpointer"], styles["uPadding6px"], styles["uBorderRadius50"], styles["uDisplayflex"], styles["uAlignItemscenter"], styles["uJustifyContentcenter"], styles["uTransitionall-0-2s"], styles.modalCloseButton].join(' ')} onClick={() => setAuditGroupModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className={[styles["uPadding24px"], styles["uOverflowYauto"], styles["uFlex1"], styles["uDisplayflex"], styles["uFlexDirectioncolumn"], styles["uGap12px"]].join(' ')}>
              {auditGroupModal.records.map((r, i) => (
                <div className={[styles["uBackgroundsurface-sunken"], styles["uPadding20px-24px"], styles["uBorderRadius8px"], styles["uBorder1px-solid-border-subtle"]].join(' ')} key={i}>
                  <div className={[styles["uDisplayflex"], styles["uJustifyContentspace-between"], styles["uAlignItemscenter"], styles["uMarginBottom16px"], styles["uPaddingBottom14px"], styles["uBorderBottom1px-dashed-border-subtle"]].join(' ')}>
                    <span className={[styles["uFontSize14px"], styles["uColortext-muted"], styles["uFontWeight600"]].join(' ')}>{formatDateTime(r.fecha_hora)}</span>
                    <span className={[styles["uFontSize14px"], styles["uColoreaeaea"], styles["uFontWeight700"], styles["uBackgroundsurface-sunken"], styles["uPadding5px-12px"], styles["uBorderRadius4px"]].join(' ')}>
                      {r.analista || r.id_analista}
                    </span>
                  </div>
                  <div className={[styles["uPaddingLeft4px"]].join(' ')}>
                    {renderCamposAudit(r)}
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
