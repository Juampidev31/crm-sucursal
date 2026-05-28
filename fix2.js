const fs = require('fs');
let c = fs.readFileSync('src/app/publico/resumen-mensual/ResumenMensualInteractivo.tsx', 'utf8');
c = c.replace(/addGradients\((chart[A-Za-z0-9]+)\)\?: any;/g, '$1?: any;');
fs.writeFileSync('src/app/publico/resumen-mensual/ResumenMensualInteractivo.tsx', c);
