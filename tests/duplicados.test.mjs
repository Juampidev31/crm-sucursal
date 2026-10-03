import test from 'node:test';
import assert from 'node:assert/strict';
import { requiereChequeoDuplicado } from '../src/lib/duplicados.ts';

const reg = { cuil: '27119706667', nombre: 'Chiecher, Ester Noemi' };

test('un alta siempre chequea duplicados', () => {
  assert.equal(requiereChequeoDuplicado(null, reg, {}), true);
});

test('editar sin tocar la identidad del cliente no chequea nada', () => {
  // Es el caso del bug: cambiar sólo el estado disparaba el modal de duplicado
  // porque el cliente tenía otro registro.
  assert.equal(requiereChequeoDuplicado('id-1', { ...reg }, reg), false);
});

test('editar cambiando el CUIL sí chequea', () => {
  assert.equal(requiereChequeoDuplicado('id-1', { ...reg, cuil: '20123456789' }, reg), true);
});

test('editar cambiando el nombre sí chequea', () => {
  assert.equal(requiereChequeoDuplicado('id-1', { ...reg, nombre: 'Otro, Cliente' }, reg), true);
});

test('diferencias de espacios o mayúsculas no cuentan como cambio', () => {
  assert.equal(requiereChequeoDuplicado('id-1', { cuil: ' 27119706667 ', nombre: 'CHIECHER, ESTER NOEMI' }, reg), false);
});

test('valores ausentes o nulos se tratan como vacío', () => {
  assert.equal(requiereChequeoDuplicado('id-1', { cuil: null, nombre: undefined }, { cuil: '', nombre: '' }), false);
  assert.equal(requiereChequeoDuplicado('id-1', { cuil: '20123456789' }, { cuil: null }), true);
});
