import React from 'react';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { AlertTriangle } from 'lucide-react';
import styles from './ResumenMensualPublico.module.css';
import ResumenMensualInteractivo from './ResumenMensualInteractivo';
import { detectResumenSnapshotVersion, parseStoredResumenSnapshot, wrapResumenSnapshot } from '@/lib/resumenSnapshot';

type DatosGraficos = React.ComponentProps<typeof ResumenMensualInteractivo>['datos'];

const MESES_NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type SearchParams = Promise<{ anio?: string; mes?: string; zoom?: string; snapshotPreview?: string }>;

const parsePeriodo = (params: { anio?: string; mes?: string; zoom?: string; snapshotPreview?: string }) => {
  const anio = parseInt(params.anio || '2026');
  const mes = parseInt(params.mes || '1');
  const zoom = parseFloat(params.zoom || '1');
  const snapshotPreview = process.env.NODE_ENV === 'development' ? params.snapshotPreview : undefined;
  return { anio, mes, zoom, snapshotPreview };
};

const ErrorScreen = ({ message }: { message: string }) => (
  <div className={styles.errorPage}>
    <div className={styles.errorCard}>
      <div className={styles.errorIcon}>
        <AlertTriangle size={24} />
      </div>
      <h2 className={styles.errorTitle}>Error al cargar el reporte</h2>
      <p className={styles.errorMessage}>{message}</p>
    </div>
  </div>
);

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { anio, mes } = parsePeriodo(await searchParams);
  return { title: `Resumen Mensual — ${MESES_NOMBRES[mes - 1]} ${anio}` };
}

async function fetchSnapshot(anio: number, mes: number, snapshotPreview?: string): Promise<{ html?: string, datos?: DatosGraficos, error?: string }> {
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

  const parsed = parseStoredResumenSnapshot<DatosGraficos>(raw);
  if (parsed.html && snapshotPreview === 'historical') return { html: parsed.html };
  if (parsed.html && snapshotPreview === 'v2') {
    const html = detectResumenSnapshotVersion(parsed.html) ? parsed.html : wrapResumenSnapshot(parsed.html);
    return { html };
  }
  if (parsed.datos) return { datos: parsed.datos, html: parsed.html };
  if (parsed.html) return { html: parsed.html };

  return { error: 'No hay una captura visual guardada para este reporte.' };
}

export default async function ResumenMensualPublico({ searchParams }: { searchParams: SearchParams }) {
  const { anio, mes, snapshotPreview } = parsePeriodo(await searchParams);
  const result = await fetchSnapshot(anio, mes, snapshotPreview);

  if ('error' in result) return <ErrorScreen message={result.error || 'Error desconocido'} />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.brand}>
            Sistema de Proyecciones y Ventas
          </div>
          <h1 className={styles.title}>
            Resumen Mensual — {MESES_NOMBRES[mes - 1]} {anio}
          </h1>
        </div>
      </header>

      <main className={styles.main}>
        {result.datos ? (
          <ResumenMensualInteractivo datos={result.datos} />
        ) : (
          <div
            className="legacy-snapshot"
            data-public-snapshot
            dangerouslySetInnerHTML={{ __html: result.html || '' }}
          />
        )}
      </main>
    </div>
  );
}

