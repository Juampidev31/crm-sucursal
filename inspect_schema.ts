import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
  const { data, error } = await supabase
    .from('resumen_mensual')
    .select('*')
    .limit(1);

    const fs = await import('fs');
    fs.writeFileSync('schema_output.json', JSON.stringify({
      columns: Object.keys(data[0] || {}),
      sample: data[0]
    }, null, 2));
    console.log('Schema saved to schema_output.json');
}

inspectTable();
