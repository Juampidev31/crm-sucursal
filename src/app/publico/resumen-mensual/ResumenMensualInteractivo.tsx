'use client';

import React, { useState, useMemo } from 'react';
import ResumenMensualView from '../../ajustes/ResumenMensualView';

interface DatosGraficos {
  kpiTotal: any;
  kpiPorAnalista: any[];
  mesActual: string;
  mesAnterior: string;
  year: number;
  month: number;
  experienciaCliente?: string;
  analisisComercial?: string;
  operacionProcesos?: string;
  gestionesRealizadas?: string;
  coordinacionSalidas?: string;
  empresasEstrategicas?: string;
  logros?: string;
  desvios?: string;
  accionesClave?: string;
  dotacion?: string;
  ausentismo?: string;
  capacitacion?: string;
  evaluacionDesempeno?: string;
  planAcciones?: Array<{ problema: string; accion: string; responsable: string; fecha: string }>;
  auditCounts?: Record<string, number>;
  collapsedSections?: Record<number, boolean>;
  registros?: any[];
  chartCapitalVsObjetivo?: any;
  chartTicketPromedio?: any;
  chartVariacion?: any;
  chartEmbudo?: any;
  chartAperturas?: any;
  chartRenovaciones?: any;
  chartEmpleoPublPriv?: any;
  chartConversionTotal?: any;
  chartConversionPresupuesto?: any;
  chartCumplimiento?: any;
  chartAcuerdos?: any;
  distSexo?: Array<{ label: string; monto: number; cantidad: number }>;
  distCuotas?: Array<{ label: string; monto: number; cantidad: number }>;
  distRangoEtario?: Array<{ label: string; monto: number; cantidad: number }>;
  distLocalidad?: Array<{ label: string; monto: number; cantidad: number }>;
  distEmpleador?: Array<{ label: string; monto: number; cantidad: number }>;
  distAcuerdos?: Array<{ label: string; monto: number; cantidad: number }>;
  distEstados?: Array<{ label: string; monto: number; cantidad: number }>;
  distSexoTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distCuotasTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distRangoEtarioTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distLocalidadTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distEmpleadorTotal?: Array<{ label: string; monto: number; cantidad: number }>;
  distAcuerdosTotal?: Array<{ label: string; monto: number; cantidad: number }>;
}

const addGradients = (chart: any) => {
  if (!chart || !chart.datasets) return chart;
  return {
    ...chart,
    datasets: chart.datasets.map((ds: any) => {
      if (ds.type === 'line') return ds;
      const color = ds.borderColor || ds.backgroundColor;
      if (!color || typeof color !== 'string') return ds;

      return {
        ...ds,
        maxBarThickness: 45,
        backgroundColor: (context: any) => {
          const chartObj = context.chart;
          const { ctx, chartArea } = chartObj;
          if (!chartArea) return null;
          let horizontal = chartObj.config?.options?.indexAxis === 'y';
          const gradient = horizontal 
            ? ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
            : ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          
          let r=255,g=255,b=255;
          if (color.startsWith('#') && color.length === 7) {
            r = parseInt(color.slice(1,3),16); g = parseInt(color.slice(3,5),16); b = parseInt(color.slice(5,7),16);
          } else if (color.startsWith('rgba(')) {
            const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (m) { r=parseInt(m[1] as string); g=parseInt(m[2] as string); b=parseInt(m[3] as string); }
          }
          if (color === 'rgba(255, 255, 255, 0.15)' || (r===255 && g===255 && b===255 && color.includes('0.15'))) {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
          } else {
            gradient.addColorStop(0, `rgba(${r},${g},${b},0.05)`);
            gradient.addColorStop(1, `rgba(${r},${g},${b},0.85)`);
          }
          return gradient;
        }
      };
    })
  };
};

export default function ResumenMensualInteractivo({ datos }: { datos: DatosGraficos }) {
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>(datos.collapsedSections || { 10: true });
  const toggleSection = (id: number) => setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  
  const [periodoSec3, setPeriodoSec3] = useState<'mensual' | 'total'>('mensual');
  const [resumen, setResumen] = useState<any>({
    logros: datos.logros || '',
    desvios: datos.desvios || '',
    acciones_clave: datos.accionesClave || '',
    gestiones_realizadas: datos.gestionesRealizadas || '',
    coordinacion_salidas: datos.coordinacionSalidas || '',
    empresas_estrategicas: datos.empresasEstrategicas || '',
    analisis_comercial: datos.analisisComercial || '',
    dotacion: datos.dotacion || '',
    ausentismo: datos.ausentismo || '',
    capacitacion: datos.capacitacion || '',
    evaluacion_desempeno: datos.evaluacionDesempeno || '',
    operacion_procesos: datos.operacionProcesos || '',
    experiencia_cliente: datos.experienciaCliente || '',
    plan_acciones: datos.planAcciones || [],
  });

  const auditoriaData = useMemo(() => {
    if (!datos.auditCounts) return [];
    return Object.entries(datos.auditCounts).flatMap(([analista, count]) => {
      return Array(count).fill({ analista });
    });
  }, [datos.auditCounts]);

  const ventasMes = useMemo(() => {
    return (datos.registros || []).filter(r => {
      const e = (r.estado || '').toLowerCase();
      return e === 'venta' || e.includes('aprobado cc');
    });
  }, [datos.registros]);

  const chartCapitalVsObjetivo = useMemo(() => addGradients(datos.chartCapitalVsObjetivo), [datos.chartCapitalVsObjetivo]);
  const chartAperturas = useMemo(() => addGradients(datos.chartAperturas), [datos.chartAperturas]);
  const chartRenovaciones = useMemo(() => addGradients(datos.chartRenovaciones), [datos.chartRenovaciones]);
  const chartTicketPromedio = useMemo(() => addGradients(datos.chartTicketPromedio), [datos.chartTicketPromedio]);

  return (
    <ResumenMensualView
      readOnly={true}
      selectedMes={datos.month}
      selectedAnio={datos.year}
      mesPrev={datos.month === 1 ? 12 : datos.month - 1}
      mesAntLabel={datos.mesAnterior}
      collapsedSections={collapsedSections}
      toggleSection={toggleSection}
      kpiTotal={datos.kpiTotal}
      chartCapitalVsObjetivo={chartCapitalVsObjetivo}
      chartAperturas={chartAperturas}
      chartRenovaciones={chartRenovaciones}
      chartTicketPromedio={chartTicketPromedio}
      registros={datos.registros || []}
      ventasMes={ventasMes}
      auditoriaData={auditoriaData}
      periodoSec3={periodoSec3}
      setPeriodoSec3={setPeriodoSec3}
      distAcuerdos={datos.distAcuerdos || []}
      distAcuerdosTotal={datos.distAcuerdosTotal || []}
      distCuotas={datos.distCuotas || []}
      distCuotasTotal={datos.distCuotasTotal || []}
      distRangoEtario={datos.distRangoEtario || []}
      distRangoEtarioTotal={datos.distRangoEtarioTotal || []}
      distSexo={datos.distSexo || []}
      distSexoTotal={datos.distSexoTotal || []}
      distEmpleador={datos.distEmpleador || []}
      distEmpleadorTotal={datos.distEmpleadorTotal || []}
      distLocalidad={datos.distLocalidad || []}
      distLocalidadTotal={datos.distLocalidadTotal || []}
      resumen={resumen}
      setResumen={setResumen}
    />
  );
}
