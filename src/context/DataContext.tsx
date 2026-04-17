'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import {
  Registro, AlertaConfig, DiasConfig,
  parseRegistros, parseRows,
  registroSchema, diasConfigSchema, alertaConfigSchema,
} from '@/types';

// Schemas de payloads broadcast: wrap cada entidad con el tipo de cambio.
// Se validan en los handlers para no consumir mensajes malformados
// (p.ej. de clientes con versión desfasada) y solo loguean en consola.
const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const registroChangeSchema = z.object({ type: changeType, registro: registroSchema });
const diasConfigChangeSchema = z.object({ type: changeType, config: diasConfigSchema });
const alertaConfigChangeSchema = z.object({ type: changeType, config: alertaConfigSchema });

function validateBroadcast<T>(event: string, schema: z.ZodType<T>, payload: unknown): T | null {
  const r = schema.safeParse(payload);
  if (!r.success) {
    console.warn(`[broadcast] ${event} payload inválido:`, r.error.issues);
    return null;
  }
  return r.data;
}

export type { DiasConfig, AlertaConfig };

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface DataCtx {
  registros: Registro[];
  diasConfig: DiasConfig[];
  alertasConfig: AlertaConfig[];
  loading: boolean;
  registrosWindowMonths: number;
  setRegistrosWindowMonths: (months: number) => void;
  // Acciones atómicas (local + broadcast) para mutaciones de un item.
  applyRegistroChange: (type: ChangeType, registro: Registro) => void;
  applyDiasConfigChange: (type: ChangeType, config: DiasConfig) => void;
  applyAlertasConfigChange: (type: ChangeType, config: AlertaConfig) => void;
  // Mutadores locales (sin broadcast) para casos bulk/full-replace.
  mutateRegistros: (mapper: (prev: Registro[]) => Registro[]) => void;
  mutateDiasConfig: (mapper: (prev: DiasConfig[]) => DiasConfig[]) => void;
  mutateAlertasConfig: (mapper: (prev: AlertaConfig[]) => AlertaConfig[]) => void;
  refresh: (silent?: boolean) => void;
  pushRegistroChange: (type: ChangeType, registro: Registro) => void;
  pushDiasConfigChange: (type: ChangeType, config: DiasConfig) => void;
  pushAlertasConfigChange: (type: ChangeType, config: AlertaConfig) => void;
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
  const [diasConfig, setDiasConfig] = useState<DiasConfig[]>([]);
  const [alertasConfig, setAlertasConfig] = useState<AlertaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrosWindowMonths, setRegistrosWindowMonths] = useState<number>(DEFAULT_REGISTROS_WINDOW_MONTHS);
  const initialized = useRef(false);
  const { reportError } = useDataError();

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
    const [regsR, diasR, alertasR] = await Promise.all([
      registrosQuery.order('fecha', { ascending: false }).limit(REGISTROS_SAFETY_LIMIT),
      supabase.from('dias_habiles_config').select('analista,dias_habiles,dias_transcurridos'),
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
    if (diasR.error) reportError('refresh:dias_habiles_config', diasR.error);
    else validateAndSet<DiasConfig>('dias_habiles_config', diasConfigSchema, diasR.data, setDiasConfig);
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

  // Ref estable para evitar dependencias cambiantes en el effect
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

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
    bulk_refresh: () => { refreshRef.current(true); },
  });

  // ── Push callbacks (envían por broadcast) ──────────────────────────────────

  const pushBroadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    broadcastRef.current?.send({ type: 'broadcast', event, payload }).catch(() => { });
  }, [broadcastRef]);

  const pushRegistroChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', registro: Registro) => {
    pushBroadcast('registro_change', { type, registro });
  }, [pushBroadcast]);

  const pushDiasConfigChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', config: DiasConfig) => {
    pushBroadcast('dias_config_change', { type, config });
  }, [pushBroadcast]);

  const pushAlertasConfigChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', config: AlertaConfig) => {
    pushBroadcast('alertas_config_change', { type, config });
  }, [pushBroadcast]);

  // Bulk refresh trigger - hace que todos los clientes recarguen datos
  const pushBulkRefresh = useCallback(() => {
    broadcastRef.current?.send({ type: 'broadcast', event: 'bulk_refresh', payload: {} });
  }, [broadcastRef]);

  // ── Mutadores locales (sin broadcast) ──────────────────────────────────────

  const mutateRegistros = useCallback((mapper: (prev: Registro[]) => Registro[]) => {
    setRegistros(mapper);
  }, []);

  const mutateDiasConfig = useCallback((mapper: (prev: DiasConfig[]) => DiasConfig[]) => {
    setDiasConfig(mapper);
  }, []);

  const mutateAlertasConfig = useCallback((mapper: (prev: AlertaConfig[]) => AlertaConfig[]) => {
    setAlertasConfig(mapper);
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

  const value = useMemo<DataCtx>(() => ({
    registros, diasConfig, alertasConfig,
    loading,
    registrosWindowMonths, setRegistrosWindowMonths,
    applyRegistroChange, applyDiasConfigChange,
    applyAlertasConfigChange,
    mutateRegistros, mutateDiasConfig,
    mutateAlertasConfig,
    refresh, pushRegistroChange,
    pushDiasConfigChange, pushAlertasConfigChange,
    pushBulkRefresh,
  }), [
    registros, diasConfig, alertasConfig,
    loading,
    registrosWindowMonths,
    applyRegistroChange, applyDiasConfigChange,
    applyAlertasConfigChange,
    mutateRegistros, mutateDiasConfig,
    mutateAlertasConfig,
    refresh, pushRegistroChange,
    pushDiasConfigChange, pushAlertasConfigChange,
    pushBulkRefresh,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
