import { notFound } from 'next/navigation';
import { getCobranzasData, COBRANZAS_YEARS } from './data';
import CobranzasClient from './CobranzasClient';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type SearchParams = Promise<{ year?: string; zoom?: string }>;

export default async function ReporteCobranzasPage({ searchParams }: { searchParams: SearchParams }) {
  const { year: yearParam } = await searchParams;
  const year = yearParam && COBRANZAS_YEARS.includes(yearParam) ? yearParam : '2026';

  // 1. Try Supabase first
  let data = null;
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: dbRow } = await supabase
      .from('cobranzas_data')
      .select('payload')
      .eq('anio', year)
      .single();
    if (dbRow?.payload) data = dbRow.payload;
  } catch {
    // Supabase table may not exist yet — fall through
  }

  // 2. Fall back to Google Sheets
  if (!data) {
    data = await getCobranzasData(year);
  }

  if (!data) notFound();

  return <CobranzasClient key={year} data={data} year={year} years={COBRANZAS_YEARS} />;
}
