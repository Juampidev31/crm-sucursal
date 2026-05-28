const fs = require('fs');
let code = fs.readFileSync('src/app/ajustes/ResumenMensualTab.tsx', 'utf8');

// 1. Remove border widths for all datasets that have them to make it look like solid bars
code = code.replace(/borderWidth:\s*1\.5,/g, 'borderWidth: 0,');
code = code.replace(/borderWidth:\s*1,/g, 'borderWidth: 0,');

// 2. Adjust the gradients: currently they max out at 0.4. Let's change them to go to 0.85
// Top is the second color passed to getGradient.
code = code.replace(/getGradient\(context, '(.*?)', 'rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*0\.4\)'\)/g, (match, cStart, r, g, b) => {
  return `getGradient(context, 'rgba(${r}, ${g}, ${b}, 0.05)', 'rgba(${r}, ${g}, ${b}, 0.85)')`;
});

code = code.replace(/getGradient\(context, \\\`rgba\(\\\${r},\\\${g},\\\${b},0\.0\)\\\`, \\\`rgba\(\\\${r},\\\${g},\\\${b},0\.4\)\\\`\)/g, 
  `getGradient(context, \`rgba(\${r},\${g},\${b},0.05)\`, \`rgba(\${r},\${g},\${b},0.85)\`)`);

fs.writeFileSync('src/app/ajustes/ResumenMensualTab.tsx', code);
console.log('Colors replaced!');
