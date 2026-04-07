export function parseCSV(text: string): string[][] {
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

export function clean(v: string): string {
  return (v || '').trim();
}

export function cleanCurrency(v: string): string {
  return (v || '').trim().replace(/^\$/, '');
}

export function parsePct(v: string): number | null {
  const s = clean(v).replace('%', '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
