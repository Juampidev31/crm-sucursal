import { NextRequest, NextResponse } from 'next/server';

const SHEET_ID = '1ixuDCB2G5i-eDVP1TvVPylHBaxcoTODnRlizNkJqsfw';

function parseCSV(text: string): string[][] {
  return text.split('\n').map(line => {
    const cols: string[] = [];
    let inQuote = false, cur = '';
    for (const c of line) {
      if (c === '"') { inQuote = !inQuote; }
      else if (c === ',' && !inQuote) { cols.push(cur); cur = ''; }
      else cur += c;
    }
    cols.push(cur);
    return cols;
  });
}

function clean(v: string) { return (v || '').trim(); }
function parsePct(v: string): number | null {
  const s = clean(v).replace('%', '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export async function GET(req: NextRequest) {
  const gid = req.nextUrl.searchParams.get('gid');
  if (!gid) return NextResponse.json({ error: 'gid requerido' }, { status: 400 });

  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
    { cache: 'no-store' }
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
