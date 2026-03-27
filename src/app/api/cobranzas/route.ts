import { NextRequest, NextResponse } from 'next/server';

const SHEET_ID = '1RcjEoiOM4PN92fNQv0ZUy-soh7Qa98vdvys0rr9_JlM';
const SHEETS: Record<string, string> = {
  '2025': '1325602277',
  '2026': '666232440',
};

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

function parsePct(val: string): number | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null;
  const n = parseFloat(val.replace('%', '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year') || '2026';
  const gid = SHEETS[year];
  if (!gid) return NextResponse.json({ error: 'Año inválido' }, { status: 400 });

  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
    { cache: 'no-store' }
  );
  const text = await res.text();
  const rows = parseCSV(text);

  const tramo90: object[] = [], tramo120: object[] = [], refin: object[] = [];

  for (let i = 1; i <= 12; i++) {
    const r = rows[i];
    if (!r?.[0]) continue;
    tramo90.push({ mes: r[0], objetivo: r[1] || '-', recupero: r[2] || '-', cumplimiento: r[3] || '-', pct: parsePct(r[3]) });
    tramo120.push({ mes: r[5], objetivo: r[6] || '-', recupero: r[7] || '-', cumplimiento: r[8] || '-', pct: parsePct(r[8]) });
    refin.push({ mes: r[10], objetivo: r[11] || '-', recupero: r[12] || '-', cumplimiento: r[13] || '-', pct: parsePct(r[13]) });
  }

  let morosidadStart = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'MOROSIDAD') { morosidadStart = i; break; }
  }

  const morosidad: object[] = [];
  let mediaEmpGlobal = '', anioCurrent = '', anioAnterior = '';

  if (morosidadStart >= 0) {
    anioCurrent = rows[morosidadStart][1] || '';
    anioAnterior = rows[morosidadStart][2] || '';
    mediaEmpGlobal = rows[morosidadStart + 1]?.[3] || '';
    for (let i = morosidadStart + 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r?.[0]) continue;
      morosidad.push({
        mes: r[0],
        current: r[1] || '-', currentPct: parsePct(r[1]),
        anterior: r[2] || '-', anteriorPct: parsePct(r[2]),
        mediaEmp: r[3] || '-', mediaPct: parsePct(r[3]),
      });
    }
  }

  return NextResponse.json({ tramo90, tramo120, refin, morosidad, mediaEmpGlobal, anioCurrent, anioAnterior });
}
