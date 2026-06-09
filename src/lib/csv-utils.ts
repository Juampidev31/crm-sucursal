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

export function parseNumberRobust(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  let str = String(v);
  const isAcc = /^\\s*\\(.*\\)\\s*$/.test(str);
  str = str.replace(/[^0-9.,-]/g, '');
  if (!str) return NaN;
  const isNeg = isAcc || str.includes('-');
  str = str.replace(/-/g, '');
  const ld = str.lastIndexOf('.');
  const lc = str.lastIndexOf(',');
  if (lc > ld) {
    const cc = (str.match(/,/g) || []).length;
    if (cc > 1 && !/,\\d{1,2}$/.test(str)) {
      str = str.replace(/,/g, '');
    } else if (cc > 1 && /,\\d{1,2}$/.test(str)) {
      const c = str.lastIndexOf(',');
      str = str.substring(0, c).replace(/,/g, '') + '.' + str.substring(c + 1);
    } else {
      str = str.replace(/\\./g, '');
      const c = str.lastIndexOf(',');
      str = str.substring(0, c) + '.' + str.substring(c + 1);
    }
  } else if (ld > lc) {
    const dc = (str.match(/\\./g) || []).length;
    if (dc > 1 && !/\\.\\d{1,2}$/.test(str)) {
      str = str.replace(/\\./g, '');
    } else if (dc > 1 && /\\.\\d{1,2}$/.test(str)) {
      const d = str.lastIndexOf('.');
      str = str.substring(0, d).replace(/\\./g, '') + '.' + str.substring(d + 1);
    } else if (/\\.\\d{3}$/.test(str)) {
      str = str.replace(/\\./g, '');
    } else {
      str = str.replace(/,/g, '');
    }
  }
  let num = parseFloat(str);
  if (isNeg && !isNaN(num)) num = -num;
  return num;
}

export function parsePct(v: string): number | null {
  const n = parseNumberRobust(v);
  return isNaN(n) ? null : n;
}
