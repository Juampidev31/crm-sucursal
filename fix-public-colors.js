const fs = require('fs');

function applyTo(file) {
  let code = fs.readFileSync(file, 'utf8');

  // getGradient
  if (!code.includes('const getGradient')) {
    code = code.replace(
      '// Helper: línea de referencia 100%',
      `// Helper: gradient
  const getGradient = (context: any, colorStart: string, colorEnd: string) => {
    const chart = context.chart;
    const { ctx, chartArea } = chart;
    if (!chartArea) return null;
    let horizontal = chart.config.options.indexAxis === 'y';
    const gradient = horizontal 
      ? ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
      : ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
  };

  // Helper: línea de referencia 100%`
    );
  }

  function replaceColor(regex, gradientStart, gradientEnd, newBorder) {
    code = code.replace(regex, (match) => {
      return `          backgroundColor: (context: any) => getGradient(context, '${gradientStart}', '${gradientEnd}'),
          borderColor: '${newBorder}',`;
    });
  }

  // Colors
  replaceColor(/backgroundColor:\s*'rgba\(96,\s*165,\s*250,\s*0\.15\)',\s*borderColor:\s*'rgba\(96,\s*165,\s*250,\s*0\.5\)',/g, 'rgba(16, 185, 129, 0.0)', 'rgba(16, 185, 129, 0.4)', '#10b981');
  replaceColor(/backgroundColor:\s*'rgba\(0,\s*255,\s*136,\s*0\.15\)',\s*borderColor:\s*'rgba\(16,\s*185,\s*129,\s*0\.5\)',/g, 'rgba(16, 185, 129, 0.0)', 'rgba(16, 185, 129, 0.4)', '#10b981');
  replaceColor(/backgroundColor:\s*'rgba\(167,\s*139,\s*250,\s*0\.15\)',\s*borderColor:\s*'rgba\(167,\s*139,\s*250,\s*0\.5\)',/g, 'rgba(6, 182, 212, 0.0)', 'rgba(6, 182, 212, 0.4)', '#06b6d4');
  replaceColor(/backgroundColor:\s*'rgba\(255,\s*170,\s*0,\s*0\.15\)',\s*borderColor:\s*'rgba\(59,\s*130,\s*246,\s*0\.5\)',/g, 'rgba(245, 158, 11, 0.0)', 'rgba(245, 158, 11, 0.4)', '#f59e0b');
  replaceColor(/backgroundColor:\s*'rgba\(255,\s*255,\s*255,\s*0\.0[35]\)',\s*borderColor:\s*'rgba\(255,\s*255,\s*255,\s*0\.[01][8]?\)',/g, 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.15)');

  // Var
  code = code.replace(
    /backgroundColor: capitalVar\.map\(v => v >= 0 \? 'rgba\(52,211,153,0\.15\)' : 'rgba\(248,113,113,0\.15\)'\),\s*borderColor: capitalVar\.map\(v => v >= 0 \? 'rgba\(16,185,129,0\.6\)' : 'rgba\(239,68,68,0\.6\)'\),/g,
    `backgroundColor: (context: any) => {
            const v = capitalVar[context.dataIndex] || 0;
            return getGradient(context, v >= 0 ? 'rgba(16, 185, 129, 0.0)' : 'rgba(244, 63, 94, 0.0)', v >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)');
          },
          borderColor: capitalVar.map(v => v >= 0 ? '#10b981' : '#f43f5e'),`
  );

  code = code.replace(
    /backgroundColor: opsVar\.map\(v => v >= 0 \? 'rgba\(167,139,250,0\.15\)' : 'rgba\(248,113,113,0\.15\)'\),\s*borderColor: opsVar\.map\(v => v >= 0 \? 'rgba\(139,92,246,0\.6\)' : 'rgba\(239,68,68,0\.6\)'\),/g,
    `backgroundColor: (context: any) => {
            const v = opsVar[context.dataIndex] || 0;
            return getGradient(context, v >= 0 ? 'rgba(6, 182, 212, 0.0)' : 'rgba(244, 63, 94, 0.0)', v >= 0 ? 'rgba(6, 182, 212, 0.4)' : 'rgba(244, 63, 94, 0.4)');
          },
          borderColor: opsVar.map(v => v >= 0 ? '#06b6d4' : '#f43f5e'),`
  );

  // Acuerdos
  code = code.replace(
    /const colores = \['rgba\(96, 165, 250, 0\.15\)', 'rgba\(167, 139, 250, 0\.15\)'\];\s*const borderColores = \['rgba\(96, 165, 250, 0\.5\)', 'rgba\(167, 139, 250, 0\.5\)'\];/g,
    `const colores = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899'];
    const borderColores = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899'];`
  );
  code = code.replace(
    /backgroundColor: colores\[idx\] \|\| 'rgba\(255,255,255,0\.05\)',\s*borderColor: borderColores\[idx\] \|\| 'rgba\(255,255,255,0\.2\)',/g,
    `backgroundColor: (context: any) => {
          const hex = colores[idx] || '#ffffff';
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
          return getGradient(context, \`rgba(\${r},\${g},\${b},0.0)\`, \`rgba(\${r},\${g},\${b},0.4)\`);
        },
        borderColor: borderColores[idx] || 'rgba(255,255,255,0.2)',`
  );

  // Cats
  code = code.replace(
    /backgroundColor: \`\$\{color\}26\`,\s*borderColor: \`\$\{color\}80\`,/g,
    `backgroundColor: (context: any) => {
            const hex = color || '#ffffff';
            let r=255,g=255,b=255;
            if (hex.startsWith('#') && hex.length === 7) {
              r = parseInt(hex.slice(1,3),16); g = parseInt(hex.slice(3,5),16); b = parseInt(hex.slice(5,7),16);
            }
            return getGradient(context, \`rgba(\${r},\${g},\${b},0.0)\`, \`rgba(\${r},\${g},\${b},0.4)\`);
          },
          borderColor: color,`
  );

  replaceColor(/backgroundColor: 'rgba\(251, 191, 36, 0\.15\)',\s*borderColor: 'rgba\(251, 191, 36, 0\.5\)',/g, 'rgba(139, 92, 246, 0.0)', 'rgba(139, 92, 246, 0.4)', '#8b5cf6');

  // Fix borders and layout
  code = code.replace(/borderWidth: 1\s*/g, 'borderWidth: 0 ');
  code = code.replace(/grid: \{ color: 'rgba\(255,255,255,0\.03\)' \}/g, "grid: { display: false }, border: { display: false }");

  // Fix flex layout
  code = code.replace(
    /<div style=\{\{ width: '100%', maxWidth: 400, margin: '0 auto', flex: 1, minHeight: 0 \}\}>\s*<Pie/g,
    `<div style={{ width: '100%', maxWidth: 400, margin: '0 auto', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Pie`
  );

  code = code.replace(
    /<div style=\{\{ flex: 1, minHeight: 0 \}\}>\s*<Bar/g,
    `<div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <Bar`
  );

  code = code.replace(
    /<div style=\{\{ flex: 1, minHeight: 0 \}\}>\s*<Line/g,
    `<div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <Line`
  );

  fs.writeFileSync(file, code);
}

applyTo('src/app/publico/resumen-mensual/ResumenMensualInteractivo.tsx');
console.log('Public resume updated');
