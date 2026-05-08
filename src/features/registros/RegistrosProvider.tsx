'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { Registro, parseRegistros, registroSchema } from '@/types';
import { validateBroadcast } from '@/lib/broadcast-utils';

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface RegistrosCtx {
  registros: Registro[];
  loading: boolean;
  applyRegistroChange: (type: ChangeType, registro: Registro) => void;
  mutateRegistros: (mapper: (prev: Registro[]) => Registro[]) => void;
  refresh: (silent?: boolean) => void;
  pushBulkRefresh: () => void;
  pushRegistroChange: (type: ChangeType, registro: Registro) => void;
}

const RegistrosContext = createContext<RegistrosCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const registroChangeSchema = z.object({ type: changeType, registro: registroSchema });

// Cap de seguridad aumentado para cargar todo.
const REGISTROS_SAFETY_LIMIT = 50000;

export function RegistrosProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const cols = 'id,cuil,nombre,puntaje,es_re,analista,fecha,fecha_score,monto,estado,comentarios,tipo_cliente,acuerdo_precios,cuotas,rango_etario,sexo,empleador,localidad,created_at,updated_at';
    let query = supabase.from('registros').select(cols);
    
    const { data, error } = await query.order('fecha', { ascending: false }).limit(REGISTROS_SAFETY_LIMIT);
    if (error) reportError('refresh:registros', error);
    else if (data) {
      let dropped = 0;
      const parsed = parseRegistros(data, (i, err, row) => {
        dropped++;
        const rowId = (row && typeof row === 'object' && 'id' in row) ? (row as { id: unknown }).id : '?';
        console.warn(`[RegistrosProvider] registro inválido [${i}] id=${rowId}:`, err.issues);
      });
      if (dropped > 0) reportError('refresh:registros', { message: `${dropped} registro(s) descartado(s) por validación — revisá consola` });
      setRegistros(parsed);
    }
    if (!silent) setLoading(false);
  }, [reportError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mutateRegistros = useCallback((mapper: (prev: Registro[]) => Registro[]) => {
    setRegistros(mapper);
  }, []);

  const applyRegistroChange = useCallback((type: ChangeType, reg: Registro) => {
    setRegistros(prev => {
      if (type === 'DELETE') return prev.filter(r => r.id !== reg.id);
      const exists = prev.findIndex(r => r.id === reg.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = reg;
        return next.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      }
      return [reg, ...prev].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    });
  }, []);

  const channelRef = useRealtimeBroadcast('registros-updates', {
    update: (payload) => {
      if (payload.type === 'REFRESH_ALL') {
        refresh(true);
        return;
      }
      const data = validateBroadcast('update', registroChangeSchema, payload);
      if (data) {
        applyRegistroChange(data.type, data.registro);
      }
    }
  });

  const pushBulkRefresh = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'update',
      payload: { type: 'REFRESH_ALL' }
    });
  }, [channelRef]);

  const pushRegistroChange = useCallback((type: ChangeType, registro: Registro) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'update',
      payload: { type, registro }
    });
  }, [channelRef]);

  const value = useMemo(() => ({
    registros, loading,
    applyRegistroChange, mutateRegistros, refresh, pushBulkRefresh, pushRegistroChange,
  }), [
    registros, loading,
    applyRegistroChange, mutateRegistros, refresh, pushBulkRefresh, pushRegistroChange,
  ]);

  return (
    <RegistrosContext.Provider value={value}>
      {children}
    </RegistrosContext.Provider>
  );
}

export function useRegistros(safe = false) {
  const ctx = useContext(RegistrosContext);
  if (!ctx) {
    if (safe) return { registros: [], loading: false, applyRegistroChange: () => {}, mutateRegistros: () => {}, refresh: () => {}, pushBulkRefresh: () => {}, pushRegistroChange: () => {} };
    throw new Error('useRegistros must be used within RegistrosProvider');
  }
  return ctx;
}
