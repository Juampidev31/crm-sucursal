const fs = require('fs');
let code = fs.readFileSync('src/app/ajustes/ResumenMensualTab.tsx', 'utf8');

// Also remove the grid line for the X-axis to make it look exactly like Analistas
code = code.replace(/grid: \{ color: 'rgba\(255,255,255,0\.03\)' \}/g, "grid: { display: false }, border: { display: false }");

fs.writeFileSync('src/app/ajustes/ResumenMensualTab.tsx', code);
console.log('X-axis grid removed');
