'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import {
  AlertaConfig, DiasConfig, PermisoRol, Analista,
  alertaConfigSchema, diasConfigSchema, permisoRolSchema, analistaSchema, parseRows,
} from '@/types';
import { validateBroadcast } from '@/lib/broadcast-utils';

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface SettingsCtx {
  alertasConfig: AlertaConfig[];
  diasConfig: DiasConfig[];
  permisosConfig: PermisoRol[];
  analistas: Analista[];
  mutateAlertasConfig: (mapper: (prev: AlertaConfig[]) => AlertaConfig[]) => void;
  pushAlertasConfigChange: (type: ChangeType, config: AlertaConfig) => void;
  applyDiasConfigChange: (type: ChangeType, config: DiasConfig) => void;
  applyPermisoConfigChange: (type: ChangeType, config: PermisoRol) => void;
  applyAnalistaChange: (type: ChangeType, config: Analista) => void;
}

const SettingsContext = createContext<SettingsCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const alertaConfigChangeSchema = z.object({ type: changeType, config: alertaConfigSchema });
const diasConfigChangeSchema = z.object({ type: changeType, config: diasConfigSchema });
const permisoConfigChangeSchema = z.object({ type: changeType, config: permisoRolSchema });
const analistaChangeSchema = z.object({ type: changeType, config: analistaSchema });



export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [alertasConfig, setAlertasConfig] = useState<AlertaConfig[]>([]);
  const [diasConfig, setDiasConfig] = useState<DiasConfig[]>([]);
  const [permisosConfig, setPermisosConfig] = useState<PermisoRol[]>([]);
  const [analistas, setAnalistas] = useState<Analista[]>([]);

  const fetchSettings = useCallback(async () => {
    const [alertasR, diasR, permisosR, analistasR] = await Promise.all([
      supabase.from('alertas_config').select('id,nombre,estado,dias,mensaje,color'),
      supabase.from('dias_habiles_config').select('analista,dias_habiles,dias_transcurridos'),
      supabase.from('permisos_roles').select('id,rol,permiso,activo'),
      supabase.from('analistas').select('id,nombre,color,oculto,tiene_incentivo,orden').order('orden'),
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
    if (permisosR.error && permisosR.error.code !== '42P01') reportError('refresh:permisos_roles', permisosR.error);
    else if (!permisosR.error) validateAndSet<PermisoRol>('permisos_roles', permisoRolSchema, permisosR.data, setPermisosConfig);
    if (analistasR.error && analistasR.error.code !== '42P01') reportError('refresh:analistas', analistasR.error);
    else if (!analistasR.error) validateAndSet<Analista>('analistas', analistaSchema, analistasR.data, setAnalistas);
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
    permiso_config_change: (payload) => {
      const data = validateBroadcast('permiso_config_change', permisoConfigChangeSchema, payload);
      if (!data) return;
      const { type, config } = data;
      setPermisosConfig(prev => {
        if (type === 'DELETE') return prev.filter(p => !(p.rol === config.rol && p.permiso === config.permiso));
        return prev.some(p => p.rol === config.rol && p.permiso === config.permiso)
          ? prev.map(p => (p.rol === config.rol && p.permiso === config.permiso) ? config : p)
          : [...prev, config];
      });
    },
    analistas_change: (payload) => {
      const data = validateBroadcast('analistas_change', analistaChangeSchema, payload);
      if (!data) return;
      const { type, config } = data;
      setAnalistas(prev => {
        if (type === 'DELETE') return prev.filter(a => a.nombre !== config.nombre);
        return prev.some(a => a.nombre === config.nombre)
          ? prev.map(a => a.nombre === config.nombre ? config : a)
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

  const applyAnalistaChange = useCallback((type: ChangeType, config: Analista) => {
    setAnalistas(prev => {
      if (type === 'DELETE') return prev.filter(a => a.nombre !== config.nombre);
      return prev.some(a => a.nombre === config.nombre)
        ? prev.map(a => a.nombre === config.nombre ? config : a)
        : [...prev, config];
    });
    broadcastRef.current?.send({ type: 'broadcast', event: 'analistas_change', payload: { type, config } }).catch(() => {});
  }, [broadcastRef]);

  const applyPermisoConfigChange = useCallback((type: ChangeType, config: PermisoRol) => {
    setPermisosConfig(prev => {
      if (type === 'DELETE') return prev.filter(p => !(p.rol === config.rol && p.permiso === config.permiso));
      return prev.some(p => p.rol === config.rol && p.permiso === config.permiso)
        ? prev.map(p => (p.rol === config.rol && p.permiso === config.permiso) ? config : p)
        : [...prev, config];
    });
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'permiso_config_change',
      payload: { type, config },
    }).catch(() => { });
  }, [broadcastRef]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const value = useMemo<SettingsCtx>(() => ({
    alertasConfig, diasConfig, permisosConfig, analistas,
    mutateAlertasConfig, pushAlertasConfigChange, applyDiasConfigChange, applyPermisoConfigChange, applyAnalistaChange,
  }), [alertasConfig, diasConfig, permisosConfig, analistas, mutateAlertasConfig, pushAlertasConfigChange, applyDiasConfigChange, applyPermisoConfigChange, applyAnalistaChange]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function useAnalistas() {
  const { analistas: all, applyAnalistaChange } = useSettings();
  const visibles = useMemo(() => all.filter(a => !a.oculto), [all]);
  const nombres = useMemo(() => visibles.map(a => a.nombre), [visibles]);
  const colorDe = useCallback(
    (nombre: string) => all.find(a => a.nombre === nombre)?.color ?? '#10b981',
    [all],
  );
  const cobraIncentivo = useCallback(
    (nombre: string) => all.find(a => a.nombre === nombre)?.tiene_incentivo ?? false,
    [all],
  );
  return { analistas: visibles, analistasAll: all, nombres, colorDe, cobraIncentivo, applyAnalistaChange };
}
