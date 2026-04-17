import React from 'react';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { AlertTriangle } from 'lucide-react';

const MESES_NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type SearchParams = Promise<{ anio?: string; mes?: string }>;

const parsePeriodo = (params: { anio?: string; mes?: string }) => {
  const anio = parseInt(params.anio || '2026');
  const mes = parseInt(params.mes || '1');
  return { anio, mes };
};

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { anio, mes } = parsePeriodo(await searchParams);
  return { title: `Resumen Mensual — ${MESES_NOMBRES[mes - 1]} ${anio}` };
}

async function fetchSnapshot(anio: number, mes: number): Promise<{ html: string } | { error: string }> {
  const { data, error } = await supabase
    .from('resumen_mensual')
    .select('experiencia_cliente')
    .eq('anio', anio)
    .eq('mes', mes)
    .maybeSingle();

  if (error) return { error: error.message };

  const raw = data?.experiencia_cliente;
  if (!raw) {
    return { error: `No se encontró el reporte para ${MESES_NOMBRES[mes - 1]} ${anio}. Primero generá el link desde Ajustes > Resumen Mensual.` };
  }

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.html) return { html: parsed.html };
    } catch {
      return { html: raw };
    }
  }
  if (raw.length > 200) return { html: raw };

  return { error: 'No hay una captura visual guardada para este reporte.' };
}

const ErrorScreen = ({ message }: { message: string }) => (
  <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ textAlign: 'center', padding: 40 }}>
      <AlertTriangle size={48} style={{ color: '#f87171', margin: '0 auto 16px' }} />
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>Reporte no disponible</h2>
      <p style={{ color: '#666', fontSize: 14 }}>{message}</p>
    </div>
  </div>
);

export default async function ResumenMensualPublico({ searchParams }: { searchParams: SearchParams }) {
  const { anio, mes } = parsePeriodo(await searchParams);
  const result = await fetchSnapshot(anio, mes);

  if ('error' in result) return <ErrorScreen message={result.error} />;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#ccc', fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{
        padding: '24px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
            Sistema de Proyecciones y Ventas
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>
            Resumen Mensual — {MESES_NOMBRES[mes - 1]} {anio}
          </h1>
        </div>
      </header>

      <main style={{ padding: '32px 24px' }}>
        <div
          dangerouslySetInnerHTML={{ __html: result.html }}
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
        />
      </main>
    </div>
  );
}
