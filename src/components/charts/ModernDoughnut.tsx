'use client';

import React, { memo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, type ChartData, type ChartOptions, type TooltipItem } from 'chart.js';
import { calloutPlugin, bgTrackPlugin, glowPlugin } from '@/lib/chartPlugins';
import { UI_FONT_FAMILY } from '@/app/fonts';

// Auto-registro: el componente es autosuficiente, no depende de que el padre registre ArcElement.
ChartJS.register(ArcElement, Tooltip, Legend);

interface ModernDoughnutProps {
  data: ChartData<'doughnut'>;
  /** Etiqueta chica del centro (se muestra en uppercase) */
  label: string;
  /** Valor grande del centro, ya formateado por el caller */
  value: React.ReactNode;
  /** Texto del tooltip por ítem; default: solo el valor crudo */
  tooltipLabel?: (ctx: TooltipItem<'doughnut'>) => string;
  padding?: number;
  clip?: false | number;
  height?: string;
  width?: string;
  margin?: string;
  labelSize?: number;
  valueSize?: number;
}

type ModernDoughnutStyle = React.CSSProperties & {
  '--modern-doughnut-height': string;
  '--modern-doughnut-width': string;
  '--modern-doughnut-margin': string;
  '--modern-doughnut-label-size': string;
  '--modern-doughnut-value-size': string;
};

// Unificación de las 4 copias divergentes (refactor cross-file de charts, fase 2):
// analistas (padding 36, 220×220, fuentes 8/15), SeccionGraficosResumen (30, 100%),
// MetricasTab (70, 280×280, clip false) y NuevaSeccionSheets (60, 250px).
const ModernDoughnut = memo(function ModernDoughnut({
  data, label, value,
  tooltipLabel = (ctx) => ` ${ctx.raw}`,
  padding = 60, clip,
  height = '100%', width = '100%', margin = '0 auto',
  labelSize = 10, valueSize = 18,
}: ModernDoughnutProps) {
  const options: ChartOptions<'doughnut'> = {
    ...(clip !== undefined ? { clip } : {}),
    layout: { padding },
    cutout: '88%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#ffffff',
        titleFont: { size: 18, weight: 700, family: UI_FONT_FAMILY },
        titleAlign: 'center' as const,
        titleMarginBottom: 16,
        bodyColor: '#f1f5f9',
        bodyFont: { size: 15, weight: 600, family: UI_FONT_FAMILY },
        bodySpacing: 10,
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 2,
        padding: 24,
        cornerRadius: 16,
        boxPadding: 8,
        usePointStyle: true,
        callbacks: { label: tooltipLabel },
      },
    },
    maintainAspectRatio: false,
    elements: {
      arc: {
        borderWidth: 0,
        borderRadius: 30,
      },
    },
  };

  return (
    <div
      className="modern-doughnut"
      style={{
        '--modern-doughnut-height': height,
        '--modern-doughnut-width': width,
        '--modern-doughnut-margin': margin,
        '--modern-doughnut-label-size': `${labelSize}px`,
        '--modern-doughnut-value-size': `${valueSize}px`,
      } as ModernDoughnutStyle}
    >
      <Doughnut data={data} options={options} plugins={[calloutPlugin, bgTrackPlugin, glowPlugin]} />
      <div className="modern-doughnut__center">
        <div className="modern-doughnut__label">{label}</div>
        <div className="modern-doughnut__value">
          {value}
        </div>
      </div>
    </div>
  );
});

export default ModernDoughnut;
