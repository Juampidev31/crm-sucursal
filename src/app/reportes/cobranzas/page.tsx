import { notFound } from 'next/navigation';
import { getCobranzasData, COBRANZAS_YEARS } from './data';
import CobranzasClient from './CobranzasClient';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ year?: string; zoom?: string }>;

export default async function ReporteCobranzasPage({ searchParams }: { searchParams: SearchParams }) {
  const { year: yearParam } = await searchParams;
  const year = yearParam && COBRANZAS_YEARS.includes(yearParam) ? yearParam : '2026';

  // 1. Try Supabase first
  let data = null;
  try {
    const supabase = createServerSupabaseClient();
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
