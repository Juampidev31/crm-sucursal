'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { useAuth } from '@/context/AuthContext';
import { FilterContext } from '@/context/FilterContext';
import { Recordatorio } from '@/types';
import { validateBroadcast } from '@/lib/broadcast-utils';

export interface ReminderAlertData {
  id: string;
  registro_id?: string;
  nombre: string;
  cuil?: string;
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
  pushRecordatorioChange: (type: ChangeType, recordatorio: Recordatorio | ReminderAlertData) => void;
  forceCheckDue: () => void;
  forceShowPopup: (recordatorio: ReminderAlertData) => void;
}

const RecordatoriosContext = createContext<RecordatoriosCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const recordatorioChangeSchema = z.object({ 
  type: changeType, 
  mostrado: z.boolean().optional(),
  recordatorio: z.object({ id: z.string() }).optional() 
});



export function RecordatoriosProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const { user } = useAuth();
  const filterCtx = React.useContext(FilterContext); // Acceso directo para evitar ciclos si useFilter tiene dependencias
  const [pendingReminders, setPendingReminders] = useState(0);
  const [reminderAlert, setReminderAlert] = useState<ReminderAlertData | null>(null);
  const shownIds = useRef(new Set<string>());

  const fetchCount = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('recordatorios')
        .select('id', { count: 'exact', head: true })
        .eq('mostrado', false);
      
      const selectedAnalista = filterCtx?.filters.analista;
      if (selectedAnalista) {
        query = query.eq('analista', selectedAnalista);
      } else if (user.username !== 'admin') {
        query = query.eq('analista', user.username);
      }

      const { count, error } = await query;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportError, user, filterCtx?.filters.analista]);

  const checkDueReminders = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      let query = supabase
        .from('recordatorios')
        .select('id, registro_id, nombre, cuil, nota, fecha_hora, analista, estado')
        .eq('mostrado', false)
        .lte('fecha_hora', now)
        .order('fecha_hora', { ascending: true });

      const selectedAnalista = filterCtx?.filters.analista;
      if (selectedAnalista) {
        query = query.eq('analista', selectedAnalista);
      } else if (user.username !== 'admin') {
        query = query.eq('analista', user.username);
      }

      const { data, error } = await query;
      console.log('[RecordatoriosProvider] checkDueReminders result:', { count: data?.length, analista: selectedAnalista || user.username });

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
          id: next.id, 
          registro_id: next.registro_id,
          nombre: next.nombre, 
          cuil: next.cuil,
          nota: next.nota,
          fecha_hora: next.fecha_hora, 
          analista: next.analista, 
          estado: next.estado,
        });
      }
    } catch (err) {
      console.warn('[RecordatoriosProvider] Error inesperado en checkDueReminders:', err);
    }
  }, [reportError, user]);

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
      console.log('[RecordatoriosProvider] Broadcast recibido:', payload);
      const data = validateBroadcast('recordatorio_change', recordatorioChangeSchema, payload);
      if (!data) return;
      const { type, mostrado, recordatorio } = data;
      
      // Si es un recordatorio específico, lo quitamos de shownIds para permitir que se muestre de nuevo (re-trigger)
      if (recordatorio?.id) {
        shownIds.current.delete(recordatorio.id);
      }

      if (type === 'INSERT' && !mostrado) setPendingReminders(n => n + 1);
      else if (type === 'UPDATE' && mostrado) setPendingReminders(n => Math.max(0, n - 1));
      else if (type === 'DELETE') setPendingReminders(n => Math.max(0, n - 1));
      
      console.log('[RecordatoriosProvider] Ejecutando checkDueReminders...');
      checkDueRef.current();
    },
    force_show_popup: (payload) => {
      console.log('[RecordatoriosProvider] Broadcast force_show_popup recibido:', payload);
      const rec = payload.recordatorio as ReminderAlertData;
      if (!rec) return;

      // Solo mostramos si es para nosotros
      const selectedAnalista = filterCtx?.filters?.analista;
      if (selectedAnalista) {
        if (rec.analista !== selectedAnalista) return;
      } else if (user?.username && user.username !== 'admin') {
        if (rec.analista !== user.username) return;
      }

      setReminderAlert(rec);
    },
    bulk_refresh: () => { fetchCount(); },
  });

  const forceShowPopup = useCallback((recordatorio: ReminderAlertData) => {
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'force_show_popup',
      payload: { recordatorio },
    }).catch(() => { });
  }, [broadcastRef]);

  const pushRecordatorioChange = useCallback((type: ChangeType, recordatorio: Recordatorio | ReminderAlertData) => {
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'recordatorio_change',
      payload: { type, recordatorio, mostrado: 'mostrado' in recordatorio ? recordatorio.mostrado : undefined },
    }).catch(() => { });
    
    // También procesar localmente si es un trigger de admin
    if (recordatorio?.id) {
      shownIds.current.delete(recordatorio.id);
    }
  }, [broadcastRef]);

  const forceCheckDue = useCallback(() => {
    checkDueRef.current();
  }, []);

  // Fetch inicial + polling de vencidos cada 60s
  useEffect(() => {
    fetchCount();
    checkDueReminders();
    const interval = setInterval(() => checkDueReminders(), 60_000);
    return () => clearInterval(interval);
  }, [fetchCount, checkDueReminders]);

  const value = useMemo<RecordatoriosCtx>(() => ({
    pendingReminders, reminderAlert,
    clearReminderAlert, markReminderCompleted, adjustPendingReminders, pushRecordatorioChange, forceCheckDue, forceShowPopup,
  }), [
    pendingReminders, reminderAlert,
    clearReminderAlert, markReminderCompleted, adjustPendingReminders, pushRecordatorioChange, forceCheckDue, forceShowPopup,
  ]);

  return <RecordatoriosContext.Provider value={value}>{children}</RecordatoriosContext.Provider>;
}

export function useRecordatorios() {
  const ctx = useContext(RecordatoriosContext);
  if (!ctx) throw new Error('useRecordatorios must be used within RecordatoriosProvider');
  return ctx;
}
