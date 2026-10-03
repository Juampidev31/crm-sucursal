'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useRealtimeBroadcast } from '@/lib/useRealtimeBroadcast';
import { useDataError } from '@/context/ErrorContext';
import { Registro, parseRegistros, registroSchema } from '@/types';
import { validateBroadcast } from '@/lib/broadcast-utils';
import { getRequestErrorMessage, isTransientRequestAbort } from '@/lib/request-errors';
import { aplicarCambiosRegistros, type CambioRegistro, type ChangeType } from './realtime-batch';

type RegistroPatch = Partial<Registro>;
type FieldKey = keyof Registro;

interface RegistrosCtx {
  registros: Registro[];
  loading: boolean;
  applyRegistroChange: (type: ChangeType, registro: Registro) => void;
  mutateRegistros: (mapper: (prev: Registro[]) => Registro[]) => void;
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

// Agrupado de eventos realtime. Una modificación masiva de N filas vuelve como
// N eventos `postgres_changes` sueltos (uno por fila) a TODAS las pestañas,
// incluida la que hizo el cambio. Aplicarlos de a uno costaba un commit de
// React por evento: medido con 406 filas, ~50 s de main thread bloqueado.
// Se acumulan en una ventana corta y se aplican en un único setState.
const REALTIME_FLUSH_MS = 120;       // ventana de agrupado tras el último evento
const REALTIME_FLUSH_MAX_MS = 600;   // tope: nunca retrasar un cambio más que esto

export function RegistrosProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useDataError();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshIdRef = useRef(0);

