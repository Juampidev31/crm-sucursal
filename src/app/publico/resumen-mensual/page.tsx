'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BarChart3, Users, TrendingUp, Activity, Shield, Target, FileText, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

interface ResumenMensual {
  logros: string;
  desvios: string;
  acciones_clave: string;
  principales_logros: string;
  principales_desvios: string;
  acciones_clave_a_seguir: string;
  gestiones_realizadas: string;
  coordinacion_salidas: string;
  empresas_estrategicas: string;
  analisis_comercial: string;
  dotacion: string;
  ausentismo: string;
  capacitacion: string;
  evaluacion_desempeno: string;
  operacion_procesos: string;
  experiencia_cliente: string;
  plan_acciones: any[];
  gestiones_por_analista: Record<string, number>;
  presupuestos_por_analista: Record<string, number>;
}

const MESES_NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ANALISTAS_DEFAULT = ['Luciana', 'Victoria'];

export default function ResumenMensualPublico() {
  const searchParams = useSearchParams();
  const anio = parseInt(searchParams.get('anio') || '2026');
  const mes = parseInt(searchParams.get('mes') || '1');
  
  const [resumen, setResumen] = useState<ResumenMensual | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('resumen_mensual')
        .select('*')
        .eq('anio', anio)
        .eq('mes', mes)
        .maybeSingle();
      
      if (error) {
        setError(error.message);
      } else if (data) {
        setResumen(data as ResumenMensual);
      } else {
        setError('No se encontró el reporte para este período');
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

  if (error || !resumen) {
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

  const sectionHeader = (title: string, icon: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {icon}
      <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>{title}</span>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      {/* Header */}
      <header style={{
        padding: '24px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                Sistema de Proyecciones y Ventas
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>
                Resumen Mensual — {MESES_NOMBRES[mes - 1]} {anio}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
        {/* Tablero KPIs */}
        <div className="data-card" style={{ background: '#0a0a0a', marginBottom: 24 }}>
          {sectionHeader('Tablero', <BarChart3 size={16} color="#60a5fa" />)}
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Gestiones por analista */}
            {ANALISTAS_DEFAULT.map(analista => (
              <div key={analista} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#aaa', marginBottom: 12 }}>{analista}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Gestiones</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{resumen.gestiones_por_analista[analista] || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Presupuestos</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{resumen.presupuestos_por_analista[analista] || 0}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Logros, Desvíos, Acciones Clave */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <div style={{ background: 'rgba(52,211,153,0.05)', borderRadius: 8, padding: 16, border: '1px solid rgba(52,211,153,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle size={14} color="#34d399" />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>Principales Logros</span>
              </div>
              <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{resumen.principales_logros || '—'}</p>
            </div>
            
            <div style={{ background: 'rgba(248,113,113,0.05)', borderRadius: 8, padding: 16, border: '1px solid rgba(248,113,113,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={14} color="#f87171" />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#f87171', textTransform: 'uppercase' }}>Desvíos / Problemas</span>
              </div>
              <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{resumen.principales_desvios || '—'}</p>
            </div>
            
            <div style={{ background: 'rgba(251,191,36,0.05)', borderRadius: 8, padding: 16, border: '1px solid rgba(251,191,36,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Target size={14} color="#fbbf24" />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>Acciones Clave</span>
              </div>
              <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{resumen.acciones_clave_a_seguir || '—'}</p>
            </div>
          </div>
        </div>

        {/* Gestión del Equipo */}
        {resumen.dotacion && (
          <div className="data-card" style={{ background: '#0a0a0a', marginBottom: 24 }}>
            {sectionHeader('Gestión del Equipo', <Activity size={15} color="#fbbf24" />)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
              {resumen.dotacion && <div><strong style={{ color: '#666', fontSize: 11, textTransform: 'uppercase' }}>Dotación:</strong><p style={{ color: '#ccc', marginTop: 4, whiteSpace: 'pre-wrap' }}>{resumen.dotacion}</p></div>}
              {resumen.ausentismo && <div><strong style={{ color: '#666', fontSize: 11, textTransform: 'uppercase' }}>Ausentismo:</strong><p style={{ color: '#ccc', marginTop: 4, whiteSpace: 'pre-wrap' }}>{resumen.ausentismo}</p></div>}
              {resumen.capacitacion && <div><strong style={{ color: '#666', fontSize: 11, textTransform: 'uppercase' }}>Capacitación:</strong><p style={{ color: '#ccc', marginTop: 4, whiteSpace: 'pre-wrap' }}>{resumen.capacitacion}</p></div>}
              {resumen.evaluacion_desempeno && <div><strong style={{ color: '#666', fontSize: 11, textTransform: 'uppercase' }}>Evaluación:</strong><p style={{ color: '#ccc', marginTop: 4, whiteSpace: 'pre-wrap' }}>{resumen.evaluacion_desempeno}</p></div>}
            </div>
          </div>
        )}

        {/* Plan de Acción */}
        {resumen.plan_acciones && resumen.plan_acciones.length > 0 && (
          <div className="data-card" style={{ background: '#0a0a0a', marginBottom: 24 }}>
            {sectionHeader('Plan de Acción', <Target size={15} color="#fb923c" />)}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Problema', 'Acción', 'Responsable', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#555', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.plan_acciones.map((fila, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 12px', color: '#ccc' }}>{fila.problema || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#ccc' }}>{fila.accion || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#ccc' }}>{fila.responsable || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#888' }}>{fila.fecha || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <footer style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.03)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#444' }}>Generado el {new Date().toLocaleDateString('es-AR')} — Sistema de Proyecciones y Ventas</p>
        </footer>
      </main>
    </div>
  );
}
