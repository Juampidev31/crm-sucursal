const fs = require('fs');
let code = fs.readFileSync('src/app/ajustes/ResumenMensualTab.tsx', 'utf8');

// 1. Make the 3 cards in the first row flex columns so they can stretch
// The cards have className="data-card" style={{ background: '#111111' }}
code = code.replace(/<div className="data-card" style=\{\{ background: '#111111' \}\}>/g, 
  '<div className="data-card" style={{ background: \'#111111\', display: \'flex\', flexDirection: \'column\' }}>');

// 2. Make the inner wrapper flex and flex: 1
code = code.replace(/<div style=\{\{ background: 'rgba\(255,255,255,0\.02\)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba\(255,255,255,0\.04\)' \}\}>/g,
  '<div style={{ background: \'rgba(255,255,255,0.02)\', borderRadius: 10, padding: \'16px 20px\', border: \'1px solid rgba(255,255,255,0.04)\', display: \'flex\', flexDirection: \'column\', flex: 1 }}>');

// 3. Make the chart section wrapper flex and flex: 1
code = code.replace(/<div style=\{\{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba\(255,255,255,0\.05\)' \}\}>/g,
  '<div style={{ marginTop: 24, paddingTop: 20, borderTop: \'1px solid rgba(255,255,255,0.05)\', display: \'flex\', flexDirection: \'column\', flex: 1 }}>');

// 4. Update the chart containers to flex: 1, minHeight: 180 (or 140)
code = code.replace(/<div id="chart-capital-objetivo" style=\{\{ height: 180 \}\}>/g,
  '<div id="chart-capital-objetivo" style={{ flex: 1, minHeight: 180, position: \'relative\' }}>');

code = code.replace(/<div id="chart-ticket-promedio" style=\{\{ height: 180 \}\}>/g,
  '<div id="chart-ticket-promedio" style={{ flex: 1, minHeight: 180, position: \'relative\' }}>');

code = code.replace(/<div id="chart-aperturas" style=\{\{ height: 140, position: 'relative', width: '100%' \}\}>/g,
  '<div id="chart-aperturas" style={{ flex: 1, minHeight: 140, position: \'relative\', width: \'100%\' }}>');

code = code.replace(/<div id="chart-renovaciones" style=\{\{ height: 140, position: 'relative', width: '100%' \}\}>/g,
  '<div id="chart-renovaciones" style={{ flex: 1, minHeight: 140, position: \'relative\', width: \'100%\' }}>');

fs.writeFileSync('src/app/ajustes/ResumenMensualTab.tsx', code);
console.log('Flex layout applied successfully!');
