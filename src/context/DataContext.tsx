'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Registro } from '@/types';

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
  loading: boolean;
  pendingReminders: number;
  reminderAlert: ReminderAlertData | null;
  setRegistros: React.Dispatch<React.SetStateAction<Registro[]>>;
  setPendingReminders: React.Dispatch<React.SetStateAction<number>>;
  clearReminderAlert: () => void;
  markReminderCompleted: (id: string) => Promise<void>;
  refresh: (silent?: boolean) => void;
}

const DataContext = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [diasConfig, setDiasConfig] = useState<DiasConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingReminders, setPendingReminders] = useState(0);
  const [reminderAlert, setReminderAlert] = useState<ReminderAlertData | null>(null);
  const initialized = useRef(false);
  const shownIds = useRef(new Set<string>());

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
    const [{ data: regs }, { data: objs }, { data: dias }, { count }] = await Promise.all([
      supabase.from('registros').select('*').order('fecha', { ascending: false }).limit(2000),
      supabase.from('objetivos').select('*'),
      supabase.from('dias_habiles_config').select('analista, dias_habiles, dias_transcurridos'),
      supabase.from('recordatorios').select('*', { count: 'exact', head: true }).eq('mostrado', false),
    ]);
    if (regs) setRegistros(regs as Registro[]);
    if (objs) setObjetivos(objs as Objetivo[]);
    if (dias) setDiasConfig(dias as DiasConfig[]);
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

  // Suscripciones en tiempo real — array de deps vacío, usa refs
  useEffect(() => {
    const channel = supabase
      .channel('realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros' }, () => {
        refreshRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objetivos' }, () => {
        refreshRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dias_habiles_config' }, () => {
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
        console.log('[Realtime]', status);
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
    <DataContext.Provider value={{ registros, objetivos, diasConfig, loading, pendingReminders, reminderAlert, setRegistros, setPendingReminders, clearReminderAlert, markReminderCompleted, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
