import { NextResponse } from 'next/server';

const SHEET_ID = '1ehrJ32n1j1sbrqH3cBzZL9ZaVu9EC79k-6czhp0Ee6k';
const SHEETS = [
  { gid: '138257072', years: [2023, 2022, 2021] }, // sección1 left=2023, right=2022 / sección2 left=2021
  { gid: '407412851', years: [2024] },              // sección1 left=2024 / sección2 left=ops2024
  { gid: '1482735050', years: [2025, 2026] },       // sección1 left=2025 right=2026 / sección2 left=ops2025 right=ops2026
];

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

function parseCol(r: string[], offset: number) {
  const mes = clean(r[offset]);
  if (!mes || mes === 'Mes') return null;
  const obj = clean(r[offset + 1]);
  const real = clean(r[offset + 2]);
  const cumpl = clean(r[offset + 3]);
  const cumplPct = parsePct(cumpl);
  const varVal = clean(r[offset + 4]);
  // Si no tiene ningún dato real, ignorar la fila
  if (!obj && !real) return null;
  return { mes, obj: obj || '-', real: real || '-', cumpl: cumpl || '-', cumplPct, var: varVal || '-' };
}

function parseSections(rows: string[][]): { left: ReturnType<typeof parseCol>[]; right: ReturnType<typeof parseCol>[] }[] {
  const headersIdx: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (clean(rows[i][0]) === 'Mes' && clean(rows[i][1]) === 'Obj.') headersIdx.push(i);
  }
  return headersIdx.map(startIdx => {
    const left: ReturnType<typeof parseCol>[] = [];
    const right: ReturnType<typeof parseCol>[] = [];
    for (let i = startIdx + 2; i < rows.length; i++) {
      const r = rows[i];
      if (clean(r[0]) === 'Mes') break;
      const l = parseCol(r, 0);
      const ri = parseCol(r, 6);
      if (l) left.push(l); else if (right.length === 0 && !clean(r[0])) continue;
      if (ri) right.push(ri);
    }
    return { left, right };
  });
}

export async function GET() {
  const yearData: Record<number, { capital: (object | null)[]; operaciones: (object | null)[] | null }> = {};

  for (const sheet of SHEETS) {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${sheet.gid}`,
      { cache: 'no-store' }
    );
    const text = await res.text();
    const rows = parseCSV(text);
    const sections = parseSections(rows);

    if (sheet.years.length === 1) {
      // 2024: section[0]=capital, section[1]=ops
      const [y] = sheet.years;
      yearData[y] = {
        capital: sections[0]?.left ?? [],
        operaciones: sections[1]?.left ?? null,
      };
    } else if (sheet.years.length === 2) {
      // 2025/2026: section[0] left=2025 right=2026, section[1] left=ops2025 right=ops2026
      const [y1, y2] = sheet.years;
      yearData[y1] = { capital: sections[0]?.left ?? [], operaciones: sections[1]?.left ?? null };
      yearData[y2] = { capital: sections[0]?.right ?? [], operaciones: sections[1]?.right ?? null };
    } else {
      // 2023/2022/2021: section[0] left=2023 right=2022, section[1] left=2021
      const [y1, y2, y3] = sheet.years;
      yearData[y1] = { capital: sections[0]?.left ?? [], operaciones: null };
      yearData[y2] = { capital: sections[0]?.right ?? [], operaciones: null };
      yearData[y3] = { capital: sections[1]?.left ?? [], operaciones: null };
    }
  }

  const years = Object.keys(yearData).map(Number).sort((a, b) => a - b);
  return NextResponse.json({ years, yearData });
}
