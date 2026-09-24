import { describe, expect, it } from 'vitest';

import { parseCSV, parseNumberRobust, parsePct } from '../src/lib/csv-utils';

describe('parseCSV', () => {
  it('preserva comas, saltos de línea y comillas escapadas dentro de una celda', () => {
    const input = 'nombre,comentario\r\n"Ana, María","línea 1\nlínea ""2"""';

    expect(parseCSV(input)).toEqual([
      ['nombre', 'comentario'],
      ['Ana, María', 'línea 1\nlínea "2"'],
    ]);
  });

  it('descarta filas completamente vacías', () => {
    expect(parseCSV('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseNumberRobust', () => {
  it.each([
    ['$ 1.234.567,89', 1_234_567.89],
    ['$1,234,567.89', 1_234_567.89],
    ['(1.500,25)', -1_500.25],
    ['25%', 25],
  ])('interpreta %s', (input, expected) => {
    expect(parseNumberRobust(input)).toBe(expected);
  });

  it('devuelve null para porcentajes vacíos', () => {
    expect(parsePct('')).toBeNull();
  });
});
