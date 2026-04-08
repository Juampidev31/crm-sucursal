const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testColumn() {
  console.log('Testing update with snapshot_html column...');
  const { error } = await supabase
    .from('resumen_mensual')
    .update({ snapshot_html: 'test' })
    .eq('anio', 2026)
    .eq('mes', 2);

  if (error) {
    console.log('Column snapshot_html does NOT exist:', error.message);
  } else {
    console.log('Column snapshot_html EXISTS! (or update succeeded)');
  }
}

testColumn();
