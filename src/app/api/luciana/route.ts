import { NextResponse } from 'next/server';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1ixuDCB2G5i-eDVP1TvVPylHBaxcoTODnRlizNkJqsfw/export?format=csv&gid=862186907';

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

export async function GET() {
  const res = await fetch(CSV_URL, { cache: 'no-store' });
  const text = await res.text();
  const rows = parseCSV(text);

  // Fila 0: Alcances Trimestrales_XXXX, Q1, Q2, Q3, Q4
  // Fila 1: nombre, pct Q1, pct Q2, pct Q3, pct Q4
  const trimestrales = {
    q1: clean(rows[1]?.[1]),
    q2: clean(rows[1]?.[2]),
    q3: clean(rows[1]?.[3]),
    q4: clean(rows[1]?.[4]),
  };

  // Detectar las 4 secciones buscando las filas "Mes,Obj.,Real,..."
  const seccionesIdx: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (clean(rows[i][0]) === 'Mes' && clean(rows[i][1]) === 'Obj.') {
      seccionesIdx.push(i);
    }
  }

  // Años: la última sección es el año actual (2026), van hacia atrás
  const anioBase = new Date().getFullYear();
  const anios = seccionesIdx.map((_, idx) => anioBase - (seccionesIdx.length - 1 - idx));

  const secciones = seccionesIdx.map((startIdx, si) => {
    const meses = [];
    for (let i = startIdx + 2; i < rows.length; i++) {
      const r = rows[i];
      const mes = clean(r[0]);
      if (!mes || mes === 'Mes') break;
      const cumplPct = parsePct(r[3]);
      const cumplOpsPct = parsePct(r[7]);
      if (cumplPct === 0 && !clean(r[1])) continue; // saltar meses sin datos
      meses.push({
        mes,
        obj: clean(r[1]) || '-',
        real: clean(r[2]) || '-',
        cumpl: clean(r[3]) || '-',
        cumplPct,
        varIM: clean(r[4]) || '-',
        ops: clean(r[5]) || '-',
        alcance: clean(r[6]) || '-',
        cumplOps: clean(r[7]) || '-',
        cumplOpsPct,
        varIMOps: clean(r[8]) || '-',
      });
    }
    return { anio: anios[si], meses };
  });

  return NextResponse.json({ trimestrales, secciones });
}
