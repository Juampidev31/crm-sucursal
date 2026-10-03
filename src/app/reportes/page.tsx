'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, CreditCard, ChevronRight, UsersRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './ReportesPage.module.css';

export default function ReportesHubPage() {
  const { isAdmin } = useAuth();
  const reports = [
    {
      id: 'analistas',
      title: 'Rendimiento de Analistas',
      desc: 'Histórico, objetivos, comparativas, resumen mensual y calificación por score.',
      icon: UsersRound,
      path: '/analistas?analista=PDV',
      stats: 'Panel comercial',
      accent: 'blue',
    },
    {
      id: 'cobranzas',
      title: 'Reporte de Cobranzas',
      desc: 'Seguimiento de morosidad, tramos de cobro y cumplimiento de objetivos de recupero.',
      icon: CreditCard,
      path: '/reportes/cobranzas',
      stats: 'Actualizado hoy',
      accent: 'green',
    },
    ...(isAdmin ? [{
      id: 'gestion-diaria',
      title: 'Gestión Diaria Mensual',
      desc: 'Métricas y cantidades por tipo de cliente, actividad, estado y rangos de score.',
      icon: BarChart3,
      path: '/reportes/gestion-diaria',
      stats: 'Solo administración',
      accent: 'slate',
    }] : []),
  ];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Reportes</h1>
        <p className={styles.pageDescription}>Indicadores y análisis consolidados para el seguimiento comercial.</p>
      </header>

      <div className={styles.grid}>
        {reports.map((report) => (
          <Link className={styles.reportLink} key={report.id} href={report.path}>
            <article className={styles.reportCard} data-accent={report.accent}>
              <div>
                <div className={styles.reportIcon}>
                  <report.icon size={24} />
                </div>

                <h2 className={styles.reportTitle}>{report.title}</h2>
                <p className={styles.reportDescription}>{report.desc}</p>
              </div>

              <footer className={styles.reportFooter}>
                <span className={styles.reportStats}>{report.stats}</span>
                <div className={styles.reportAction}>
                  Ver Informe <ChevronRight size={16} />
                </div>
              </footer>
            </article>
          </Link>
        ))}
      </div>

    </div>
  );
}
