'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import {
  AlertaConfig, DiasConfig, PermisoRol, Analista, Feriado,
  alertaConfigSchema, diasConfigSchema, permisoRolSchema, analistaSchema, parseRows,
  getPermisoActivo,
} from '@/types';
import { validateBroadcast } from '@/lib/broadcast-utils';
import {
  calcularDiasTranscurridos,
  calcularDiasHabilesMes,
  obtenerFeriadosDB,
  guardarFeriadosDB,
} from '@/lib/dias-habiles';

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface SettingsCtx {
  alertasConfig: AlertaConfig[];
  diasConfig: DiasConfig[];
  permisosConfig: PermisoRol[];
  analistas: Analista[];
  feriados: Feriado[];
  diasTranscurridosAuto: number;
  diasHabilesMesAuto: number;
  mutateAlertasConfig: (mapper: (prev: AlertaConfig[]) => AlertaConfig[]) => void;
  pushAlertasConfigChange: (type: ChangeType, config: AlertaConfig) => void;
  applyDiasConfigChange: (type: ChangeType, config: DiasConfig) => void;
  applyPermisoConfigChange: (type: ChangeType, config: PermisoRol) => void;
  applyAnalistaChange: (type: ChangeType, config: Analista) => void;
  saveFeriados: (feriados: Feriado[]) => Promise<boolean>;
  syncDiasTranscurridos: (forceAll?: boolean) => Promise<void>;
  hasPermiso: (permiso: string, analista?: string | null, defaultValue?: boolean) => boolean;
}

const SettingsContext = createContext<SettingsCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const alertaConfigChangeSchema = z.object({ type: changeType, config: alertaConfigSchema });
const diasConfigChangeSchema = z.object({ type: changeType, config: diasConfigSchema });
const permisoConfigChangeSchema = z.object({ type: changeType, config: permisoRolSchema });
const analistaChangeSchema = z.object({ type: changeType, config: analistaSchema });
const feriadosChangeSchema = z.object({ feriados: z.array(z.object({ id: z.string().optional(), fecha: z.string(), motivo: z.string() })) });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [alertasConfig, setAlertasConfig] = useState<AlertaConfig[]>([]);
  const [diasConfig, setDiasConfig] = useState<DiasConfig[]>([]);
  const [permisosConfig, setPermisosConfig] = useState<PermisoRol[]>([]);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);

  const fetchSettings = useCallback(async () => {
    const [alertasR, diasR, permisosR, analistasR, feriadosData] = await Promise.all([
      supabase.from('alertas_config').select('id,nombre,estado,dias,mensaje,color'),
      supabase.from('dias_habiles_config').select('analista,dias_habiles,dias_transcurridos,manual'),
      supabase.from('permisos_roles').select('id,rol,permiso,activo'),
      supabase.from('analistas').select('id,nombre,color,oculto,tiene_incentivo,orden').order('orden'),
      obtenerFeriadosDB(supabase),
    ]);

    setFeriados(feriadosData);
    const autoTrans = calcularDiasTranscurridos(new Date(), feriadosData);

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
    
    if (diasR.error) {
      reportError('refresh:dias_habiles_config', diasR.error);
    } else {
      const parsed = parseRows<DiasConfig>(diasConfigSchema, diasR.data, () => {});
      // Si la entrada no es manual, reflejar automáticamente los días transcurridos actuales
      const merged = parsed.map(d => {
        if (!d.manual) {
          return { ...d, dias_transcurridos: autoTrans };
        }
        return d;
      });
      setDiasConfig(merged);
    }

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
    feriados_change: (payload) => {
      const data = validateBroadcast('feriados_change', feriadosChangeSchema, payload);
      if (!data) return;
      setFeriados(data.feriados as Feriado[]);
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

  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const diasTranscurridosAuto = useMemo(() => {
    return calcularDiasTranscurridos(ahora, feriados);
  }, [ahora, feriados]);

  // Si cambia diasTranscurridosAuto (ej. cruce de las 19:30 o 12:00 del sábado), reflejar en perfiles automáticos
  useEffect(() => {
    setDiasConfig(prev => {
      let changed = false;
      const next = prev.map(d => {
        if (!d.manual && d.dias_transcurridos !== diasTranscurridosAuto) {
          changed = true;
          return { ...d, dias_transcurridos: diasTranscurridosAuto };
        }
        return d;
      });
      return changed ? next : prev;
    });
  }, [diasTranscurridosAuto]);

  const diasHabilesMesAuto = useMemo(() => {
    return calcularDiasHabilesMes(ahora.getFullYear(), ahora.getMonth() + 1, feriados);
  }, [ahora, feriados]);

  const saveFeriados = useCallback(async (nuevosFeriados: Feriado[]): Promise<boolean> => {
    const ok = await guardarFeriadosDB(supabase, nuevosFeriados);
    if (ok) {
      setFeriados(nuevosFeriados);
      broadcastRef.current?.send({
        type: 'broadcast',
        event: 'feriados_change',
        payload: { feriados: nuevosFeriados },
      }).catch(() => {});
    }
    return ok;
  }, [broadcastRef]);

  const syncDiasTranscurridos = useCallback(async (forceAll = false) => {
    const auto = calcularDiasTranscurridos(new Date(), feriados);
    const updates = diasConfig
      .filter(d => forceAll || !d.manual)
      .map(d => ({
        analista: d.analista,
        dias_habiles: d.dias_habiles,
        dias_transcurridos: auto,
        manual: d.manual ?? false,
      }));

    if (updates.length > 0) {
      for (const u of updates) {
        await supabase.from('dias_habiles_config').upsert(u, { onConflict: 'analista' });
        applyDiasConfigChange('UPDATE', u);
      }
    }
  }, [feriados, diasConfig, applyDiasConfigChange]);

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

  const hasPermiso = useCallback((permiso: string, analista?: string | null, defaultValue: boolean = true) => {
    return getPermisoActivo(permisosConfig, permiso, analista, defaultValue);
  }, [permisosConfig]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const value = useMemo<SettingsCtx>(() => ({
    alertasConfig, diasConfig, permisosConfig, analistas,
    feriados, diasTranscurridosAuto, diasHabilesMesAuto,
    mutateAlertasConfig, pushAlertasConfigChange, applyDiasConfigChange, applyPermisoConfigChange, applyAnalistaChange,
    saveFeriados, syncDiasTranscurridos,
    hasPermiso,
  }), [alertasConfig, diasConfig, permisosConfig, analistas, feriados, diasTranscurridosAuto, diasHabilesMesAuto, mutateAlertasConfig, pushAlertasConfigChange, applyDiasConfigChange, applyPermisoConfigChange, applyAnalistaChange, saveFeriados, syncDiasTranscurridos, hasPermiso]);

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
