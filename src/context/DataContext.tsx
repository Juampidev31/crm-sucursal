'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Registro, HistoricoVenta, Recordatorio } from '@/types';

export interface Objetivo {
  id?: string;
  analista: string;
  mes: number;
  anio: number;
  meta_ventas: number;
  meta_operaciones: number;
}

export interface DiasConfig {
  analista: string;
  dias_habiles: number;
  dias_transcurridos: number;
}

export interface AlertaConfig {
  nombre: string;
  estado: string;
  dias: number;
  mensaje: string;
  color: string;
}

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
  setRegistros: React.Dispatch<React.SetStateAction<Registro[]>>;
  setObjetivos: React.Dispatch<React.SetStateAction<Objetivo[]>>;
  setDiasConfig: React.Dispatch<React.SetStateAction<DiasConfig[]>>;
  setAlertasConfig: React.Dispatch<React.SetStateAction<AlertaConfig[]>>;
  setHistoricoVentas: React.Dispatch<React.SetStateAction<HistoricoVenta[]>>;
  setPendingReminders: React.Dispatch<React.SetStateAction<number>>;
  clearReminderAlert: () => void;
  markReminderCompleted: (id: string) => Promise<void>;
  refresh: (silent?: boolean) => void;
  pushRegistroChange: (type: 'INSERT' | 'UPDATE' | 'DELETE', registro: Registro) => void;
  pushObjetivosChange: (type: 'INSERT' | 'UPDATE' | 'DELETE', objetivo: Objetivo) => void;
  pushDiasConfigChange: (type: 'INSERT' | 'UPDATE' | 'DELETE', config: DiasConfig) => void;
  pushAlertasConfigChange: (type: 'INSERT' | 'UPDATE' | 'DELETE', config: AlertaConfig) => void;
  pushHistoricoChange: (type: 'INSERT' | 'UPDATE' | 'DELETE', historico: HistoricoVenta) => void;
  pushRecordatorioChange: (type: 'INSERT' | 'UPDATE' | 'DELETE', recordatorio: Recordatorio) => void;
}

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
  const initialized = useRef(false);
  const shownIds = useRef(new Set<string>());
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastChannelObjetivosRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastChannelDiasRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastChannelAlertasRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastChannelHistoricoRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastChannelRecordatoriosRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const clearReminderAlert = useCallback(() => {
    setReminderAlert(null);
  }, []);

  const checkDueReminders = useCallback(async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('recordatorios')
      .select('id, nombre, nota, fecha_hora, analista, estado')
      .eq('mostrado', false)
      .lte('fecha_hora', now)
      .order('fecha_hora', { ascending: true });

    if (!data || data.length === 0) return;
    const next = data.find(r => !shownIds.current.has(r.id));
    if (next) {
      shownIds.current.add(next.id);
      setReminderAlert({
        id: next.id, nombre: next.nombre, nota: next.nota,
        fecha_hora: next.fecha_hora, analista: next.analista, estado: next.estado,
      });
    }
  }, []);

  const markReminderCompleted = useCallback(async (id: string) => {
    setReminderAlert(null);
    setPendingReminders(n => Math.max(0, n - 1));
    await supabase.from('recordatorios').update({ mostrado: true }).eq('id', id);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [{ data: regs }, { data: objs }, { data: dias }, { count }, { data: hist }, { data: alertas }] = await Promise.all([
      supabase.from('registros').select('*').order('fecha', { ascending: false }).limit(2000),
      supabase.from('objetivos').select('*'),
      supabase.from('dias_habiles_config').select('analista, dias_habiles, dias_transcurridos'),
      supabase.from('recordatorios').select('*', { count: 'exact', head: true }).eq('mostrado', false),
      supabase.from('historico_ventas').select('*'),
      supabase.from('alertas_config').select('*'),
    ]);
    if (regs) setRegistros(regs as Registro[]);
    if (objs) setObjetivos(objs as Objetivo[]);
    if (dias) setDiasConfig(dias as DiasConfig[]);
    if (hist) setHistoricoVentas(hist as HistoricoVenta[]);
    if (alertas) setAlertasConfig(alertas as AlertaConfig[]);
    setPendingReminders(count || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      refresh();
    }
  }, [refresh]);

  // Refs estables para evitar dependencias cambiantes en el effect
  const refreshRef = useRef(refresh);
  const checkDueRef = useRef(checkDueReminders);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { checkDueRef.current = checkDueReminders; }, [checkDueReminders]);

  // Canal broadcast — actualización inmediata entre usuarios sin depender de RLS
  const pushRegistroChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', registro: Registro) => {
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'registro_change',
      payload: { type, registro },
    });
  }, []);

  const pushObjetivosChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', objetivo: Objetivo) => {
    broadcastChannelObjetivosRef.current?.send({
      type: 'broadcast',
      event: 'objetivos_change',
      payload: { type, objetivo },
    });
  }, []);

  const pushDiasConfigChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', config: DiasConfig) => {
    broadcastChannelDiasRef.current?.send({
      type: 'broadcast',
      event: 'dias_config_change',
      payload: { type, config },
    });
  }, []);

  const pushAlertasConfigChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', config: AlertaConfig) => {
    broadcastChannelAlertasRef.current?.send({
      type: 'broadcast',
      event: 'alertas_config_change',
      payload: { type, config },
    });
  }, []);

  const pushHistoricoChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', historico: HistoricoVenta) => {
    broadcastChannelHistoricoRef.current?.send({
      type: 'broadcast',
      event: 'historico_change',
      payload: { type, historico },
    });
  }, []);

  const pushRecordatorioChange = useCallback((type: 'INSERT' | 'UPDATE' | 'DELETE', recordatorio: Recordatorio) => {
    broadcastChannelRecordatoriosRef.current?.send({
      type: 'broadcast',
      event: 'recordatorio_change',
      payload: { type, recordatorio, mostrado: recordatorio.mostrado },
    });
  }, []);

  useEffect(() => {
    const bc = supabase
      .channel('registros-broadcast', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'registro_change' }, ({ payload }) => {
        const { type, registro } = payload as { type: string; registro: Registro };
        if (type === 'INSERT') setRegistros(prev => [registro, ...prev]);
        else if (type === 'UPDATE') setRegistros(prev => prev.map(r => r.id === registro.id ? registro : r));
        else if (type === 'DELETE') setRegistros(prev => prev.filter(r => r.id !== registro.id));
      })
      .subscribe();
    broadcastChannelRef.current = bc;
    return () => { supabase.removeChannel(bc); };
  }, []);

  useEffect(() => {
    const bc = supabase
      .channel('objetivos-broadcast', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'objetivos_change' }, ({ payload }) => {
        const { type, objetivo } = payload as { type: string; objetivo: Objetivo };
        if (type === 'INSERT' || type === 'UPDATE') {
          setObjetivos(prev => {
            const exists = prev.some(o => o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio);
            if (exists) return prev.map(o => o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio ? objetivo : o);
            return [...prev, objetivo];
          });
        } else if (type === 'DELETE') {
          setObjetivos(prev => prev.filter(o => !(o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio)));
        }
      })
      .subscribe();
    broadcastChannelObjetivosRef.current = bc;
    return () => { supabase.removeChannel(bc); };
  }, []);

  useEffect(() => {
    const bc = supabase
      .channel('dias-config-broadcast', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'dias_config_change' }, ({ payload }) => {
        const { type, config } = payload as { type: string; config: DiasConfig };
        if (type === 'INSERT' || type === 'UPDATE') {
          setDiasConfig(prev => prev.some(d => d.analista === config.analista)
            ? prev.map(d => d.analista === config.analista ? config : d)
            : [...prev, config]);
        } else if (type === 'DELETE') {
          setDiasConfig(prev => prev.filter(d => d.analista !== config.analista));
        }
      })
      .subscribe();
    broadcastChannelDiasRef.current = bc;
    return () => { supabase.removeChannel(bc); };
  }, []);

  useEffect(() => {
    const bc = supabase
      .channel('alertas-config-broadcast', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'alertas_config_change' }, ({ payload }) => {
        const { type, config } = payload as { type: string; config: AlertaConfig };
        if (type === 'INSERT' || type === 'UPDATE') {
          setAlertasConfig(prev => {
            const exists = prev.some(a => a.nombre === config.nombre && a.estado === config.estado);
            if (exists) return prev.map(a => a.nombre === config.nombre && a.estado === config.estado ? config : a);
            return [...prev, config];
          });
        } else if (type === 'DELETE') {
          setAlertasConfig(prev => prev.filter(a => !(a.nombre === config.nombre && a.estado === config.estado)));
        }
      })
      .subscribe();
    broadcastChannelAlertasRef.current = bc;
    return () => { supabase.removeChannel(bc); };
  }, []);

  useEffect(() => {
    const bc = supabase
      .channel('historico-broadcast', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'historico_change' }, ({ payload }) => {
        const { type, historico } = payload as { type: string; historico: HistoricoVenta };
        if (type === 'INSERT' || type === 'UPDATE') {
          setHistoricoVentas(prev => {
            const exists = prev.some(h => h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes);
            if (exists) return prev.map(h => h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes ? historico : h);
            return [...prev, historico];
          });
        } else if (type === 'DELETE') {
          setHistoricoVentas(prev => prev.filter(h => !(h.analista === historico.analista && h.anio === historico.anio && h.mes === historico.mes)));
        }
      })
      .subscribe();
    broadcastChannelHistoricoRef.current = bc;
    return () => { supabase.removeChannel(bc); };
  }, []);

  useEffect(() => {
    const bc = supabase
      .channel('recordatorios-broadcast', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'recordatorio_change' }, ({ payload }) => {
        const { type, mostrado } = payload as { type: string; mostrado?: boolean };
        if (type === 'INSERT' && !mostrado) {
          setPendingReminders(n => n + 1);
        } else if (type === 'UPDATE' && mostrado) {
          setPendingReminders(n => Math.max(0, n - 1));
        } else if (type === 'DELETE') {
          setPendingReminders(n => Math.max(0, n - 1));
        }
        checkDueRef.current();
      })
      .subscribe();
    broadcastChannelRecordatoriosRef.current = bc;
    return () => { supabase.removeChannel(bc); };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('recordatorios-realtime-context')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'recordatorios' }, (payload) => {
        const nuevo = payload.new as { mostrado?: boolean };
        if (nuevo.mostrado) setPendingReminders(n => Math.max(0, n - 1));
        checkDueRef.current();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'recordatorios' }, () => {
        setPendingReminders(n => Math.max(0, n - 1));
        checkDueRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Suscripciones en tiempo real para el resto de tablas
  useEffect(() => {
    const channel = supabase
      .channel('realtime-rest')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objetivos' }, (payload) => {
        refreshRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dias_habiles_config' }, (payload) => {
        refreshRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_ventas' }, (payload) => {
        refreshRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas_config' }, (payload) => {
        refreshRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordatorios' }, () => {
        supabase
          .from('recordatorios')
          .select('*', { count: 'exact', head: true })
          .eq('mostrado', false)
          .then(({ count }) => setPendingReminders(count || 0));
        checkDueRef.current();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Connected successfully
        } else if (status === 'CHANNEL_ERROR') {
          // Silent reconnect - will retry automatically
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Verificar recordatorios vencidos al cargar y cada 60 segundos
  useEffect(() => {
    checkDueReminders();
    const interval = setInterval(checkDueReminders, 60_000);
    return () => clearInterval(interval);
  }, [checkDueReminders]);

  return (
    <DataContext.Provider value={{
      registros, objetivos, diasConfig, historicoVentas, alertasConfig,
      loading, pendingReminders, reminderAlert,
      setRegistros, setObjetivos, setDiasConfig, setAlertasConfig, setHistoricoVentas, setPendingReminders,
      clearReminderAlert, markReminderCompleted, refresh, pushRegistroChange,
      pushObjetivosChange, pushDiasConfigChange, pushAlertasConfigChange, pushHistoricoChange,
      pushRecordatorioChange
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
