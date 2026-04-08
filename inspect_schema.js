const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
  const { data, error } = await supabase
    .from('resumen_mensual')
    .select('*')
    .limit(1);

  if (!error && data[0]) {
    fs.writeFileSync('schema_output.json', JSON.stringify({
      columns: Object.keys(data[0]),
      sample: data[0]
    }, null, 2));
  }
}

inspectTable();
