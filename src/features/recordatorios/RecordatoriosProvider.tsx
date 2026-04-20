'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { Recordatorio } from '@/types';

export interface ReminderAlertData {
  id: string;
  nombre: string;
  nota?: string;
  fecha_hora: string;
  analista?: string;
  estado?: string;
}

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface RecordatoriosCtx {
  pendingReminders: number;
  reminderAlert: ReminderAlertData | null;
  clearReminderAlert: () => void;
  markReminderCompleted: (id: string) => Promise<void>;
  adjustPendingReminders: (delta: number) => void;
  pushRecordatorioChange: (type: ChangeType, recordatorio: Recordatorio) => void;
}

const RecordatoriosContext = createContext<RecordatoriosCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const recordatorioChangeSchema = z.object({ type: changeType, mostrado: z.boolean().optional() });

function validateBroadcast<T>(event: string, schema: z.ZodType<T>, payload: unknown): T | null {
  const r = schema.safeParse(payload);
  if (!r.success) {
    console.warn(`[broadcast] ${event} payload inválido:`, r.error.issues);
    return null;
  }
  return r.data;
}

export function RecordatoriosProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [pendingReminders, setPendingReminders] = useState(0);
  const [reminderAlert, setReminderAlert] = useState<ReminderAlertData | null>(null);
  const shownIds = useRef(new Set<string>());

  const fetchCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('recordatorios')
        .select('id', { count: 'exact', head: true })
        .eq('mostrado', false);
      if (error) {
        if (error.message?.includes('fetch')) {
          console.warn('[RecordatoriosProvider] Error de red en fetchCount:', error.message);
          return;
        }
        reportError('recordatorios:count', error);
        return;
      }
      setPendingReminders(count || 0);
    } catch (err) {
      console.warn('[RecordatoriosProvider] Error inesperado en fetchCount:', err);
    }
  }, [reportError]);

  const checkDueReminders = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('recordatorios')
        .select('id, nombre, nota, fecha_hora, analista, estado')
        .eq('mostrado', false)
        .lte('fecha_hora', now)
        .order('fecha_hora', { ascending: true });

      if (error) {
        if (error.message?.includes('fetch')) {
          console.warn('[RecordatoriosProvider] Error de red en checkDueReminders:', error.message);
          return;
        }
        reportError('checkDueReminders', error);
        return;
      }
      if (!data || data.length === 0) return;
      const next = data.find(r => !shownIds.current.has(r.id));
      if (next) {
        shownIds.current.add(next.id);
        setReminderAlert({
          id: next.id, nombre: next.nombre, nota: next.nota,
          fecha_hora: next.fecha_hora, analista: next.analista, estado: next.estado,
        });
      }
    } catch (err) {
      console.warn('[RecordatoriosProvider] Error inesperado en checkDueReminders:', err);
    }
  }, [reportError]);

  const clearReminderAlert = useCallback(() => setReminderAlert(null), []);

  const markReminderCompleted = useCallback(async (id: string) => {
    setReminderAlert(null);
    setPendingReminders(n => Math.max(0, n - 1));
    const { error } = await supabase.from('recordatorios').update({ mostrado: true }).eq('id', id);
    if (error) {
      setPendingReminders(n => n + 1); // revertir optimista
      reportError('markReminderCompleted', error);
    }
  }, [reportError]);

  const adjustPendingReminders = useCallback((delta: number) => {
    setPendingReminders(n => Math.max(0, n + delta));
  }, []);

  // Ref estable para usar en el broadcast handler
  const checkDueRef = useRef(checkDueReminders);
  useEffect(() => { checkDueRef.current = checkDueReminders; }, [checkDueReminders]);

  const broadcastRef = useRealtimeBroadcast('crm-broadcast', {
    recordatorio_change: (payload) => {
      const data = validateBroadcast('recordatorio_change', recordatorioChangeSchema, payload);
      if (!data) return;
      const { type, mostrado } = data;
      if (type === 'INSERT' && !mostrado) setPendingReminders(n => n + 1);
      else if (type === 'UPDATE' && mostrado) setPendingReminders(n => Math.max(0, n - 1));
      else if (type === 'DELETE') setPendingReminders(n => Math.max(0, n - 1));
      checkDueRef.current();
    },
    bulk_refresh: () => { fetchCount(); },
  });

  const pushRecordatorioChange = useCallback((type: ChangeType, recordatorio: Recordatorio) => {
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'recordatorio_change',
      payload: { type, recordatorio, mostrado: recordatorio.mostrado },
    }).catch(() => { });
  }, [broadcastRef]);

  // Fetch inicial + polling de vencidos cada 60s
  useEffect(() => {
    fetchCount();
    checkDueReminders();
    const interval = setInterval(() => checkDueReminders(), 60_000);
    return () => clearInterval(interval);
  }, [fetchCount, checkDueReminders]);

  const value = useMemo<RecordatoriosCtx>(() => ({
    pendingReminders, reminderAlert,
    clearReminderAlert, markReminderCompleted, adjustPendingReminders, pushRecordatorioChange,
  }), [
    pendingReminders, reminderAlert,
    clearReminderAlert, markReminderCompleted, adjustPendingReminders, pushRecordatorioChange,
  ]);

  return <RecordatoriosContext.Provider value={value}>{children}</RecordatoriosContext.Provider>;
}

export function useRecordatorios() {
  const ctx = useContext(RecordatoriosContext);
  if (!ctx) throw new Error('useRecordatorios must be used within RecordatoriosProvider');
  return ctx;
}
