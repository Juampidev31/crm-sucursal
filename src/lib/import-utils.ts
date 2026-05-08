import { parseCSV, clean } from './csv-utils';
import { Registro } from '@/types';

export function parsePeriodoCSV(csvText: string, startMonth: number, endMonth: number, year: number = 2025): Partial<Registro>[] {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return [];

  const dataRows = rows.slice(1);
  const results: Partial<Registro>[] = [];

  for (const row of dataRows) {
    if (row.length < 5) continue;

    const cuil = clean(row[0]);
    const nombre = clean(row[1]);
    const analista = clean(row[2]);
    const montoStr = clean(row[3]).replace(/,/g, '');
    const fechaStr = clean(row[4]);
    const scoreStr = clean(row[5]);
    const tipoCliente = clean(row[6]);
    const acuerdoPrecios = clean(row[7]);
    const cuotas = clean(row[8]);
    const rangoEtario = clean(row[9]);

    if (!cuil || !fechaStr) continue;

    const dateParts = fechaStr.split('/');
    if (dateParts.length !== 3) continue;
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const rowYear = parseInt(dateParts[2], 10);

    if (rowYear !== year) continue;
    if (month < startMonth || month > endMonth) continue;

    const isoDate = `${rowYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    results.push({
      cuil,
      nombre,
      analista: analista || 'Sistema',
      monto: parseFloat(montoStr) || 0,
      fecha: isoDate,
      puntaje: parseInt(scoreStr, 10) || 0,
      tipo_cliente: tipoCliente,
      acuerdo_precios: acuerdoPrecios,
      cuotas: cuotas,
      rango_etario: rangoEtario,
      estado: 'venta',
      es_re: tipoCliente.toUpperCase().includes('RENOVACION')
    });
  }

  return results;
}
