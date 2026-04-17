'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import {
  Registro, HistoricoVenta, Recordatorio, Objetivo, AlertaConfig, DiasConfig,
  parseRegistros, parseRows,
  registroSchema, objetivoSchema, diasConfigSchema, historicoVentaSchema, alertaConfigSchema,
} from '@/types';

// Schemas de payloads broadcast: wrap cada entidad con el tipo de cambio.
// Se validan en los handlers para no consumir mensajes malformados
// (p.ej. de clientes con versión desfasada) y solo loguean en consola.
const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const registroChangeSchema = z.object({ type: changeType, registro: registroSchema });
const objetivoChangeSchema = z.object({ type: changeType, objetivo: objetivoSchema });
const diasConfigChangeSchema = z.object({ type: changeType, config: diasConfigSchema });
const alertaConfigChangeSchema = z.object({ type: changeType, config: alertaConfigSchema });
const historicoChangeSchema = z.object({ type: changeType, historico: historicoVentaSchema });
const recordatorioChangeSchema = z.object({ type: changeType, mostrado: z.boolean().optional() });

function validateBroadcast<T>(event: string, schema: z.ZodType<T>, payload: unknown): T | null {
  const r = schema.safeParse(payload);
  if (!r.success) {
    console.warn(`[broadcast] ${event} payload inválido:`, r.error.issues);
    return null;
  }
  return r.data;
}

export type { Objetivo, DiasConfig, AlertaConfig };

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface ReminderAlertData {
  id: string;
  nombre: string;
  nota?: string;
  fecha_hora: string;
  analista?: string;
  estado?: string;
}

interface DataCtx {
  registros: Registro[];
  objetivos: Objetivo[];
  diasConfig: DiasConfig[];
  historicoVentas: HistoricoVenta[];
  alertasConfig: AlertaConfig[];
  loading: boolean;
  pendingReminders: number;
  reminderAlert: ReminderAlertData | null;
  registrosWindowMonths: number;
  setRegistrosWindowMonths: (months: number) => void;
  // Acciones atómicas (local + broadcast) para mutaciones de un item.
  applyRegistroChange: (type: ChangeType, registro: Registro) => void;
  applyObjetivoChange: (type: ChangeType, objetivo: Objetivo) => void;
  applyDiasConfigChange: (type: ChangeType, config: DiasConfig) => void;
  applyAlertasConfigChange: (type: ChangeType, config: AlertaConfig) => void;
  applyHistoricoChange: (type: ChangeType, historico: HistoricoVenta) => void;
  // Mutadores locales (sin broadcast) para casos bulk/full-replace.
  mutateRegistros: (mapper: (prev: Registro[]) => Registro[]) => void;
  mutateObjetivos: (mapper: (prev: Objetivo[]) => Objetivo[]) => void;
  mutateDiasConfig: (mapper: (prev: DiasConfig[]) => DiasConfig[]) => void;
  mutateAlertasConfig: (mapper: (prev: AlertaConfig[]) => AlertaConfig[]) => void;
  mutateHistoricoVentas: (mapper: (prev: HistoricoVenta[]) => HistoricoVenta[]) => void;
  adjustPendingReminders: (delta: number) => void;
  // Acciones ya existentes
  clearReminderAlert: () => void;
  markReminderCompleted: (id: string) => Promise<void>;
  refresh: (silent?: boolean) => void;
  pushRegistroChange: (type: ChangeType, registro: Registro) => void;
  pushObjetivosChange: (type: ChangeType, objetivo: Objetivo) => void;
  pushDiasConfigChange: (type: ChangeType, config: DiasConfig) => void;
  pushAlertasConfigChange: (type: ChangeType, config: AlertaConfig) => void;
  pushHistoricoChange: (type: ChangeType, historico: HistoricoVenta) => void;
  pushRecordatorioChange: (type: ChangeType, recordatorio: Recordatorio) => void;
  pushBulkRefresh: () => void;
}

// Ventana default para la query de registros. Evita traer toda la historia
// en cada refresh. Reportes/analistas que necesiten más pueden llamar a
// setRegistrosWindowMonths(N).
const DEFAULT_REGISTROS_WINDOW_MONTHS = 6;

