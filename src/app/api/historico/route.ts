import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, clean, parsePct } from '@/lib/csv-utils';

const SHEET_ID = '1ixuDCB2G5i-eDVP1TvVPylHBaxcoTODnRlizNkJqsfw';

export async function GET(req: NextRequest) {
  const gid = req.nextUrl.searchParams.get('gid');
  if (!gid) return NextResponse.json({ error: 'gid requerido' }, { status: 400 });

  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
    { next: { revalidate: 300 } }
  );
  const text = await res.text();
  const rows = parseCSV(text);

  const seccionesIdx: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (clean(rows[i][0]) === 'Mes' && clean(rows[i][1]) === 'Obj.') {
      seccionesIdx.push(i);
    }
  }

  const anioBase = new Date().getFullYear();
  const anios = seccionesIdx.map((_, idx) => anioBase - (seccionesIdx.length - 1 - idx));

  const secciones = seccionesIdx.map((startIdx, si) => {
    const meses = [];
    for (let i = startIdx + 2; i < rows.length; i++) {
      const r = rows[i];
      const mes = clean(r[0]);
      if (!mes || mes === 'Mes') break;
      if (!clean(r[1]) && !clean(r[2])) continue;
      meses.push({
        mes,
        obj: clean(r[1]) || '-',
        real: clean(r[2]) || '-',
        cumpl: clean(r[3]) || '-',
        cumplPct: parsePct(r[3]),
        varIM: clean(r[4]) || '-',
        ops: clean(r[5]) || '-',
        alcance: clean(r[6]) || '-',
        cumplOps: clean(r[7]) || '-',
        cumplOpsPct: parsePct(r[7]),
        varIMOps: clean(r[8]) || '-',
      });
    }
    return { anio: anios[si], meses };
  });

  return NextResponse.json({ secciones });
}
