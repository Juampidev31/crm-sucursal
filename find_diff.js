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

  console.log(`Total records in March 2025: ${data.length}`);

  let totalMonto = 0;
  const byAmount = {};

  data.forEach(r => {
    totalMonto += Number(r.monto);
    if (!byAmount[r.monto]) byAmount[r.monto] = [];
    byAmount[r.monto].push(r);
  });

  console.log(`Total Monto in DB: ${totalMonto}`);

  if (byAmount[700000]) {
    console.log('Found records exactly matching 700000:');
    console.log(byAmount[700000]);
  } else {
    console.log('No single record is exactly 700000. Looking for potential duplicates...');
    const dups = Object.values(byAmount).filter(arr => arr.length > 1);
    dups.forEach(arr => {
      console.log(`Found ${arr.length} records with amount ${arr[0].monto}:`);
      console.log(arr.map(r => `${r.id} - ${r.analista} - ${r.cuil} - ${r.estado}`));
    });
  }
}

findDifference();
