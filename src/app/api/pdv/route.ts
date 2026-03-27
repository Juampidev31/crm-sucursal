import { NextResponse } from 'next/server';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1ehrJ32n1j1sbrqH3cBzZL9ZaVu9EC79k-6czhp0Ee6k/export?format=csv&gid=1482735050';

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

function clean(v: string) { return (v || '').trim().replace(/^\$/, ''); }
function parsePct(v: string): number | null {
  const s = clean(v).replace('%', '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseSectionRows(rows: string[][], startIdx: number) {
  const left: object[] = [], right: object[] = [];
  for (let i = startIdx + 2; i < rows.length; i++) {
    const r = rows[i];
    const mes = clean(r[0]);
    if (!mes || mes === 'Mes') break;
    left.push({ mes, obj: clean(r[1]) || '-', real: clean(r[2]) || '-', cumpl: clean(r[3]) || '-', cumplPct: parsePct(r[3]), var: clean(r[4]) || '-' });
    const mes2 = clean(r[6]);
    if (mes2) right.push({ mes: mes2, obj: clean(r[7]) || '-', real: clean(r[8]) || '-', cumpl: clean(r[9]) || '-', cumplPct: parsePct(r[9]), var: clean(r[10]) || '-' });
  }
  return { left, right };
}

export async function GET() {
  const res = await fetch(CSV_URL, { cache: 'no-store' });
  const text = await res.text();
  const rows = parseCSV(text);

  // Trimestrales del header
  const trimestrales = { q1: clean(rows[1]?.[1]), q2: clean(rows[1]?.[2]), q3: clean(rows[1]?.[3]), q4: clean(rows[1]?.[4]) };

  // Encontrar las dos secciones (Mes, Obj., Real, Cumpl., Var)
  const seccionesIdx: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (clean(rows[i][0]) === 'Mes' && clean(rows[i][1]) === 'Obj.') seccionesIdx.push(i);
  }

  const capital = seccionesIdx[0] !== undefined ? parseSectionRows(rows, seccionesIdx[0]) : { left: [], right: [] };
  const operaciones = seccionesIdx[1] !== undefined ? parseSectionRows(rows, seccionesIdx[1]) : { left: [], right: [] };

  // Detectar años: el header dice "Alcances Trimestrales XXXX"
  const headerAnio = parseInt(clean(rows[0]?.[0]).replace(/\D/g, '').slice(-4));
  const anioLeft = isNaN(headerAnio) ? new Date().getFullYear() - 1 : headerAnio;
  const anioRight = anioLeft + 1;

  return NextResponse.json({ trimestrales, capital, operaciones, anioLeft, anioRight });
}
