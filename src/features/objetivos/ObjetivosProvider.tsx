'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { Objetivo, objetivoSchema, parseRows } from '@/types';

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface ObjetivosCtx {
  objetivos: Objetivo[];
  mutateObjetivos: (mapper: (prev: Objetivo[]) => Objetivo[]) => void;
  pushObjetivosChange: (type: ChangeType, objetivo: Objetivo) => void;
}

const ObjetivosContext = createContext<ObjetivosCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const objetivoChangeSchema = z.object({ type: changeType, objetivo: objetivoSchema });

function validateBroadcast<T>(event: string, schema: z.ZodType<T>, payload: unknown): T | null {
  const r = schema.safeParse(payload);
  if (!r.success) {
    console.warn(`[broadcast] ${event} payload inválido:`, r.error.issues);
    return null;
  }
  return r.data;
}

export function ObjetivosProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);

  const fetchObjetivos = useCallback(async () => {
    const { data, error } = await supabase
      .from('objetivos')
      .select('id,analista,mes,anio,meta_ventas,meta_operaciones');
    if (error) { reportError('refresh:objetivos', error); return; }
    let dropped = 0;
    const parsed = parseRows(objetivoSchema, data, (i, err, row) => {
      dropped++;
      const rowId = (row && typeof row === 'object' && 'id' in row) ? (row as { id: unknown }).id : '?';
      console.warn(`[ObjetivosProvider] objetivo inválido [${i}] id=${rowId}:`, err.issues);
    });
    if (dropped > 0) reportError('refresh:objetivos', { message: `${dropped} fila(s) descartada(s) en objetivos — revisá consola` });
    setObjetivos(parsed);
  }, [reportError]);

  const fetchRef = useRef(fetchObjetivos);
  useEffect(() => { fetchRef.current = fetchObjetivos; }, [fetchObjetivos]);

  const broadcastRef = useRealtimeBroadcast('crm-broadcast', {
    objetivos_change: (payload) => {
      const data = validateBroadcast('objetivos_change', objetivoChangeSchema, payload);
      if (!data) return;
      const { type, objetivo } = data;
      setObjetivos(prev => {
        if (type === 'DELETE') {
          return prev.filter(o => !(o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio));
        }
        const exists = prev.some(o => o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio);
        if (exists) return prev.map(o => o.analista === objetivo.analista && o.mes === objetivo.mes && o.anio === objetivo.anio ? objetivo : o);
        return [...prev, objetivo];
      });
    },
    bulk_refresh: () => { fetchRef.current(); },
  });

  const mutateObjetivos = useCallback((mapper: (prev: Objetivo[]) => Objetivo[]) => {
    setObjetivos(mapper);
  }, []);

  const pushObjetivosChange = useCallback((type: ChangeType, objetivo: Objetivo) => {
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'objetivos_change',
      payload: { type, objetivo },
    }).catch(() => { });
  }, [broadcastRef]);

  useEffect(() => { fetchObjetivos(); }, [fetchObjetivos]);

  const value = useMemo<ObjetivosCtx>(() => ({
    objetivos, mutateObjetivos, pushObjetivosChange,
  }), [objetivos, mutateObjetivos, pushObjetivosChange]);

  return <ObjetivosContext.Provider value={value}>{children}</ObjetivosContext.Provider>;
}

export function useObjetivos() {
  const ctx = useContext(ObjetivosContext);
  if (!ctx) throw new Error('useObjetivos must be used within ObjetivosProvider');
  return ctx;
}
