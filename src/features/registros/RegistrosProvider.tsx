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
  registrosWindowMonths: number;
  setRegistrosWindowMonths: (months: number) => void;
  applyRegistroChange: (type: ChangeType, registro: Registro) => void;
  mutateRegistros: (mapper: (prev: Registro[]) => Registro[]) => void;
  refresh: (silent?: boolean) => void;
  pushBulkRefresh: () => void;
}

const RegistrosContext = createContext<RegistrosCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const registroChangeSchema = z.object({ type: changeType, registro: registroSchema });



// Ventana default. Reportes/analistas que necesiten más llaman a
// setRegistrosWindowMonths(N).
const DEFAULT_REGISTROS_WINDOW_MONTHS = 6;

// Cap de seguridad. Con ventana de 6 meses y ritmo actual (~100 rows/mes)
// esto deja ~8x de margen.
const REGISTROS_SAFETY_LIMIT = 5000;

export function RegistrosProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrosWindowMonths, setRegistrosWindowMonths] = useState<number>(DEFAULT_REGISTROS_WINDOW_MONTHS);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const cols = 'id,cuil,nombre,puntaje,es_re,analista,fecha,fecha_score,monto,estado,comentarios,tipo_cliente,acuerdo_precios,cuotas,rango_etario,sexo,empleador,localidad,created_at,updated_at';
    let query = supabase.from('registros').select(cols);
    if (registrosWindowMonths > 0) {
      const since = new Date();
      since.setMonth(since.getMonth() - registrosWindowMonths);
      const sinceIso = since.toISOString().slice(0, 10);
      query = query.or(`fecha.gte.${sinceIso},fecha.is.null`);
    }
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
    setLoading(false);
  }, [reportError, registrosWindowMonths]);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const broadcastRef = useRealtimeBroadcast('crm-broadcast', {
    registro_change: (payload) => {
      const data = validateBroadcast('registro_change', registroChangeSchema, payload);
      if (!data) return;
      const { type, registro } = data;
      if (type === 'INSERT') setRegistros(prev => [registro, ...prev]);
      else if (type === 'UPDATE') setRegistros(prev => prev.map(r => r.id === registro.id ? registro : r));
      else if (type === 'DELETE') setRegistros(prev => prev.filter(r => r.id !== registro.id));
    },
    bulk_refresh: () => { refreshRef.current(true); },
  });

  const pushRegistroChange = useCallback((type: ChangeType, registro: Registro) => {
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'registro_change',
      payload: { type, registro },
    }).catch(() => { });
  }, [broadcastRef]);

  const pushBulkRefresh = useCallback(() => {
    broadcastRef.current?.send({ type: 'broadcast', event: 'bulk_refresh', payload: {} });
  }, [broadcastRef]);

  const mutateRegistros = useCallback((mapper: (prev: Registro[]) => Registro[]) => {
    setRegistros(mapper);
  }, []);

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

  const value = useMemo<RegistrosCtx>(() => ({
    registros, loading, registrosWindowMonths, setRegistrosWindowMonths,
    applyRegistroChange, mutateRegistros, refresh, pushBulkRefresh,
  }), [
    registros, loading, registrosWindowMonths,
    applyRegistroChange, mutateRegistros, refresh, pushBulkRefresh,
  ]);

  return <RegistrosContext.Provider value={value}>{children}</RegistrosContext.Provider>;
}

export function useRegistros() {
  const ctx = useContext(RegistrosContext);
  if (!ctx) throw new Error('useRegistros must be used within RegistrosProvider');
  return ctx;
}