// Cap de seguridad. Con ventana de 6 meses y ritmo actual (~100 rows/mes)
// esto deja ~8x de margen.
const REGISTROS_SAFETY_LIMIT = 5000;

const DataContext = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [diasConfig, setDiasConfig] = useState<DiasConfig[]>([]);
  const [historicoVentas, setHistoricoVentas] = useState<HistoricoVenta[]>([]);
  const [alertasConfig, setAlertasConfig] = useState<AlertaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingReminders, setPendingReminders] = useState(0);
  const [reminderAlert, setReminderAlert] = useState<ReminderAlertData | null>(null);
  const [registrosWindowMonths, setRegistrosWindowMonths] = useState<number>(DEFAULT_REGISTROS_WINDOW_MONTHS);
  const initialized = useRef(false);
  const shownIds = useRef(new Set<string>());
  const { reportError } = useDataError();

  const clearReminderAlert = useCallback(() => {
    setReminderAlert(null);
  }, []);

  const checkDueReminders = useCallback(async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('recordatorios')
      .select('id, nombre, nota, fecha_hora, analista, estado')
      .eq('mostrado', false)
      .lte('fecha_hora', now)
      .order('fecha_hora', { ascending: true });

    if (error) { reportError('checkDueReminders', error); return; }
    if (!data || data.length === 0) return;
    const next = data.find(r => !shownIds.current.has(r.id));
    if (next) {
      shownIds.current.add(next.id);
      setReminderAlert({
        id: next.id, nombre: next.nombre, nota: next.nota,
        fecha_hora: next.fecha_hora, analista: next.analista, estado: next.estado,
      });
    }
  }, [reportError]);

  const markReminderCompleted = useCallback(async (id: string) => {
    setReminderAlert(null);
    setPendingReminders(n => Math.max(0, n - 1));
    const { error } = await supabase.from('recordatorios').update({ mostrado: true }).eq('id', id);
    if (error) {
      setPendingReminders(n => n + 1); // revertir optimista
      reportError('markReminderCompleted', error);
    }
  }, [reportError]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    // Ventana: trae registros con fecha >= (hoy - N meses) O fecha nula.
    // Si months <= 0, se omite el filtro (modo "Todo").
    const cols = 'id,cuil,nombre,puntaje,es_re,analista,fecha,fecha_score,monto,estado,comentarios,tipo_cliente,acuerdo_precios,cuotas,rango_etario,sexo,empleador,localidad,created_at,updated_at';
    let registrosQuery = supabase.from('registros').select(cols);
    if (registrosWindowMonths > 0) {
      const since = new Date();
      since.setMonth(since.getMonth() - registrosWindowMonths);
      const sinceIso = since.toISOString().slice(0, 10);
      registrosQuery = registrosQuery.or(`fecha.gte.${sinceIso},fecha.is.null`);
    }
    const [regsR, objsR, diasR, recR, histR, alertasR] = await Promise.all([
      registrosQuery.order('fecha', { ascending: false }).limit(REGISTROS_SAFETY_LIMIT),
      supabase.from('objetivos').select('id,analista,mes,anio,meta_ventas,meta_operaciones'),
      supabase.from('dias_habiles_config').select('analista,dias_habiles,dias_transcurridos'),
      supabase.from('recordatorios').select('id', { count: 'exact', head: true }).eq('mostrado', false),
      supabase.from('historico_ventas').select('id,analista,anio,mes,capital_real,ops_real'),
      supabase.from('alertas_config').select('id,nombre,estado,dias,mensaje,color'),
    ]);
    if (regsR.error) reportError('refresh:registros', regsR.error);
    else if (regsR.data) {
      let dropped = 0;
      const parsed = parseRegistros(regsR.data, (i, err, row) => {
        dropped++;
        const rowId = (row && typeof row === 'object' && 'id' in row) ? (row as { id: unknown }).id : '?';
        console.warn(`[DataContext] registro inválido [${i}] id=${rowId}:`, err.issues);
      });
      if (dropped > 0) reportError('refresh:registros', { message: `${dropped} registro(s) descartado(s) por validación — revisá consola` });
      setRegistros(parsed);
    }
    const validateAndSet = <T,>(
      scope: string,
      schema: z.ZodType<T>,
      rows: unknown,
      setter: (rows: T[]) => void,
    ) => {
      let dropped = 0;
      const parsed = parseRows<T>(schema, rows, (i, err, row) => {
        dropped++;
        const rowId = (row && typeof row === 'object' && 'id' in row) ? (row as { id: unknown }).id : '?';
        console.warn(`[DataContext] ${scope} inválido [${i}] id=${rowId}:`, err.issues);
      });
      if (dropped > 0) reportError(`refresh:${scope}`, { message: `${dropped} fila(s) descartada(s) en ${scope} — revisá consola` });
      setter(parsed);
    };
    if (objsR.error) reportError('refresh:objetivos', objsR.error);
    else validateAndSet<Objetivo>('objetivos', objetivoSchema, objsR.data, setObjetivos);
    if (diasR.error) reportError('refresh:dias_habiles_config', diasR.error);
    else validateAndSet<DiasConfig>('dias_habiles_config', diasConfigSchema, diasR.data, setDiasConfig);
    if (recR.error) reportError('refresh:recordatorios', recR.error);
    else setPendingReminders(recR.count || 0);
    if (histR.error) reportError('refresh:historico_ventas', histR.error);
    else validateAndSet<HistoricoVenta>('historico_ventas', historicoVentaSchema, histR.data, setHistoricoVentas);
    if (alertasR.error) reportError('refresh:alertas_config', alertasR.error);
    else validateAndSet<AlertaConfig>('alertas_config', alertaConfigSchema, alertasR.data, setAlertasConfig);
    setLoading(false);
  }, [reportError, registrosWindowMonths]);

  useEffect(() => {
    // Corre en mount y cada vez que cambia la identidad de `refresh`
    // (lo que pasa cuando cambia registrosWindowMonths).
    // initialized.current se mantiene por compatibilidad con otros gates si los hay.
    initialized.current = true;
    refresh();
  }, [refresh]);

  // Refs estables para evitar dependencias cambiantes en el effect
  const refreshRef = useRef(refresh);
  const checkDueRef = useRef(checkDueReminders);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { checkDueRef.current = checkDueReminders; }, [checkDueReminders]);

  // ── Broadcast: un canal único con 6 eventos + bulk_refresh ─────────────────
  const broadcastRef = useRealtimeBroadcast('crm-broadcast', {
    registro_change: (payload) => {
      const data = validateBroadcast('registro_change', registroChangeSchema, payload);
      if (!data) return;
      const { type, registro } = data;
      if (type === 'INSERT') setRegistros(prev => [registro, ...prev]);
      else if (type === 'UPDATE') setRegistros(prev => prev.map(r => r.id === registro.id ? registro : r));
      else if (type === 'DELETE') setRegistros(prev => prev.filter(r => r.id !== registro.id));
    },
    objetivos_change: (payload) => {
      const data = validateBroadcast('objetivos_change', objetivoChangeSchema, payload);
      if (!data) return;
      const { type, objetivo } = data;
      if (type === 'INSERT' || type === 'UPDATE') {
        setObjetivos(prev => {
          const exists = prev.some(o => o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio);
          if (exists) return prev.map(o => o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio ? objetivo : o);
          return [...prev, objetivo];
        });
      } else if (type === 'DELETE') {
        setObjetivos(prev => prev.filter(o => !(o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio)));
      }
    },
    dias_config_change: (payload) => {
      const data = validateBroadcast('dias_config_change', diasConfigChangeSchema, payload);
      if (!data) return;
      const { type, config } = data;
      if (type === 'INSERT' || type === 'UPDATE') {
        setDiasConfig(prev => prev.some(d => d.analista === config.analista)
          ? prev.map(d => d.analista === config.analista ? config : d)
          : [...prev, config]);
      } else if (type === 'DELETE') {
        setDiasConfig(prev => prev.filter(d => d.analista !== config.analista));
      }
    },
    alertas_config_change: (payload) => {
      const data = validateBroadcast('alertas_config_change', alertaConfigChangeSchema, payload);
      if (!data) return;
      const { type, config } = data;
      if (type === 'INSERT' || type === 'UPDATE') {
        setAlertasConfig(prev => {
          const exists = prev.some(a => a.nombre === config.nombre && a.estado === config.estado);
          if (exists) return prev.map(a => a.nombre === config.nombre && a.estado === config.estado ? config : a);
          return [...prev, config];
        });
      } else if (type === 'DELETE') {
        setAlertasConfig(prev => prev.filter(a => !(a.nombre === config.nombre && a.estado === config.estado)));
      }
    },
    historico_change: (payload) => {
      const data = validateBroadcast('historico_change', historicoChangeSchema, payload);
      if (!data) return;
      const { type, historico } = data;
      if (type === 'INSERT' || type === 'UPDATE') {
        setHistoricoVentas(prev => {
          const exists = prev.some(h => h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes);
          if (exists) return prev.map(h => h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes ? historico : h);
          return [...prev, historico];
        });
      } else if (type === 'DELETE') {
        setHistoricoVentas(prev => prev.filter(h => !(h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes)));
      }
    },
    recordatorio_change: (payload) => {
      const data = validateBroadcast('recordatorio_change', recordatorioChangeSchema, payload);
      if (!data) return;
      const { type, mostrado } = data;
      if (type === 'INSERT' && !mostrado) setPendingReminders(n => n + 1);
      else if (type === 'UPDATE' && mostrado) setPendingReminders(n => Math.max(0, n - 1));
      else if (type === 'DELETE') setPendingReminders(n => Math.max(0, n - 1));
      checkDueRef.current();
    },
    bulk_refresh: () => { refreshRef.current(true); },
  });

  // ── Push callbacks (envían por broadcast) ──────────────────────────────────

  const pushBroadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    broadcastRef.current?.send({ type: 'broadcast', event, payload }).catch(() => { });
  }, [broadcastRef]);

  const pushRegistroChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', registro: Registro) => {
    pushBroadcast('registro_change', { type, registro });
  }, [pushBroadcast]);

  const pushObjetivosChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', objetivo: Objetivo) => {
    pushBroadcast('objetivos_change', { type, objetivo });
  }, [pushBroadcast]);

  const pushDiasConfigChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', config: DiasConfig) => {
    pushBroadcast('dias_config_change', { type, config });
  }, [pushBroadcast]);

  const pushAlertasConfigChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', config: AlertaConfig) => {
    pushBroadcast('alertas_config_change', { type, config });
  }, [pushBroadcast]);

  const pushHistoricoChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', historico: HistoricoVenta) => {
    pushBroadcast('historico_change', { type, historico });
  }, [pushBroadcast]);

  const pushRecordatorioChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', recordatorio: Recordatorio) => {
    pushBroadcast('recordatorio_change', { type, recordatorio, mostrado: recordatorio.mostrado });
  }, [pushBroadcast]);

  // Bulk refresh trigger - hace que todos los clientes recarguen datos
  const pushBulkRefresh = useCallback(() => {
    broadcastRef.current?.send({ type: 'broadcast', event: 'bulk_refresh', payload: {} });
  }, [broadcastRef]);

  // ── Mutadores locales (sin broadcast) ──────────────────────────────────────

  const mutateRegistros = useCallback((mapper: (prev: Registro[]) => Registro[]) => {
    setRegistros(mapper);
  }, []);

  const mutateObjetivos = useCallback((mapper: (prev: Objetivo[]) => Objetivo[]) => {
    setObjetivos(mapper);
  }, []);

  const mutateDiasConfig = useCallback((mapper: (prev: DiasConfig[]) => DiasConfig[]) => {
    setDiasConfig(mapper);
  }, []);

  const mutateAlertasConfig = useCallback((mapper: (prev: AlertaConfig[]) => AlertaConfig[]) => {
    setAlertasConfig(mapper);
  }, []);

  const mutateHistoricoVentas = useCallback((mapper: (prev: HistoricoVenta[]) => HistoricoVenta[]) => {
    setHistoricoVentas(mapper);
  }, []);

  const adjustPendingReminders = useCallback((delta: number) => {
    setPendingReminders(n => Math.max(0, n + delta));
  }, []);

  // ── Acciones atómicas: actualizan estado local + broadcastean ──────────────

  const applyRegistroChange = useCallback((type: ChangeType, registro: Registro) => {
    setRegistros(prev => {
      switch (type) {
        case 'INSERT': {
          const idx = prev.findIndex(r => r.id === registro.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = registro; return next; }
          return [registro, ...prev];
        }
        case 'UPDATE':
          return prev.map(r => r.id === registro.id ? registro : r);
        case 'DELETE':
          return prev.filter(r => r.id !== registro.id);
      }
    });
    pushRegistroChange(type, registro);
  }, [pushRegistroChange]);

  const applyObjetivoChange = useCallback((type: ChangeType, objetivo: Objetivo) => {
    setObjetivos(prev => {
      if (type === 'DELETE') {
        return prev.filter(o => !(o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio));
      }
      const exists = prev.some(o => o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio);
      if (exists) return prev.map(o => o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio ? objetivo : o);
      return [...prev, objetivo];
    });
    pushObjetivosChange(type, objetivo);
  }, [pushObjetivosChange]);

  const applyDiasConfigChange = useCallback((type: ChangeType, config: DiasConfig) => {
    setDiasConfig(prev => {
      if (type === 'DELETE') return prev.filter(d => d.analista !== config.analista);
      return prev.some(d => d.analista === config.analista)
        ? prev.map(d => d.analista === config.analista ? config : d)
        : [...prev, config];
    });
    pushDiasConfigChange(type, config);
  }, [pushDiasConfigChange]);

  const applyAlertasConfigChange = useCallback((type: ChangeType, config: AlertaConfig) => {
    setAlertasConfig(prev => {
      if (type === 'DELETE') return prev.filter(a => !(a.nombre === config.nombre && a.estado === config.estado));
      const exists = prev.some(a => a.nombre === config.nombre && a.estado === config.estado);
      if (exists) return prev.map(a => a.nombre === config.nombre && a.estado === config.estado ? config : a);
      return [...prev, config];
    });
    pushAlertasConfigChange(type, config);
  }, [pushAlertasConfigChange]);

  const applyHistoricoChange = useCallback((type: ChangeType, historico: HistoricoVenta) => {
    setHistoricoVentas(prev => {
      if (type === 'DELETE') {
        return prev.filter(h => !(h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes));
      }
      const exists = prev.some(h => h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes);
      if (exists) return prev.map(h => h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes ? historico : h);
      return [...prev, historico];
    });
    pushHistoricoChange(type, historico);
  }, [pushHistoricoChange]);

  // Verificar recordatorios vencidos al cargar y cada 60 segundos
  useEffect(() => {
    checkDueReminders();
    const interval = setInterval(checkDueReminders, 60_000);
    return () => clearInterval(interval);
  }, [checkDueReminders]);

  const value = useMemo<DataCtx>(() => ({
    registros, objetivos, diasConfig, historicoVentas, alertasConfig,
    loading, pendingReminders, reminderAlert,
    registrosWindowMonths, setRegistrosWindowMonths,
    applyRegistroChange, applyObjetivoChange, applyDiasConfigChange,
    applyAlertasConfigChange, applyHistoricoChange,
    mutateRegistros, mutateObjetivos, mutateDiasConfig,
    mutateAlertasConfig, mutateHistoricoVentas, adjustPendingReminders,
    clearReminderAlert, markReminderCompleted, refresh, pushRegistroChange,
    pushObjetivosChange, pushDiasConfigChange, pushAlertasConfigChange, pushHistoricoChange,
    pushRecordatorioChange, pushBulkRefresh,
  }), [
    registros, objetivos, diasConfig, historicoVentas, alertasConfig,
    loading, pendingReminders, reminderAlert,
    registrosWindowMonths,
    applyRegistroChange, applyObjetivoChange, applyDiasConfigChange,
    applyAlertasConfigChange, applyHistoricoChange,
    mutateRegistros, mutateObjetivos, mutateDiasConfig,
    mutateAlertasConfig, mutateHistoricoVentas, adjustPendingReminders,
    clearReminderAlert, markReminderCompleted, refresh, pushRegistroChange,
    pushObjetivosChange, pushDiasConfigChange, pushAlertasConfigChange, pushHistoricoChange,
    pushRecordatorioChange, pushBulkRefresh,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
