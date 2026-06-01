'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { Registro, parseRegistros, registroSchema } from '@/types';
import { validateBroadcast } from '@/lib/broadcast-utils';

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

type RegistroPatch = Partial<Registro>;
type FieldKey = keyof Registro;

interface RegistrosCtx {
  registros: Registro[];
  loading: boolean;
  loadingMore: boolean;
  applyRegistroChange: (type: ChangeType, registro: Registro) => void;
  mutateRegistros: (mapper: (prev: Registro[]) => Registro[]) => void;
  bulkInsertRegistros: (newRegistros: Partial<Registro>[]) => Promise<void>;
  refresh: (silent?: boolean) => void;
  pushBulkRefresh: () => void;
  pushRegistroChange: (type: ChangeType, registro: Registro) => void;
  pushBulkUpdateIds: (ids: string[], patch: RegistroPatch) => void;
  pushBulkPatchByField: (field: FieldKey, oldValues: string[], patch: RegistroPatch) => void;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const refreshIdRef = useRef(0);

  const refresh = useCallback(async (silent = false) => {
    const cols = 'id,cuil,nombre,puntaje,es_re,analista,fecha,fecha_score,monto,estado,comentarios,tipo_cliente,acuerdo_precios,cuotas,rango_etario,sexo,empleador,dependencia,localidad,created_at,updated_at';
    const PAGE = 1000;
    const myId = ++refreshIdRef.current;

    if (!silent) setLoading(true);

    const parseChunk = (chunk: unknown[]) => {
      let dropped = 0;
      const parsed = parseRegistros(chunk, (i, err, row) => {
        dropped++;
        const rowId = (row && typeof row === 'object' && 'id' in row) ? (row as { id: unknown }).id : '?';
        console.warn(`[RegistrosProvider] registro inválido [${i}] id=${rowId}:`, err.issues);
      });
      return { parsed, dropped };
    };

    // Chunk #1: bloqueamos el render hasta tenerlo (≈1 round-trip).
    const { data: first, error: firstErr, count } = await supabase
      .from('registros')
      .select(cols, { count: 'exact' })
      .order('fecha', { ascending: false })
      .range(0, PAGE - 1);

    if (refreshIdRef.current !== myId) return; // refresh nuevo invalidó este

    if (firstErr) {
      reportError('refresh:registros', firstErr as { message: string });
      if (!silent) setLoading(false);
      return;
    }

    const { parsed: firstParsed, dropped: firstDropped } = parseChunk(first || []);
    setRegistros(firstParsed);
    if (!silent) setLoading(false);
    if (firstDropped > 0) reportError('refresh:registros', { message: `${firstDropped} registro(s) descartado(s) por validación — revisá consola` });

    // Si no hay más páginas, terminamos.
    const total = typeof count === 'number' ? count : (first?.length ?? 0);
    if (!first || first.length < PAGE || total <= PAGE) return;

    // Chunks #2..#N en paralelo.
    setLoadingMore(true);
    const lastIdx = Math.min(total, REGISTROS_SAFETY_LIMIT) - 1;
    const ranges: Array<[number, number]> = [];
    for (let from = PAGE; from <= lastIdx; from += PAGE) {
      ranges.push([from, Math.min(from + PAGE - 1, lastIdx)]);
    }

    const results = await Promise.all(
      ranges.map(([f, t]) =>
        supabase.from('registros').select(cols).order('fecha', { ascending: false }).range(f, t)
      )
    );

    if (refreshIdRef.current !== myId) return;

    let totalDropped = 0;
    const restRaw: unknown[] = [];
    for (const { data: chunk, error: err } of results) {
      if (err) { reportError('refresh:registros', err as { message: string }); continue; }
      if (chunk) restRaw.push(...chunk);
    }
    const { parsed: restParsed, dropped: restDropped } = parseChunk(restRaw);
    totalDropped += restDropped;

    setRegistros(prev => {
      // De-dup por id por si llegó algún realtime mientras tanto.
      const seen = new Set(prev.map(r => r.id));
      const merged = prev.slice();
      for (const r of restParsed) if (!seen.has(r.id)) merged.push(r);
      return merged;
    });
    if (totalDropped > 0) reportError('refresh:registros', { message: `${totalDropped} registro(s) descartado(s) por validación — revisá consola` });
    setLoadingMore(false);
  }, [reportError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Suscripción Realtime: detecta cambios desde cualquier cliente (móvil, app externa, etc.) ──
  useEffect(() => {
    const channel = supabase
      .channel('registros-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registros' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const parsed = registroSchema.safeParse(payload.new);
            if (parsed.success) applyRegistroChange('INSERT', parsed.data);
          } else if (payload.eventType === 'UPDATE') {
            const parsed = registroSchema.safeParse(payload.new);
            if (parsed.success) applyRegistroChange('UPDATE', parsed.data);
          } else if (payload.eventType === 'DELETE') {
            const parsed = registroSchema.safeParse(payload.old);
            if (parsed.success) applyRegistroChange('DELETE', parsed.data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyRegistroChange]);

  const mutateRegistros = useCallback((mapper: (prev: Registro[]) => Registro[]) => {
    setRegistros(mapper);
  }, []);

  const bulkInsertRegistros = async (newRegistros: Partial<Registro>[]) => {
    const { error } = await supabase.from('registros').insert(newRegistros);
    if (error) throw error;
    pushBulkRefresh();
    await refresh(true);
  };

  const applyRegistroChange = useCallback((type: ChangeType, reg: Registro) => {
    setRegistros(prev => {
      if (type === 'DELETE') return prev.filter(r => r.id !== reg.id);

      const exists = prev.findIndex(r => r.id === reg.id);
      if (exists >= 0) {
        // UPDATE: replace in-place without re-sorting (date rarely changes)
        const next = [...prev];
        next[exists] = reg;
        return next;
      }

      // INSERT: prepend and let the page-level sort handle ordering
      return [reg, ...prev];
    });
  }, []);

  const channelRef = useRealtimeBroadcast('registros-updates', {
    update: (payload) => {
      if (payload.type === 'REFRESH_ALL') {
        refresh(true);
        return;
      }
      if (payload.type === 'BULK_UPDATE_IDS' && Array.isArray(payload.ids) && payload.patch && typeof payload.patch === 'object') {
        const idsSet = new Set<string>(payload.ids as string[]);
        const patch = payload.patch as RegistroPatch;
        setRegistros(prev => prev.map(r => idsSet.has(r.id) ? { ...r, ...patch } : r));
        return;
      }
      if (payload.type === 'BULK_PATCH_FIELD' && typeof payload.field === 'string' && Array.isArray(payload.oldValues) && payload.patch && typeof payload.patch === 'object') {
        const field = payload.field as FieldKey;
        const oldSet = new Set<string>(payload.oldValues as string[]);
        const patch = payload.patch as RegistroPatch;
        setRegistros(prev => prev.map(r => oldSet.has((r[field] as unknown as string) ?? '') ? { ...r, ...patch } : r));
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

  const pushBulkUpdateIds = useCallback((ids: string[], patch: RegistroPatch) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'update',
      payload: { type: 'BULK_UPDATE_IDS', ids, patch }
    });
  }, [channelRef]);

  const pushBulkPatchByField = useCallback((field: FieldKey, oldValues: string[], patch: RegistroPatch) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'update',
      payload: { type: 'BULK_PATCH_FIELD', field, oldValues, patch }
    });
  }, [channelRef]);

  const value = useMemo(() => ({
    registros, loading, loadingMore,
    applyRegistroChange, mutateRegistros, bulkInsertRegistros, refresh, pushBulkRefresh, pushRegistroChange,
    pushBulkUpdateIds, pushBulkPatchByField,
  }), [
    registros, loading, loadingMore,
    applyRegistroChange, mutateRegistros, bulkInsertRegistros, refresh, pushBulkRefresh, pushRegistroChange,
    pushBulkUpdateIds, pushBulkPatchByField,
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
    if (safe) return { registros: [], loading: false, loadingMore: false, applyRegistroChange: () => {}, mutateRegistros: () => {}, bulkInsertRegistros: async () => {}, refresh: () => {}, pushBulkRefresh: () => {}, pushRegistroChange: () => {}, pushBulkUpdateIds: () => {}, pushBulkPatchByField: () => {} };
    throw new Error('useRegistros must be used within RegistrosProvider');
  }
  return ctx;
}
