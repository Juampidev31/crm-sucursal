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

export function parseNumberRobust(v: string): number {
  if (!v) return NaN;
  let str = String(v).replace(/[^0-9.,-]/g, '');
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');
  
  if (lastComma > lastDot) {
    str = str.replace(/\./g, '');
    const c = str.lastIndexOf(',');
    str = str.substring(0, c) + '.' + str.substring(c + 1);
    str = str.replace(/,/g, '');
  } else if (lastDot > lastComma) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1 || /\.\d{3}$/.test(str)) {
      str = str.replace(/\./g, '');
    } else {
      str = str.replace(/,/g, '');
    }
  }
  return parseFloat(str);
}

export function parsePct(v: string): number | null {
  const n = parseNumberRobust(v);
  return isNaN(n) ? null : n;
}
