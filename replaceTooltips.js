const fs = require('fs');

const filesToUpdate = [
  'src/app/ajustes/ResumenMensualView.tsx',
  'src/app/ajustes/SeccionGraficosResumen.tsx',
  'src/app/ajustes/ResumenMensualTab.tsx',
  'src/app/publico/resumen-mensual/ResumenHTML.tsx',
  'src/app/ajustes/MetricasTab.tsx'
];

const newBarTooltip = `tooltip: {
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#ffffff',
        titleFont: { size: 18, weight: 900, family: "'Outfit', sans-serif" },
        titleAlign: 'center' as const,
        titleMarginBottom: 16,
        bodyColor: '#f1f5f9',
        bodyFont: { size: 15, weight: 600, family: "'Outfit', sans-serif" },
        bodySpacing: 10,
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 2,
        padding: 24,
        cornerRadius: 16,
        boxPadding: 8,
        usePointStyle: true,
      },`;

const newDoughnutTooltip = `tooltip: {
        backgroundColor: 'rgba(10, 10, 15, 0.95)',
        titleColor: '#ffffff',
        titleFont: { size: 18, weight: 900, family: "'Outfit', sans-serif" },
        titleAlign: 'center' as const,
        titleMarginBottom: 16,
        bodyColor: '#f1f5f9',
        bodyFont: { size: 15, weight: 600, family: "'Outfit', sans-serif" },
        bodySpacing: 10,
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 2,
        padding: 24,
        cornerRadius: 16,
        boxPadding: 8,
        usePointStyle: true,
        callbacks: {
          label: (context: any) => {
            return \` \${context.raw}\`;
          }
        }
      }`;

filesToUpdate.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`Skipping \${file}, does not exist.`);
    return;
  }
  
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace single line bar chart tooltip
  const barTooltipRegex = /tooltip:\s*{\s*backgroundColor:\s*'#0c0c0c',\s*titleColor:\s*'#fff',\s*bodyColor:\s*'#aaa',\s*borderColor:\s*'rgba\(255,255,255,0\.06\)',\s*borderWidth:\s*1\s*},?/g;
  if (barTooltipRegex.test(content)) {
    content = content.replace(barTooltipRegex, newBarTooltip);
    changed = true;
  }

  // Replace multiline doughnut tooltip
  // We'll use a regex that captures the basic block
  const doughnutTooltipRegex = /tooltip:\s*{\s*backgroundColor:\s*'#0c0c0c',\s*titleColor:\s*'#fff',\s*bodyColor:\s*'#ccc',\s*borderColor:\s*'rgba\(255,255,255,0\.1\)',\s*borderWidth:\s*1,\s*padding:\s*12,\s*cornerRadius:\s*8,\s*callbacks:\s*{\s*label:\s*\(ctx:\s*any\)\s*=>\s*` \${ctx.label}:\s*\${ctx.raw}\s*ops`\s*}\s*}/g;
  const doughnutTooltipRegex2 = /tooltip:\s*{\s*backgroundColor:\s*'#0c0c0c',\s*titleColor:\s*'#fff',\s*bodyColor:\s*'#ccc',\s*borderColor:\s*'rgba\(255,255,255,0\.1\)',\s*borderWidth:\s*1,\s*padding:\s*12,\s*cornerRadius:\s*8,\s*callbacks:\s*{\s*label:\s*\(context:\s*any\)\s*=>\s*{\s*return\s*`\${context.raw}`;?\s*}\s*}\s*}/g;
  
  // Also catch variations in MetricasTab
  const doughnutTooltipRegex3 = /tooltip:\s*{\s*backgroundColor:\s*'#111',\s*titleColor:\s*'#fff',\s*bodyColor:\s*'#ccc',\s*borderColor:\s*'rgba\(255,255,255,0\.1\)',\s*borderWidth:\s*1,\s*padding:\s*12,\s*cornerRadius:\s*8,\s*callbacks:\s*{\s*label:\s*\(ctx:\s*any\)\s*=>\s*` \${ctx.label}:\s*\\$\${ctx.raw}`\s*}\s*}/g;

  if (doughnutTooltipRegex.test(content) || doughnutTooltipRegex2.test(content) || doughnutTooltipRegex3.test(content)) {
    content = content.replace(doughnutTooltipRegex, newDoughnutTooltip);
    content = content.replace(doughnutTooltipRegex2, newDoughnutTooltip);
    content = content.replace(doughnutTooltipRegex3, newDoughnutTooltip);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated tooltips in \${file}`);
  } else {
    console.log(`No tooltips to update in \${file}`);
  }
});
