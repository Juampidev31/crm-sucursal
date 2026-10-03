import test from 'node:test';
import assert from 'node:assert/strict';
import { contarColumna } from '../src/lib/sheet-stats.ts';

const conEncabezado = (...filas) => [['TIPO DE CLIENTE'], ...filas];

test('cuenta los valores de la columna y saltea el encabezado', () => {
  const r = contarColumna(conEncabezado(['Centric'], ['Centric'], ['Referido']), 0);
  assert.deepEqual(r, [{ label: 'Centric', cantidad: 2 }, { label: 'Referido', cantidad: 1 }]);
});

test('unifica variantes que sólo difieren en mayúsculas', () => {
  // El caso real de la planilla: 606 + 458 eran la misma categoría.
  const filas = [
    ...Array(3).fill(['Consulta virtual']),
    ...Array(2).fill(['Consulta VirtuaL']),
  ];
  assert.deepEqual(contarColumna(conEncabezado(...filas), 0), [{ label: 'Consulta virtual', cantidad: 5 }]);
});

test('la etiqueta que queda es la variante más frecuente', () => {
  const filas = [['CENTRIC'], ...Array(4).fill(['Centric'])];
  assert.deepEqual(contarColumna(conEncabezado(...filas), 0), [{ label: 'Centric', cantidad: 5 }]);
});

test('unifica acentos y espacios de más', () => {
  const filas = [['Proyección  0'], ['Proyeccion 0'], [' PROYECCION   0 ']];
  const r = contarColumna(conEncabezado(...filas), 0);
  assert.equal(r.length, 1);
  assert.equal(r[0].cantidad, 3);
});

test('los vacíos van a "No especificado"', () => {
  const r = contarColumna(conEncabezado(['Centric'], [''], ['   '], []), 0);
  assert.deepEqual(r, [{ label: 'No especificado', cantidad: 3 }, { label: 'Centric', cantidad: 1 }]);
});

test('ordena de mayor a menor', () => {
  const filas = [['A'], ['B'], ['B'], ['C'], ['C'], ['C']];
  assert.deepEqual(contarColumna(conEncabezado(...filas), 0).map(x => x.label), ['C', 'B', 'A']);
});

test('en empate gana la variante que aparece primero', () => {
  const filas = [['Centric'], ['CENTRIC']];
  assert.equal(contarColumna(conEncabezado(...filas), 0)[0].label, 'Centric');
});

test('unificar no cambia ningún total: la suma sigue siendo la cantidad de filas', () => {
  // Es la garantía de que la tarjeta no altera métricas: sólo deja de partir
  // una categoría en dos, el total de operaciones queda igual.
  const filas = [
    ['Consulta virtual'], ['Consulta VirtuaL'], ['CONSULTA VIRTUAL'],
    ['Centric'], ['CENTRIC'], ['Referido'], [''], ['Proyección 0'], ['Proyeccion 0'],
  ];
  const r = contarColumna(conEncabezado(...filas), 0);
  assert.equal(r.reduce((s, x) => s + x.cantidad, 0), filas.length);
  assert.equal(r.length, 5, 'quedan 5 categorías distintas, no 9');
});

test('sin filas de datos devuelve una lista vacía', () => {
  assert.deepEqual(contarColumna([['TIPO DE CLIENTE']], 0), []);
  assert.deepEqual(contarColumna([], 0), []);
});
