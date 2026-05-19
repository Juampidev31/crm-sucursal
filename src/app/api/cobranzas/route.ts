import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCobranzasData } from '@/app/reportes/cobranzas/data';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2026';
  
  try {
    // 1. Try Supabase first
    const { data: dbRow } = await supabase
      .from('cobranzas_data')
      .select('payload')
      .eq('anio', year)
      .single();

    if (dbRow?.payload) {
      return NextResponse.json({ ...dbRow.payload, source: 'supabase' });
    }

    // 2. Fall back to Google Sheets
    const data = await getCobranzasData(year);
    return NextResponse.json({ ...data, source: 'sheets' });
  } catch {
    // If Supabase table doesn't exist yet, fall back to Sheets
    try {
      const data = await getCobranzasData(year);
      return NextResponse.json({ ...data, source: 'sheets' });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch cobranzas data' }, { status: 500 });
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { year, data } = body;

    if (!year || !data) {
      return NextResponse.json({ error: 'Missing year or data' }, { status: 400 });
    }

    // Remove source field before saving
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { source, ...payload } = data;

    const { error } = await supabase
      .from('cobranzas_data')
      .upsert(
        { anio: year, payload, updated_at: new Date().toISOString() },
        { onConflict: 'anio' }
      );

    if (error) {
      console.error('Error saving cobranzas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error in POST /api/cobranzas:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
