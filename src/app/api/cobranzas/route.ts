import { NextResponse } from 'next/server';
import { getCobranzasData } from '@/app/reportes/cobranzas/data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2026';
  
  try {
    const data = await getCobranzasData(year);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cobranzas data' }, { status: 500 });
  }
}
