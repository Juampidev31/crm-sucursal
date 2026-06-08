const fs = require('fs');
const files = [
  'src/app/analistas/page.tsx',
  'src/app/analistas/NuevaSeccionSheets.tsx'
];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, content.replace(/titleAlign:\s*'center'/g, "titleAlign: 'center' as const"));
});
console.log("Fixed!");
