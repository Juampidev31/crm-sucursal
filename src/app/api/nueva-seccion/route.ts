import { NextResponse } from 'next/server';
import { fetchCsv } from '@/lib/fetch-csv';

const SHEETS = {
  'LUCIANA': 'https://docs.google.com/spreadsheets/d/1Ieo3UsHNuL8dvvErbaM6X4wqT8JSuuAW9oDSUV5N87A/export?format=csv&gid=1686263284',
  'VICTORIA': 'https://docs.google.com/spreadsheets/d/1GVPFJrrX4j0AM3vd4meGWtd6O-IS67Ljx7l_3Enyb_I/export?format=csv&gid=1686263284'
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const data: Record<string, string[][]> = {};
    
    for (const [name, url] of Object.entries(SHEETS)) {
      const fetchUrl = `${url}&t=${Date.now()}`;
      const rows = await fetchCsv(fetchUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      data[name] = rows;
    }
    
    // Headers explícitos para que el browser y Next.js NO cacheen esta respuesta
    return NextResponse.json({ success: true, data }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
