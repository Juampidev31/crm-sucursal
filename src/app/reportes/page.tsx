'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, CreditCard, ChevronRight, BarChart3, PieChart } from 'lucide-react';

export default function ReportesHubPage() {
  const reports = [
    {
      id: 'ventas',
      title: 'Reporte de Ventas',
      desc: 'Análisis detallado de operaciones cerradas, ticket promedio y desempeño por analista.',
      icon: TrendingUp,
      path: '/reportes/ventas',
      stats: 'Actualizado hoy'
    },
    {
      id: 'cobranzas',
      title: 'Reporte de Cobranzas',
      desc: 'Seguimiento de morosidad, tramos de cobro y cumplimiento de objetivos de recupero.',
      icon: CreditCard,
      path: '/reportes/cobranzas',
      stats: 'Actualizado hoy'
    }
  ];

  return (
    <div className="dashboard-container">
      <header className="dashboard-header" style={{ marginBottom: '48px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gris)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
            <BarChart3 size={14} /> Inteligencia de Negocio
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#fff' }}>Centro de Reportes</h1>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {reports.map((report) => (
          <Link key={report.id} href={report.path} style={{ textDecoration: 'none' }}>
            <div className="data-card" style={{ 
              padding: '32px', 
              background: '#0a0a0a', 
              border: '1px solid rgba(255,255,255,0.03)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            >
              <div>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '12px', 
                  background: 'rgba(255,255,255,0.03)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '24px',
                  color: '#888'
                }}>
                  <report.icon size={24} />
                </div>
                
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>{report.title}</h2>
                <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>{report.desc}</p>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                paddingTop: '24px',
                borderTop: '1px solid rgba(255,255,255,0.03)'
              }}>
                <span style={{ fontSize: '12px', color: '#333', fontWeight: 600, textTransform: 'uppercase' }}>{report.stats}</span>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  color: '#fff', 
                  fontSize: '14px', 
                  fontWeight: 700 
                }}>
                  Ver Informe <ChevronRight size={16} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ 
        marginTop: '64px', 
        padding: '32px', 
        background: 'rgba(255,255,255,0.01)', 
        borderRadius: '24px', 
        border: '1px dashed rgba(255,255,255,0.05)',
        textAlign: 'center'
      }}>
        <div style={{ color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <PieChart size={18} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Próximamente más reportes</span>
        </div>
        <p style={{ color: '#222', fontSize: '13px' }}>Estamos trabajando en nuevos indicadores de retención y análisis de cohorte.</p>
      </div>
    </div>
  );
}
