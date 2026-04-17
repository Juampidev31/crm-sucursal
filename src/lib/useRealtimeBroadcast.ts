'use client';

import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

type BroadcastPayload = Record<string, unknown>;
type BroadcastHandler = (payload: BroadcastPayload) => void;
type EventMap = Record<string, BroadcastHandler>;

// Hook: suscribe un único canal broadcast de Supabase con N eventos.
// - `channelName` es la identidad del canal (cambiarla re-subscribe)
// - `events` puede mutar entre renders sin provocar re-subscripciones;
//   los handlers se leen vía ref, así siempre corre la versión actual
// - Retorna un ref al canal, útil para enviar broadcasts salientes
//   (p.ej. `ref.current?.send({ type: 'broadcast', event, payload })`)
export function useRealtimeBroadcast(channelName: string, events: EventMap) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const eventsRef = useRef<EventMap>(events);
  useEffect(() => { eventsRef.current = events; });

  // Capturar los event names solo en el primer render: si luego se agregan
  // nuevos eventos al map no se van a suscribir. Es la misma constraint que
  // tenía el código inline; documentamos por si algún día hace falta.
  const initialEventNames = useRef<string[]>(Object.keys(events));

  useEffect(() => {
    let bc = supabase.channel(channelName, { config: { broadcast: { self: false } } });
    for (const event of initialEventNames.current) {
      bc = bc.on('broadcast', { event }, ({ payload }) => {
        eventsRef.current[event]?.(payload as BroadcastPayload);
      });
    }
    bc.subscribe();
    channelRef.current = bc;
    return () => {
      supabase.removeChannel(bc);
      channelRef.current = null;
    };
  }, [channelName]);

  return channelRef;
}
