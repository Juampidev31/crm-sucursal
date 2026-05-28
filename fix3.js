const fs = require('fs');
const files = [
  'src/app/ajustes/ResumenMensualTab.tsx',
  'src/app/publico/resumen-mensual/ResumenMensualInteractivo.tsx'
];

files.forEach(f => {
  let code = fs.readFileSync(f, 'utf8');
  // Remove duplicates
  code = code.replace(/borderWidth:\s*0,\s*borderRadius:\s*4,\s*maxBarThickness:\s*70,\s*borderRadius:\s*4/g, "borderWidth: 0, borderRadius: 4, maxBarThickness: 70");
  code = code.replace(/borderRadius:\s*4,\s*maxBarThickness:\s*70,\s*borderRadius:\s*4/g, "borderRadius: 4, maxBarThickness: 70");
  code = code.replace(/maxBarThickness:\s*70,\s*maxBarThickness:\s*100/g, "maxBarThickness: 70");
  code = code.replace(/borderWidth:\s*0,\s*borderRadius:\s*4,\s*maxBarThickness:\s*70\s*,/g, "borderWidth: 0, borderRadius: 4, maxBarThickness: 70,");
  fs.writeFileSync(f, code);
});
