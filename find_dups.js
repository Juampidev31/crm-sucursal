const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ebgoneklmycwxwygkaew.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViZ29uZWtsbXljd3h3eWdrYWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODQzNzIsImV4cCI6MjA5MDU2MDM3Mn0.ii3q9MkzUFjuksUwMjT-Ja6o-7H7rXHHfNaf7m0kbqM'
);

async function findDifference() {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .gte('fecha', '2025-03-01')
    .lte('fecha', '2025-03-31');

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  // Filter for analistas (exclude PDV if they mean all analysts)
  // Let's group by cuil and see if there are duplicates
  const byCuil = {};
  data.forEach(r => {
    // Normalize CUIL
    const cuil = r.cuil.replace(/[-\s]/g, '').trim();
    if (!byCuil[cuil]) byCuil[cuil] = [];
    byCuil[cuil].push(r);
  });

  let duplicateExcessAmount = 0;
  console.log('Duplicated CUILs in March 2025:');
  for (const [cuil, records] of Object.entries(byCuil)) {
    if (records.length > 1) {
      // Sum the excess (all records except the first one, or just print them)
      let sum = 0;
      records.forEach(r => sum += Number(r.monto));
      // Assume one is correct, the rest are duplicates
      const excess = sum - Number(records[0].monto);
      duplicateExcessAmount += excess;
      
      console.log(`\nCUIL: ${cuil} has ${records.length} records. Excess: ${excess}`);
      records.forEach(r => console.log(`  - ID: ${r.id} | Analista: ${r.analista} | Monto: ${r.monto} | Fecha: ${r.fecha} | Nombre: ${r.nombre}`));
    }
  }
  
  console.log(`\nTotal duplicate excess amount: ${duplicateExcessAmount}`);
}

findDifference();
