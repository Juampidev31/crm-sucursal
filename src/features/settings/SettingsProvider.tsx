'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import {
  AlertaConfig, DiasConfig,
  alertaConfigSchema, diasConfigSchema, parseRows,
} from '@/types';

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface SettingsCtx {
  alertasConfig: AlertaConfig[];
  diasConfig: DiasConfig[];
  mutateAlertasConfig: (mapper: (prev: AlertaConfig[]) => AlertaConfig[]) => void;
  pushAlertasConfigChange: (type: ChangeType, config: AlertaConfig) => void;
  applyDiasConfigChange: (type: ChangeType, config: DiasConfig) => void;
}

const SettingsContext = createContext<SettingsCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const alertaConfigChangeSchema = z.object({ type: changeType, config: alertaConfigSchema });
const diasConfigChangeSchema = z.object({ type: changeType, config: diasConfigSchema });

function validateBroadcast<T>(event: string, schema: z.ZodType<T>, payload: unknown): T | null {
  const r = schema.safeParse(payload);
  if (!r.success) {
    console.warn(`[broadcast] ${event} payload inválido:`, r.error.issues);
    return null;
  }
  return r.data;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [alertasConfig, setAlertasConfig] = useState<AlertaConfig[]>([]);
  const [diasConfig, setDiasConfig] = useState<DiasConfig[]>([]);

  const fetchSettings = useCallback(async () => {
    const [alertasR, diasR] = await Promise.all([
      supabase.from('alertas_config').select('id,nombre,estado,dias,mensaje,color'),
      supabase.from('dias_habiles_config').select('analista,dias_habiles,dias_transcurridos'),
    ]);

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
        console.warn(`[SettingsProvider] ${scope} inválido [${i}] id=${rowId}:`, err.issues);
      });
      if (dropped > 0) reportError(`refresh:${scope}`, { message: `${dropped} fila(s) descartada(s) en ${scope} — revisá consola` });
      setter(parsed);
    };

    if (alertasR.error) reportError('refresh:alertas_config', alertasR.error);
    else validateAndSet<AlertaConfig>('alertas_config', alertaConfigSchema, alertasR.data, setAlertasConfig);
    if (diasR.error) reportError('refresh:dias_habiles_config', diasR.error);
    else validateAndSet<DiasConfig>('dias_habiles_config', diasConfigSchema, diasR.data, setDiasConfig);
  }, [reportError]);

  const fetchRef = useRef(fetchSettings);
  useEffect(() => { fetchRef.current = fetchSettings; }, [fetchSettings]);

  const broadcastRef = useRealtimeBroadcast('crm-broadcast', {
    alertas_config_change: (payload) => {
      const data = validateBroadcast('alertas_config_change', alertaConfigChangeSchema, payload);
      if (!data) return;
      const { type, config } = data;
      setAlertasConfig(prev => {
        if (type === 'DELETE') return prev.filter(a => !(a.nombre === config.nombre && a.estado === config.estado));
        const exists = prev.some(a => a.nombre === config.nombre && a.estado === config.estado);
        if (exists) return prev.map(a => a.nombre === config.nombre && a.estado === config.estado ? config : a);
        return [...prev, config];
      });
    },
    dias_config_change: (payload) => {
      const data = validateBroadcast('dias_config_change', diasConfigChangeSchema, payload);
      if (!data) return;
      const { type, config } = data;
      setDiasConfig(prev => {
        if (type === 'DELETE') return prev.filter(d => d.analista !== config.analista);
        return prev.some(d => d.analista === config.analista)
          ? prev.map(d => d.analista === config.analista ? config : d)
          : [...prev, config];
      });
    },
    bulk_refresh: () => { fetchRef.current(); },
  });

  const mutateAlertasConfig = useCallback((mapper: (prev: AlertaConfig[]) => AlertaConfig[]) => {
    setAlertasConfig(mapper);
  }, []);

  const pushAlertasConfigChange = useCallback((type: ChangeType, config: AlertaConfig) => {
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'alertas_config_change',
      payload: { type, config },
    }).catch(() => { });
  }, [broadcastRef]);

  const applyDiasConfigChange = useCallback((type: ChangeType, config: DiasConfig) => {
    setDiasConfig(prev => {
      if (type === 'DELETE') return prev.filter(d => d.analista !== config.analista);
      return prev.some(d => d.analista === config.analista)
        ? prev.map(d => d.analista === config.analista ? config : d)
        : [...prev, config];
    });
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'dias_config_change',
      payload: { type, config },
    }).catch(() => { });
  }, [broadcastRef]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const value = useMemo<SettingsCtx>(() => ({
    alertasConfig, diasConfig,
    mutateAlertasConfig, pushAlertasConfigChange, applyDiasConfigChange,
  }), [alertasConfig, diasConfig, mutateAlertasConfig, pushAlertasConfigChange, applyDiasConfigChange]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
