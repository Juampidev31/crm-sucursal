'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { GestionDiaria, parseRows, gestionDiariaSchema } from '@/types';
import { validateBroadcast } from '@/lib/broadcast-utils';
import { fetchAllRows } from '@/lib/supabase-paginate';

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

interface GestionDiariaCtx {
  registros: GestionDiaria[];
  loading: boolean;
  applyChange: (type: ChangeType, registro: GestionDiaria) => void;
  refresh: () => void;
  pushChange: (type: ChangeType, registro: GestionDiaria) => void;
}

const GestionDiariaContext = createContext<GestionDiariaCtx | null>(null);

const changeType = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const changeSchema = z.object({ type: changeType, registro: gestionDiariaSchema });

const COLS = 'id,analista,tipo_cliente,fecha,nombre,cuil,actividad,donde_nos_conocio,estado,score,tipo_operacion,monto_otorgado,capital_x_venta,interes_x_venta,comentarios,created_at,updated_at';

export function GestionDiariaProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [registros, setRegistros] = useState<GestionDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const myId = ++refreshIdRef.current;
    setLoading(true);
    // `.limit(5000)` NO sirve para traer más de 1000 filas: Supabase aplica su
    // tope de filas por respuesta igual (medido: devolvía 1000 de 1957, sin
    // error). Hay que paginar. El orden lleva desempate por `id` porque `fecha`
    // tiene empates y una paginación sobre orden no determinista repite y omite
    // filas entre páginas.
    const { rows: data, error } = await fetchAllRows(
      (from, to) =>
        supabase
          .from('gestion_diaria')
          .select(COLS)
          .order('fecha', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      { isCancelled: () => refreshIdRef.current !== myId },
    );
    if (refreshIdRef.current !== myId) return;
    if (error) {
      reportError('refresh:gestion_diaria', { message: error });
      setLoading(false);
      return;
    }
    let dropped = 0;
    const parsed = parseRows<GestionDiaria>(gestionDiariaSchema, data ?? [], (i, err, row) => {
      dropped++;
      const rowId = (row && typeof row === 'object' && 'id' in row) ? (row as { id: unknown }).id : '?';
      console.warn(`[GestionDiariaProvider] fila inválida [${i}] id=${rowId}:`, err.issues);
    });
    setRegistros(parsed);
    setLoading(false);
    if (dropped > 0) reportError('refresh:gestion_diaria', { message: `${dropped} fila(s) descartada(s) por validación — revisá consola` });
  }, [reportError]);

  useEffect(() => { refresh(); }, [refresh]);

  const applyChange = useCallback((type: ChangeType, reg: GestionDiaria) => {
    setRegistros(prev => {
      if (type === 'DELETE') return prev.filter(r => r.id !== reg.id);
      const idx = prev.findIndex(r => r.id === reg.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = reg; return next; }
      return [reg, ...prev];
    });
  }, []);

  const applyChangeRef = useRef(applyChange);
  useEffect(() => { applyChangeRef.current = applyChange; }, [applyChange]);

  useEffect(() => {
    const channel = supabase
      .channel('gestion-diaria-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gestion_diaria' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const parsed = gestionDiariaSchema.safeParse(payload.new);
          if (parsed.success) applyChangeRef.current(payload.eventType, parsed.data);
        } else if (payload.eventType === 'DELETE') {
          const parsed = gestionDiariaSchema.safeParse(payload.old);
          if (parsed.success) applyChangeRef.current('DELETE', parsed.data);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const channelRef = useRealtimeBroadcast('gestion-diaria-updates', {
    update: (payload) => {
      const data = validateBroadcast('update', changeSchema, payload);
      if (data) applyChange(data.type, data.registro);
    },
  });

  const pushChange = useCallback((type: ChangeType, registro: GestionDiaria) => {
    channelRef.current?.send({ type: 'broadcast', event: 'update', payload: { type, registro } });
  }, [channelRef]);

  const value = useMemo(() => ({ registros, loading, applyChange, refresh, pushChange }), [registros, loading, applyChange, refresh, pushChange]);

  return <GestionDiariaContext.Provider value={value}>{children}</GestionDiariaContext.Provider>;
}

export function useGestionDiaria() {
  const ctx = useContext(GestionDiariaContext);
  if (!ctx) throw new Error('useGestionDiaria must be used within GestionDiariaProvider');
  return ctx;
}
