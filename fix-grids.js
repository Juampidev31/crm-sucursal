const fs = require('fs');

function applyTo(file) {
  let code = fs.readFileSync(file, 'utf8');

  // Replace any visible grid line setting with display: false
  code = code.replace(/grid:\s*\{\s*color:\s*'rgba\(255,255,255,0\.04\)'\s*\}/g, "grid: { display: false }, border: { display: false }");
  code = code.replace(/grid:\s*\{\s*color:\s*'rgba\(255,255,255,0\.03\)'\s*\}/g, "grid: { display: false }, border: { display: false }");
  code = code.replace(/grid:\s*\{\s*color:\s*'rgba\(255,255,255,0\.025\)'\s*\}/g, "grid: { display: false }, border: { display: false }");
  
  fs.writeFileSync(file, code);
}

applyTo('src/app/ajustes/ResumenMensualTab.tsx');
applyTo('src/app/publico/resumen-mensual/ResumenMensualInteractivo.tsx');
console.log('Fixed grids in both files');
