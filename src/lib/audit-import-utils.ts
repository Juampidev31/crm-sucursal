import { Registro } from '@/types';

export interface AuditResult {
  status: 'new' | 'duplicate' | 'mismatch';
  csvRecord: Partial<Registro>;
  dbRecord?: Registro;
  diffMessage?: string;
}

export function parseCSVAudit(csvText: string): Partial<Registro>[] {
  const lines = csvText.split('\n');
  const results: Partial<Registro>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parse
    const cols: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') inQuote = !inQuote;
      else if (c === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cols.push(cur.trim());

    if (cols.length < 5) continue;

    const cuil = cols[0];
    const nombre = cols[1];
    const analista = cols[2];
    const monto = parseFloat(cols[3].replace(/,/g, '').replace(/\"/g, '')) || 0;
    const fechaStr = cols[4];
    
    if (!cuil || !fechaStr) continue;

    // Parse date DD/MM/YYYY
    const parts = fechaStr.split('/');
    if (parts.length !== 3) continue;
    
    const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    const tipoCliente = cols[6] || '';

    results.push({
      cuil,
      nombre,
      analista: analista || 'Sistema',
      monto,
      fecha: isoDate,
      puntaje: parseInt(cols[5], 10) || 0,
      tipo_cliente: tipoCliente,
      acuerdo_precios: cols[7],
      cuotas: cols[8],
      rango_etario: cols[9],
      estado: 'venta',
      es_re: tipoCliente.toUpperCase().includes('RENOVACION')
    });
  }
  return results;
}

export function performAudit(csvRecords: Partial<Registro>[], dbRecords: Registro[]): AuditResult[] {
  const dbMap = new Map<string, Registro[]>(); // cuil -> records
  dbRecords.forEach(r => {
    const list = dbMap.get(r.cuil) || [];
    list.push(r);
    dbMap.set(r.cuil, list);
  });

  return csvRecords.map(csv => {
    const cuilList = dbMap.get(csv.cuil!) || [];
    
    // Match by month and year
    const csvMonth = csv.fecha!.substring(0, 7); // YYYY-MM
    
    const sameMonth = cuilList.filter(db => db.fecha && db.fecha.substring(0, 7) === csvMonth);

    if (sameMonth.length === 0) {
      return { status: 'new', csvRecord: csv };
    }

    // Check if any has same amount
    const exactMatch = sameMonth.find(db => Math.abs((db.monto ?? 0) - csv.monto!) < 1);
    if (exactMatch) {
      return { status: 'duplicate', csvRecord: csv, dbRecord: exactMatch };
    }

    // It's a mismatch (same month, different amount)
    return { 
      status: 'mismatch', 
      csvRecord: csv, 
      dbRecord: sameMonth[0], 
      diffMessage: `Monto diferente: CSV $${csv.monto?.toLocaleString()} vs DB $${sameMonth[0].monto?.toLocaleString()}` 
    };
  });
}
