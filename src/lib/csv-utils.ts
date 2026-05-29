export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cols: string[] = [];
  let inQuote = false;
  let cur = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    
    if (c === '"') {
      if (inQuote && text[i+1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } 
    else if (c === ',' && !inQuote) {
      cols.push(cur);
      cur = '';
    } 
    else if ((c === '\n' || c === '\r') && !inQuote) {
      if (c === '\r' && text[i+1] === '\n') i++;
      cols.push(cur);
      rows.push(cols);
      cols = [];
      cur = '';
    } 
    else {
      cur += c;
    }
  }
  
  if (cur !== '' || cols.length > 0) {
    cols.push(cur);
    rows.push(cols);
  }
  
  return rows.filter(row => row.length > 1 || row[0] !== ''); // filter empty rows
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
