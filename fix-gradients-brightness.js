const fs = require('fs');

function applyTo(file) {
  let code = fs.readFileSync(file, 'utf8');

  // Make gradients brighter!
  code = code.replace(/0\.0\)',\s*'rgba\(([^,]+),\s*([^,]+),\s*([^,]+),\s*0\.4\)'/g, "0.05)', 'rgba($1, $2, $3, 0.85)'");
  code = code.replace(/0\.0\)`,\s*`rgba\(\$\{r\},\$\{g\},\$\{b\},0\.4\)`/g, "0.05)`, `rgba(${r},${g},${b},0.85)`");
  code = code.replace(/'rgba\(255, 255, 255, 0\.0\)',\s*'rgba\(255, 255, 255, 0\.08\)'/g, "'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.15)'");
  
  // Also fix the grid if it was still present in other places
  code = code.replace(/grid:\s*\{\s*color:\s*'rgba\(255,255,255,0\.04\)'\s*\}/g, "grid: { display: false }");
  code = code.replace(/borderWidth:\s*0/g, "borderWidth: 0, borderRadius: 4, maxBarThickness: 70"); // ensure they have rounded top corners and are not too thick

  fs.writeFileSync(file, code);
}

applyTo('src/app/ajustes/ResumenMensualTab.tsx');
applyTo('src/app/publico/resumen-mensual/ResumenMensualInteractivo.tsx');
console.log('Fixed gradient brightness');
