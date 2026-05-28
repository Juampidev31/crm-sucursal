const fs = require('fs');

const fixPublicCharts = () => {
  const filePath = 'src/app/publico/resumen-mensual/ResumenMensualInteractivo.tsx';
  let code = fs.readFileSync(filePath, 'utf8');

  if (!code.includes('const addGradients =')) {
    const helperCode = `
  const addGradients = (chart: any) => {
    if (!chart || !chart.datasets) return chart;
    return {
      ...chart,
      datasets: chart.datasets.map((ds: any) => {
        if (ds.type === 'line') return ds; // line chart uses transparent or specific gradient
        const color = ds.borderColor || ds.backgroundColor;
        if (!color || typeof color !== 'string') return ds;

        return {
          ...ds,
          backgroundColor: (context: any) => {
            const chartObj = context.chart;
            const { ctx, chartArea } = chartObj;
            if (!chartArea) return null;
            let horizontal = chartObj.config.options.indexAxis === 'y';
            const gradient = horizontal 
              ? ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
              : ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            
            let r=255,g=255,b=255;
            if (color.startsWith('#') && color.length === 7) {
              r = parseInt(color.slice(1,3),16); g = parseInt(color.slice(3,5),16); b = parseInt(color.slice(5,7),16);
            } else if (color.startsWith('rgba(')) {
              const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
              if (m) { r=parseInt(m[1]); g=parseInt(m[2]); b=parseInt(m[3]); }
            }
            if (color === 'rgba(255, 255, 255, 0.15)' || (r===255 && g===255 && b===255 && color.includes('0.15'))) {
              gradient.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
              gradient.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
            } else {
              gradient.addColorStop(0, \`rgba(\${r},\${g},\${b},0.05)\`);
              gradient.addColorStop(1, \`rgba(\${r},\${g},\${b},0.85)\`);
            }
            return gradient;
          }
        };
      })
    };
  };

`;

    // Inject before `const [collapsed`
    code = code.replace(/const \[collapsed/g, helperCode + '  const [collapsed');

    // Replace usages
    code = code.replace(/chartCapitalVsObjetivo/g, 'addGradients(chartCapitalVsObjetivo)');
    code = code.replace(/chartTicketPromedio/g, 'addGradients(chartTicketPromedio)');
    code = code.replace(/chartVariacion/g, 'addGradients(chartVariacion)');
    code = code.replace(/chartCumplimiento/g, 'addGradients(chartCumplimiento)');
    code = code.replace(/chartEmbudo/g, 'addGradients(chartEmbudo)');
    code = code.replace(/chartAperturas/g, 'addGradients(chartAperturas)');
    code = code.replace(/chartRenovaciones/g, 'addGradients(chartRenovaciones)');
    code = code.replace(/chartConversionTotal/g, 'addGradients(chartConversionTotal)');
    code = code.replace(/chartConversionPresupuesto/g, 'addGradients(chartConversionPresupuesto)');
    code = code.replace(/chartEmpleoPublPriv/g, 'addGradients(chartEmpleoPublPriv)');
    code = code.replace(/chartAcuerdos/g, 'addGradients(chartAcuerdos)');
    
    // Fix destructured assignments which we just ruined
    code = code.replace(/addGradients\(chartCapitalVsObjetivo\),/g, 'chartCapitalVsObjetivo,');
    code = code.replace(/addGradients\(chartTicketPromedio\),/g, 'chartTicketPromedio,');
    code = code.replace(/addGradients\(chartVariacion\),/g, 'chartVariacion,');
    code = code.replace(/addGradients\(chartCumplimiento\),/g, 'chartCumplimiento,');
    code = code.replace(/addGradients\(chartEmbudo\),/g, 'chartEmbudo,');
    code = code.replace(/addGradients\(chartAperturas\),/g, 'chartAperturas,');
    code = code.replace(/addGradients\(chartRenovaciones\),/g, 'chartRenovaciones,');
    code = code.replace(/addGradients\(chartConversionTotal\),/g, 'chartConversionTotal,');
    code = code.replace(/addGradients\(chartConversionPresupuesto\),/g, 'chartConversionPresupuesto,');
    code = code.replace(/addGradients\(chartEmpleoPublPriv\),/g, 'chartEmpleoPublPriv,');
    code = code.replace(/addGradients\(chartAcuerdos\),/g, 'chartAcuerdos,');

    fs.writeFileSync(filePath, code);
  }
};

fixPublicCharts();
console.log('Fixed public charts missing gradients');
