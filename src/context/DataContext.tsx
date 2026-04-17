'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { Registro, parseRegistros, registroSchema } from '@/types';

// Schemas de payloads broadcast: wrap cada entidad con el tipo de cambio.
// Se validan en los handlers para no consumir mensajes malformados
// (p.ej. de clientes con versión desfasada) y solo loguean en consola.
const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const registroChangeSchema = z.object({ type: changeType, registro: registroSchema });

function validateBroadcast<T>(event: string, schema: z.ZodType<T>, payload: unknown): T | null {
  const r = schema.safeParse(payload);
  if (!r.success) {
    console.warn(`[broadcast] ${event} payload inválido:`, r.error.issues);
    return null;
  }
  return r.data;
}

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface DataCtx {
  registros: Registro[];
  loading: boolean;
  registrosWindowMonths: number;
  setRegistrosWindowMonths: (months: number) => void;
  applyRegistroChange: (type: ChangeType, registro: Registro) => void;
  mutateRegistros: (mapper: (prev: Registro[]) => Registro[]) => void;
  refresh: (silent?: boolean) => void;
  pushRegistroChange: (type: ChangeType, registro: Registro) => void;
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
  const [loading, setLoading] = useState(true);
  const [registrosWindowMonths, setRegistrosWindowMonths] = useState<number>(DEFAULT_REGISTROS_WINDOW_MONTHS);
  const { reportError } = useDataError();

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const cols = 'id,cuil,nombre,puntaje,es_re,analista,fecha,fecha_score,monto,estado,comentarios,tipo_cliente,acuerdo_precios,cuotas,rango_etario,sexo,empleador,localidad,created_at,updated_at';
    let registrosQuery = supabase.from('registros').select(cols);
    if (registrosWindowMonths > 0) {
      const since = new Date();
      since.setMonth(since.getMonth() - registrosWindowMonths);
      const sinceIso = since.toISOString().slice(0, 10);
      registrosQuery = registrosQuery.or(`fecha.gte.${sinceIso},fecha.is.null`);
    }
    const regsR = await registrosQuery.order('fecha', { ascending: false }).limit(REGISTROS_SAFETY_LIMIT);
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

  const value = useMemo<DataCtx>(() => ({
    registros, loading,
    registrosWindowMonths, setRegistrosWindowMonths,
    applyRegistroChange, mutateRegistros,
    refresh, pushRegistroChange, pushBulkRefresh,
  }), [
    registros, loading, registrosWindowMonths,
    applyRegistroChange, mutateRegistros,
    refresh, pushRegistroChange, pushBulkRefresh,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
