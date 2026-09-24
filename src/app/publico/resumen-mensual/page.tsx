import type { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { AlertTriangle } from 'lucide-react';

const MESES_NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type SearchParams = Promise<{ anio?: string; mes?: string; zoom?: string }>;

const parsePeriodo = (params: { anio?: string; mes?: string; zoom?: string }) => {
  const parsedYear = Number.parseInt(params.anio || '', 10);
  const parsedMonth = Number.parseInt(params.mes || '', 10);
  const anio = parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : 2026;
  const mes = parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : 1;
  return { anio, mes };
};

const ErrorScreen = ({ message }: { message: string }) => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-canvas)', padding: '20px' }}>
    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '40px', maxWidth: '500px', textAlign: 'center' }}>
      <div style={{ width: '48px', height: '48px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <AlertTriangle color="var(--danger-strong)" size={24} />
      </div>
      <h2 style={{ color: 'var(--text-strong)', fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>Error al cargar el reporte</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>{message}</p>
    </div>
  </div>
);

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { anio, mes } = parsePeriodo(await searchParams);
  return { title: `Resumen Mensual — ${MESES_NOMBRES[mes - 1]} ${anio}` };
}

async function fetchSnapshot(anio: number, mes: number): Promise<{ html?: string, datos?: any, error?: string }> {
  const supabase = createServerSupabaseClient();
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
      if (parsed.datos) return { datos: parsed.datos, html: parsed.html };
      if (parsed.html) return { html: parsed.html };
    } catch {
      return { html: raw };
    }
  }
  if (raw.length > 200) return { html: raw };

  return { error: 'No hay una captura visual guardada para este reporte.' };
}

import ResumenMensualInteractivo from './ResumenMensualInteractivo';

export default async function ResumenMensualPublico({ searchParams }: { searchParams: SearchParams }) {
  const { anio, mes } = parsePeriodo(await searchParams);
  const result = await fetchSnapshot(anio, mes);

  if ('error' in result) return <ErrorScreen message={result.error || 'Error desconocido'} />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-canvas)', color: 'var(--text-default)', fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <header style={{
        padding: '24px',
        borderBottom: '1px solid var(--neutral-04)',
        background: 'var(--surface-scrim)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ margin: '0' }}>
          <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
            Sistema de Proyecciones y Ventas
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.5px', margin: 0 }}>
            Resumen Mensual — {MESES_NOMBRES[mes - 1]} {anio}
          </h1>
        </div>
      </header>

      <main style={{ padding: '32px 24px', width: '100%', maxWidth: '100%', margin: '0' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          .data-card { width: 100% !important; max-width: 100% !important; }
          #resumen-reporte-body { width: 100% !important; max-width: 100% !important; }
        `}} />
        {result.datos ? (
          <ResumenMensualInteractivo datos={result.datos} />
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: result.html || '' }}
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          />
        )}
      </main>
    </div>
  );
}