  const refresh = useCallback(async (silent = false) => {
    let cols = 'id,cuil,nombre,puntaje,es_re,analista,fecha,fecha_score,monto,interes,estado,comentarios,telefono,tipo_cliente,acuerdo_precios,autorizacion_cc,cuotas,rango_etario,sexo,empleador,dependencia,localidad,etiquetas,fijado,created_at,updated_at';
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
    let first: unknown[] | null = null;
    let firstErr: unknown = null;
    let count: number | null = null;

    try {
      const res = await supabase
        .from('registros')
        .select(cols, { count: 'exact' })
        .order('fecha', { ascending: false })
        .order('id', { ascending: true })
        .range(0, PAGE - 1);
      first = res.data;
      firstErr = res.error;
      count = res.count;

      // Fallback de seguridad si la columna 'etiquetas' aún no fue creada en la BD de Supabase
      if (firstErr && (firstErr as { code?: string }).code === '42703') {
        cols = 'id,cuil,nombre,puntaje,es_re,analista,fecha,fecha_score,monto,interes,estado,comentarios,telefono,tipo_cliente,acuerdo_precios,autorizacion_cc,cuotas,rango_etario,sexo,empleador,dependencia,localidad,fijado,created_at,updated_at';
        const fallbackRes = await supabase
          .from('registros')
          .select(cols, { count: 'exact' })
          .order('fecha', { ascending: false })
          .order('id', { ascending: true })
          .range(0, PAGE - 1);
        first = fallbackRes.data;
        firstErr = fallbackRes.error;
      }
    } catch (networkErr: unknown) {
      firstErr = networkErr;
    }

    if (refreshIdRef.current !== myId) return; // refresh nuevo invalidó este

    if (firstErr) {
      const errMsg = getRequestErrorMessage(firstErr);
      if (isTransientRequestAbort(firstErr)) {
        console.warn('[RegistrosProvider] Error de red transitorio en refresh:', errMsg);
      } else {
        reportError('refresh:registros', firstErr as { message: string });
      }
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
    const lastIdx = Math.min(total, REGISTROS_SAFETY_LIMIT) - 1;
    const ranges: Array<[number, number]> = [];
    for (let from = PAGE; from <= lastIdx; from += PAGE) {
      ranges.push([from, Math.min(from + PAGE - 1, lastIdx)]);
    }

    const fetchRange = (from: number, to: number) => supabase
      .from('registros')
      .select(cols)
      .order('fecha', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    let results: Awaited<ReturnType<typeof fetchRange>>[] = [];
    try {
      results = await Promise.all(
        ranges.map(([f, t]) =>
          // El desempate por `id` es obligatorio: estas páginas se piden en
          // PARALELO y cada una es una consulta independiente. Sin un orden
          // determinista, las filas con la misma `fecha` (hasta 139 empates)
          // pueden repartirse distinto entre páginas y producir duplicados y
          // omisiones silenciosas.
          fetchRange(f, t)
        )
      );
    } catch (parallelErr: unknown) {
      console.warn('[RegistrosProvider] Error de red en chunks paralelos:', getRequestErrorMessage(parallelErr));
      return;
    }

    if (refreshIdRef.current !== myId) return;

    let totalDropped = 0;
    const restRaw: unknown[] = [];
    for (const res of results) {
      const chunk = res?.data;
      const err = res?.error;
      if (err) {
        const msg = getRequestErrorMessage(err);
        if (isTransientRequestAbort(err)) {
          console.warn('[RegistrosProvider] Error de red en chunk:', msg);
        } else {
          reportError('refresh:registros', err as { message: string });
        }
        continue;
      }
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
  }, [reportError]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const mutateRegistros = useCallback((mapper: (prev: Registro[]) => Registro[]) => {
    setRegistros(mapper);
  }, []);

  const applyRegistroChange = useCallback((type: ChangeType, reg: Registro) => {
    setRegistros(prev => aplicarCambiosRegistros(prev, [{ type, registro: reg }]));
  }, []);

  // ── Realtime: detecta cambios externos (móvil, otra app) ─────────────────
  const pendientesRef = useRef<CambioRegistro[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const flushTopeRef = useRef(0);

  const vaciarPendientes = useCallback(() => {
    flushTimerRef.current = null;
    const lote = pendientesRef.current;
    if (lote.length === 0) return;
    pendientesRef.current = [];
    // `aplicarCambiosRegistros` devuelve `prev` si el lote no cambia nada —el
    // caso normal cuando el cambio lo hizo esta pestaña y ya se aplicó local—
    // y entonces React ni siquiera re-renderiza.
    setRegistros(prev => aplicarCambiosRegistros(prev, lote));
  }, []);

  const encolarCambio = useCallback((type: ChangeType, registro: Registro) => {
    pendientesRef.current.push({ type, registro });
    const ahora = Date.now();
    if (flushTimerRef.current === null) {
      flushTopeRef.current = ahora + REALTIME_FLUSH_MAX_MS;
    } else {
      // Durante una ráfaga reprogramamos para agrupar más, pero sin pasarnos
      // del tope: así un goteo continuo igual se ve como máximo cada 600 ms.
      if (ahora + REALTIME_FLUSH_MS >= flushTopeRef.current) return;
      window.clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = window.setTimeout(vaciarPendientes, REALTIME_FLUSH_MS);
  }, [vaciarPendientes]);

  const encolarRef = useRef(encolarCambio);
  useEffect(() => { encolarRef.current = encolarCambio; }, [encolarCambio]);

  useEffect(() => {
    const channel = supabase
      .channel('registros-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registros' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const parsed = registroSchema.safeParse(payload.new);
            if (parsed.success) encolarRef.current('INSERT', parsed.data);
          } else if (payload.eventType === 'UPDATE') {
            const parsed = registroSchema.safeParse(payload.new);
            if (parsed.success) encolarRef.current('UPDATE', parsed.data);
          } else if (payload.eventType === 'DELETE') {
            const parsed = registroSchema.safeParse(payload.old);
            if (parsed.success) encolarRef.current('DELETE', parsed.data);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
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
    registros, loading,
    applyRegistroChange, mutateRegistros, refresh, pushBulkRefresh, pushRegistroChange,
    pushBulkUpdateIds, pushBulkPatchByField,
  }), [
    registros, loading,
    applyRegistroChange, mutateRegistros, refresh, pushBulkRefresh, pushRegistroChange,
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
    if (safe) return { registros: [], loading: false, applyRegistroChange: () => {}, mutateRegistros: () => {}, refresh: () => {}, pushBulkRefresh: () => {}, pushRegistroChange: () => {}, pushBulkUpdateIds: () => {}, pushBulkPatchByField: () => {} };
    throw new Error('useRegistros must be used within RegistrosProvider');
  }
  return ctx;
}
