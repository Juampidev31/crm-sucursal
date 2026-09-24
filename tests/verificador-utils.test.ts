import { describe, expect, it } from 'vitest';

import type { Registro } from '../src/types';
import {
  extractYearMonth,
  parseFullDate,
  verificarFilas,
} from '../src/lib/verificador-utils';

describe('parseFullDate', () => {
  it('normaliza fechas argentinas e ISO válidas', () => {
    expect(parseFullDate('9/1/2025')).toBe('2025-01-09');
    expect(parseFullDate('2024-02-29')).toBe('2024-02-29');
  });

  it('rechaza fechas calendario imposibles', () => {
    expect(parseFullDate('31/02/2025')).toBeNull();
    expect(parseFullDate('2025-13-01')).toBeNull();
  });
});

describe('extractYearMonth', () => {
  it.each([
    ['enero 2025', '2025-01'],
    ['15/09/2025', '2025-09'],
    ['2025-09-15', '2025-09'],
  ])('extrae el período de %s', (input, expected) => {
    expect(extractYearMonth(input)).toBe(expected);
  });
});

describe('verificarFilas', () => {
  it('asigna cada registro exacto a una sola fila importada', () => {
    const records = [
      { id: '1', cuil: '20-123-1', fecha: '2025-09-01', monto: 100 },
      { id: '2', cuil: '20-123-1', fecha: '2025-09-10', monto: 100 },
    ] as Registro[];
    const rows = [
      { cells: ['20 123 1', '09/2025', '100'] },
      { cells: ['20 123 1', '09/2025', '100'] },
    ];

    const result = verificarFilas(
      rows,
      { 0: 'cuil', 1: 'fecha', 2: 'monto' },
      records,
    );

    expect(result.map(item => item.status)).toEqual(['found', 'found']);
    expect(new Set(result.map(item => item.dbId))).toEqual(new Set(['1', '2']));
  });
});
