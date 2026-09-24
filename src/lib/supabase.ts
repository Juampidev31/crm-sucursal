'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  client = createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}

// Evita crear conexiones o validar variables durante el import/prerender. La
// instancia real se construye al realizar la primera operación en el navegador.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const instance = getClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
