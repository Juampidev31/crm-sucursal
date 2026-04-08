'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AlertTriangle } from 'lucide-react';

const MESES_NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function ResumenMensualContent() {
  const searchParams = useSearchParams();
  const anio = parseInt(searchParams.get('anio') || '2026');
  const mes = parseInt(searchParams.get('mes') || '1');

  const [htmlSnapshot, setHtmlSnapshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('resumen_mensual')
        .select('experiencia_cliente')
        .eq('anio', anio)
        .eq('mes', mes)
        .maybeSingle();

      if (error) {
        setError(error.message);
      } else if (data?.experiencia_cliente && data.experiencia_cliente.length > 200) {
        setHtmlSnapshot(data.experiencia_cliente);
      } else {
        setError(`No se encontró el reporte para ${MESES_NOMBRES[mes - 1]} ${anio}. Primero generá el link desde Ajustes > Resumen Mensual.`);
      }

      setLoading(false);
    };

    fetchData();
  }, [anio, mes]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p style={{ color: '#666', fontSize: 14 }}>Cargando reporte...</p>
        </div>
      </div>
    );
  }

  if (error || !htmlSnapshot) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <AlertTriangle size={48} style={{ color: '#f87171', margin: '0 auto 16px' }} />
          <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>Reporte no disponible</h2>
          <p style={{ color: '#666', fontSize: 14 }}>{error || 'No se encontró el reporte para este período'}</p>
        </div>
      </div>
    );
  }

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
          dangerouslySetInnerHTML={{ __html: htmlSnapshot }}
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
        />
        <footer style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.03)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#444' }}>Generado el {new Date().toLocaleDateString('es-AR')} — Sistema de Proyecciones y Ventas</p>
        </footer>
      </main>
    </div>
  );
}

export default function ResumenMensualPublico() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    }>
      <ResumenMensualContent />
    </Suspense>
  );
}
