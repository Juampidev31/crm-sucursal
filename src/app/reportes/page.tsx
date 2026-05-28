import React from 'react';
import Link from 'next/link';
import { CreditCard, ChevronRight, PieChart } from 'lucide-react';

export default function ReportesHubPage() {
  const reports = [
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
    <div className="dashboard-container" style={{ padding: '24px' }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {reports.map((report) => (
          <Link key={report.id} href={report.path} style={{ textDecoration: 'none' }}>
            <div className="report-card data-card" style={{ 
              padding: '32px', 
              background: '#0c0c0c', 
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '12px', 
                  background: 'rgba(16, 185, 129, 0.08)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '24px',
                  color: '#10b981'
                }}>
                  <report.icon size={24} />
                </div>
                
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>{report.title}</h2>
                <p style={{ color: '#9a9aa3', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>{report.desc}</p>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                paddingTop: '24px',
                borderTop: '1px solid rgba(255,255,255,0.06)'
              }}>
                <span style={{ fontSize: '12px', color: '#9a9aa3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{report.stats}</span>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  color: '#10b981', 
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
        borderRadius: '16px', 
        border: '1px dashed rgba(255,255,255,0.08)',
        textAlign: 'center'
      }}>
        <div style={{ color: '#9a9aa3', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <PieChart size={18} style={{ color: '#10b981' }} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Próximamente más reportes</span>
        </div>
        <p style={{ color: '#64748b', fontSize: '13px' }}>Estamos trabajando en nuevos indicadores de retención y análisis de cohorte.</p>
      </div>
    </div>
  );
}
